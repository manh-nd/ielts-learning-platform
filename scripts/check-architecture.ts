import fs from "fs";
import path from "path";
import ts from "typescript";

export interface ArchitectureViolation {
  file: string;
  line: number;
  statementType: "import" | "export" | "dynamic_import";
  specifier: string;
  normalizedTarget: string;
  ruleName: string;
  message: string;
}

export interface ExtractedStatement {
  statementType: "import" | "export" | "dynamic_import";
  specifier: string;
  line: number;
}

/**
 * Normalizes an import or export module specifier into a canonical path relative to repository root.
 * - `@/foo/bar` -> `foo/bar`
 * - `../infrastructure/bar` from `modules/speaking/application/foo.ts` -> `modules/speaking/infrastructure/bar`
 * - bare packages remain as-is (e.g. `react`, `@google/genai`)
 */
export function normalizeModuleSpecifier(
  sourceFilePath: string,
  specifier: string
): string {
  const cleanSpecifier = specifier.trim();
  if (cleanSpecifier.startsWith("@/")) {
    return cleanSpecifier.slice(2).replace(/\\/g, "/");
  }
  if (cleanSpecifier.startsWith(".")) {
    const dir = path.dirname(sourceFilePath.replace(/\\/g, "/"));
    const resolved = path.posix.normalize(path.posix.join(dir, cleanSpecifier));
    return resolved.replace(/^\.\//, "");
  }
  return cleanSpecifier.replace(/\\/g, "/");
}

function isTestOrStoryFile(normalizedPath: string): boolean {
  return (
    normalizedPath.includes(".test.") ||
    normalizedPath.includes(".spec.") ||
    normalizedPath.includes(".stories.")
  );
}

export function isDomainSource(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  if (isTestOrStoryFile(p)) return false;
  return /^modules\/[^/]+\/domain\//.test(p);
}

export function isCleanedPilotUiSource(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  if (isTestOrStoryFile(p)) return false;

  const validPrefixes = [
    "components/speaking/",
    "components/homework/",
    "components/classroom/",
    "app/(protected)/learner/speaking/",
    "app/(protected)/learner/assignments/",
    "app/(protected)/teacher/submissions/",
    "app/(protected)/teacher/classrooms/",
  ];

  return validPrefixes.some((prefix) => p.startsWith(prefix));
}

export function isApplicationSource(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  if (isTestOrStoryFile(p)) return false;
  return /^modules\/[^/]+\/application\//.test(p);
}

export function isRouteHandlerSource(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  if (isTestOrStoryFile(p)) return false;
  return p.startsWith("app/api/");
}

function isPackageOrSubpath(target: string, pkgName: string): boolean {
  return target === pkgName || target.startsWith(`${pkgName}/`);
}

function isInfrastructureTarget(target: string): boolean {
  return (
    /^modules\/[^/]+\/infrastructure(\/|$)/.test(target) ||
    target.includes("/infrastructure/")
  );
}

export function isForbiddenApplicationTarget(target: string): boolean {
  return (
    isInfrastructureTarget(target) ||
    target.startsWith("lib/db") ||
    isPackageOrSubpath(target, "drizzle-orm") ||
    isPackageOrSubpath(target, "postgres") ||
    target.startsWith("lib/storage") ||
    isPackageOrSubpath(target, "@aws-sdk") ||
    target.startsWith("lib/gemini") ||
    isPackageOrSubpath(target, "@google/genai")
  );
}

/**
 * Checks a single source file content against architectural boundary rules.
 */
export function checkSourceFile(
  filePath: string,
  sourceText: string
): ArchitectureViolation[] {
  const normalizedFile = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  const violations: ArchitectureViolation[] = [];

  const sourceFile = ts.createSourceFile(
    normalizedFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  function getLine(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  // Map to track local bindings imported from forbidden infrastructure/DB/storage/AI targets in application files
  const forbiddenApplicationBindings = new Map<
    string,
    { target: string; specifier: string; line: number }
  >();

  function visit(node: ts.Node) {
    // Static import: import ... from 'specifier';
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      const line = getLine(node.getStart(sourceFile));
      const target = normalizeModuleSpecifier(normalizedFile, specifier);

      // In application files, track local bindings imported from forbidden targets to catch 2-step re-exports
      if (isApplicationSource(normalizedFile)) {
        if (isForbiddenApplicationTarget(target) && node.importClause) {
          // Default import: import repo from '...'
          if (node.importClause.name) {
            forbiddenApplicationBindings.set(node.importClause.name.text, {
              target,
              specifier,
              line: getLine(node.importClause.name.getStart(sourceFile)),
            });
          }
          // Named or namespace bindings: import { repo as r } or import * as r
          if (node.importClause.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              for (const el of node.importClause.namedBindings.elements) {
                forbiddenApplicationBindings.set(el.name.text, {
                  target,
                  specifier,
                  line: getLine(el.name.getStart(sourceFile)),
                });
              }
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              forbiddenApplicationBindings.set(
                node.importClause.namedBindings.name.text,
                {
                  target,
                  specifier,
                  line: getLine(
                    node.importClause.namedBindings.name.getStart(sourceFile)
                  ),
                }
              );
            }
          }
        }
      }

      checkStatement(normalizedFile, "import", specifier, target, line);
    }

    // Static re-export with module specifier: export ... from 'specifier';
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      const line = getLine(node.getStart(sourceFile));
      const target = normalizeModuleSpecifier(normalizedFile, specifier);

      checkStatement(normalizedFile, "export", specifier, target, line);
    }

    // Two-step re-export without module specifier: export { persistenceRepo as repo };
    if (
      ts.isExportDeclaration(node) &&
      !node.moduleSpecifier &&
      isApplicationSource(normalizedFile)
    ) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          const localName = el.propertyName
            ? el.propertyName.text
            : el.name.text;
          if (forbiddenApplicationBindings.has(localName)) {
            const sourceInfo = forbiddenApplicationBindings.get(localName)!;
            const line = getLine(el.getStart(sourceFile));
            violations.push({
              file: normalizedFile,
              line,
              statementType: "export",
              specifier: sourceInfo.specifier,
              normalizedTarget: sourceInfo.target,
              ruleName: "Application Anti-Laundering Re-export",
              message: `Application modules must not re-export infrastructure implementations (two-step re-export of '${localName}' imported from '${sourceInfo.specifier}').\nApplication may orchestrate infrastructure internally, but must not act as a re-export proxy to bypass UI boundary checks.\nExpected direction: UI -> Application -> Domain`,
            });
          }
        }
      }
    }

    // Default export assignment in application files: export default persistenceRepo;
    if (
      ts.isExportAssignment(node) &&
      ts.isIdentifier(node.expression) &&
      isApplicationSource(normalizedFile)
    ) {
      const localName = node.expression.text;
      if (forbiddenApplicationBindings.has(localName)) {
        const sourceInfo = forbiddenApplicationBindings.get(localName)!;
        const line = getLine(node.getStart(sourceFile));
        violations.push({
          file: normalizedFile,
          line,
          statementType: "export",
          specifier: sourceInfo.specifier,
          normalizedTarget: sourceInfo.target,
          ruleName: "Application Anti-Laundering Re-export",
          message: `Application modules must not re-export infrastructure implementations (default export of '${localName}' imported from '${sourceInfo.specifier}').\nApplication may orchestrate infrastructure internally, but must not act as a re-export proxy to bypass UI boundary checks.\nExpected direction: UI -> Application -> Domain`,
        });
      }
    }

    // Dynamic import: import('specifier')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = (node.arguments[0] as ts.StringLiteral).text;
      const line = getLine(node.getStart(sourceFile));
      const target = normalizeModuleSpecifier(normalizedFile, specifier);

      checkStatement(normalizedFile, "dynamic_import", specifier, target, line);
    }

    ts.forEachChild(node, visit);
  }

  function checkStatement(
    file: string,
    statementType: "import" | "export" | "dynamic_import",
    specifier: string,
    target: string,
    line: number
  ) {
    // Rule 1: Domain Purity
    if (isDomainSource(file)) {
      const isReact =
        isPackageOrSubpath(target, "react") ||
        isPackageOrSubpath(target, "react-dom");
      const isNext = isPackageOrSubpath(target, "next");
      const isUi =
        target.startsWith("app/") || target.startsWith("components/");
      const isDb =
        target.startsWith("lib/db") ||
        isPackageOrSubpath(target, "drizzle-orm") ||
        isPackageOrSubpath(target, "postgres");
      const isStorage =
        target.startsWith("lib/storage") ||
        isPackageOrSubpath(target, "@aws-sdk");
      const isAi =
        target.startsWith("lib/gemini") ||
        isPackageOrSubpath(target, "@google/genai");
      const isTelemetry = target.startsWith("lib/telemetry");
      const isAudio = target.startsWith("lib/audio");
      const isInfra = isInfrastructureTarget(target);

      if (
        isReact ||
        isNext ||
        isUi ||
        isDb ||
        isStorage ||
        isAi ||
        isTelemetry ||
        isAudio ||
        isInfra
      ) {
        violations.push({
          file,
          line,
          statementType,
          specifier,
          normalizedTarget: target,
          ruleName: "Domain Purity",
          message:
            "Domain code must remain pure and framework-agnostic. Expected direction: UI -> Application -> Domain.\nDomain must never depend on React, Next.js, database/ORM, storage, AI provider, or infrastructure adapters.",
        });
      }
    }

    // Rule 2: Cleaned Shipped Pilot UI Infrastructure Hygiene
    if (isCleanedPilotUiSource(file)) {
      // Correction #1: EXACT single source-target exception
      const isExactBrowserAdapterException =
        file === "components/speaking/live/live-speaking-examiner-room.tsx" &&
        (target ===
          "modules/speaking/infrastructure/browser/speaking-practice-browser-adapter" ||
          target ===
            "modules/speaking/infrastructure/browser/speaking-practice-browser-adapter.ts");

      const isInfra = isInfrastructureTarget(target);
      const isDb =
        target.startsWith("lib/db") ||
        isPackageOrSubpath(target, "drizzle-orm") ||
        isPackageOrSubpath(target, "postgres");
      const isStorage =
        target.startsWith("lib/storage") ||
        isPackageOrSubpath(target, "@aws-sdk");
      const isAiEvaluator =
        target === "lib/gemini/speaking-evaluator" ||
        target === "lib/gemini/speaking-evaluator.ts" ||
        target === "lib/gemini" ||
        target === "lib/gemini/index" ||
        target === "lib/gemini/index.ts" ||
        isPackageOrSubpath(target, "@google/genai");

      if (
        (isInfra && !isExactBrowserAdapterException) ||
        isDb ||
        isStorage ||
        isAiEvaluator
      ) {
        violations.push({
          file,
          line,
          statementType,
          specifier,
          normalizedTarget: target,
          ruleName: "UI Infrastructure Isolation",
          message:
            "UI must call an application use case/read model instead of importing infrastructure directly.\nExpected direction: UI -> Application -> Domain",
        });
      }
    }

    // Rule 3: Application Anti-Laundering Re-export Rule (Direct re-export)
    if (isApplicationSource(file)) {
      if (statementType === "export") {
        if (isForbiddenApplicationTarget(target)) {
          violations.push({
            file,
            line,
            statementType,
            specifier,
            normalizedTarget: target,
            ruleName: "Application Anti-Laundering Re-export",
            message:
              "Application modules must not re-export infrastructure implementations.\nApplication may orchestrate infrastructure internally, but must not act as a re-export proxy to bypass UI boundary checks.\nExpected direction: UI -> Application -> Domain",
          });
        }
      }
    }

    // Rule 4: Route Handler Adapter Hygiene (Correction #4 & Route UI rejection)
    if (isRouteHandlerSource(file)) {
      const isReact =
        isPackageOrSubpath(target, "react") ||
        isPackageOrSubpath(target, "react-dom");
      const isUiComponent = target.startsWith("components/");
      const isAppUi =
        target.startsWith("app/") && !target.startsWith("app/api/");

      if (isReact || isUiComponent || isAppUi) {
        violations.push({
          file,
          line,
          statementType,
          specifier,
          normalizedTarget: target,
          ruleName: "Route Adapter Hygiene",
          message:
            "Route handlers are HTTP transport adapters and must not import React, UI components, or App pages/views.\nExpected direction: UI -> Application (or HTTP Route -> Application Use Case)",
        });
      }
    }
  }

  visit(sourceFile);
  return violations;
}

/**
 * Scans directories recursively for TypeScript files.
 */
export function findScanCandidates(rootDir: string): string[] {
  const candidates: string[] = [];

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === "out" ||
          entry.name === "build" ||
          entry.name === "storybook-static"
        ) {
          continue;
        }
        walk(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
        !isTestOrStoryFile(entry.name)
      ) {
        const relative = path.relative(rootDir, fullPath).replace(/\\/g, "/");
        if (
          isDomainSource(relative) ||
          isCleanedPilotUiSource(relative) ||
          isApplicationSource(relative) ||
          isRouteHandlerSource(relative)
        ) {
          candidates.push(relative);
        }
      }
    }
  }

  const targetDirs = ["modules", "components", "app"];
  for (const dir of targetDirs) {
    walk(path.join(rootDir, dir));
  }

  return candidates;
}

/**
 * Runs architecture boundary check across the repository or given files.
 */
export function checkArchitecture(options?: {
  rootDir?: string;
  files?: string[];
}): {
  violations: ArchitectureViolation[];
  scannedFilesCount: number;
} {
  const rootDir = options?.rootDir || process.cwd();
  const fileList = options?.files || findScanCandidates(rootDir);
  const violations: ArchitectureViolation[] = [];

  for (const file of fileList) {
    const absolutePath = path.join(rootDir, file);
    if (!fs.existsSync(absolutePath)) continue;
    const content = fs.readFileSync(absolutePath, "utf-8");
    const fileViolations = checkSourceFile(file, content);
    violations.push(...fileViolations);
  }

  return {
    violations,
    scannedFilesCount: fileList.length,
  };
}

/**
 * CLI Runner
 */
if (import.meta.main) {
  console.log("🔍 Checking architecture boundaries (Issue #86)...");
  const startTime = Date.now();
  const result = checkArchitecture();
  const durationMs = Date.now() - startTime;

  if (result.violations.length === 0) {
    console.log(
      `✅ Architecture check passed! Scanned ${result.scannedFilesCount} boundary files in ${durationMs}ms with 0 violations.`
    );
    process.exit(0);
  }

  console.error(
    `\n❌ Architecture check failed! Found ${result.violations.length} violation(s):\n`
  );

  for (const v of result.violations) {
    console.error(
      `Architecture violation [${v.ruleName}]:\n  ${v.file}:${v.line}\n    ${v.statementType} "${v.specifier}" (normalized: ${v.normalizedTarget})\n\n  ${v.message.split("\n").join("\n  ")}\n`
    );
  }

  console.error(`Expected dependency direction:
  UI (app/components) -> Application (modules/*/application) -> Domain (modules/*/domain) [PURE CORE]
  Infrastructure adapters (modules/*/infrastructure, lib/*) -> Application / Domain
`);

  process.exit(1);
}
