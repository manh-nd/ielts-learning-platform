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

/**
 * Parses a TypeScript source file with the TypeScript compiler AST and extracts
 * all static imports, re-exports (`export ... from ...`), and dynamic `import(...)`.
 */
export function extractModuleStatements(
  fileName: string,
  sourceText: string
): ExtractedStatement[] {
  const statements: ExtractedStatement[] = [];
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  function getLine(pos: number): number {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visit(node: ts.Node) {
    // Static import: import ... from 'specifier';
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      statements.push({
        statementType: "import",
        specifier: node.moduleSpecifier.text,
        line: getLine(node.getStart(sourceFile)),
      });
    }

    // Static re-export: export ... from 'specifier';
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      statements.push({
        statementType: "export",
        specifier: node.moduleSpecifier.text,
        line: getLine(node.getStart(sourceFile)),
      });
    }

    // Dynamic import: import('specifier')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      statements.push({
        statementType: "dynamic_import",
        specifier: (node.arguments[0] as ts.StringLiteral).text,
        line: getLine(node.getStart(sourceFile)),
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return statements;
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

/**
 * Checks a single source file content against architectural boundary rules.
 */
export function checkSourceFile(
  filePath: string,
  sourceText: string
): ArchitectureViolation[] {
  const normalizedFile = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  const violations: ArchitectureViolation[] = [];

  const statements = extractModuleStatements(normalizedFile, sourceText);

  for (const stmt of statements) {
    const target = normalizeModuleSpecifier(normalizedFile, stmt.specifier);

    // Rule 1: Domain Purity
    if (isDomainSource(normalizedFile)) {
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
          file: normalizedFile,
          line: stmt.line,
          statementType: stmt.statementType,
          specifier: stmt.specifier,
          normalizedTarget: target,
          ruleName: "Domain Purity",
          message:
            "Domain code must remain pure and framework-agnostic. Expected direction: UI -> Application -> Domain.\nDomain must never depend on React, Next.js, database/ORM, storage, AI provider, or infrastructure adapters.",
        });
      }
    }

    // Rule 2: Cleaned Shipped Pilot UI Infrastructure Hygiene
    if (isCleanedPilotUiSource(normalizedFile)) {
      // Correction #1: EXACT single source-target exception
      const isExactBrowserAdapterException =
        normalizedFile ===
          "components/speaking/live/live-speaking-examiner-room.tsx" &&
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
          file: normalizedFile,
          line: stmt.line,
          statementType: stmt.statementType,
          specifier: stmt.specifier,
          normalizedTarget: target,
          ruleName: "UI Infrastructure Isolation",
          message:
            "UI must call an application use case/read model instead of importing infrastructure directly.\nExpected direction: UI -> Application -> Domain",
        });
      }
    }

    // Rule 3: Application Anti-Laundering Re-export Rule (Correction #3)
    if (isApplicationSource(normalizedFile)) {
      // Application code may IMPORT infrastructure for orchestration,
      // but must NOT RE-EXPORT infrastructure implementations to UI or domain.
      if (stmt.statementType === "export") {
        const isInfra = isInfrastructureTarget(target);
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

        if (isInfra || isDb || isStorage || isAi) {
          violations.push({
            file: normalizedFile,
            line: stmt.line,
            statementType: stmt.statementType,
            specifier: stmt.specifier,
            normalizedTarget: target,
            ruleName: "Application Anti-Laundering Re-export",
            message:
              "Application modules must not re-export infrastructure implementations.\nApplication may orchestrate infrastructure internally, but must not act as a re-export proxy to bypass UI boundary checks.\nExpected direction: UI -> Application -> Domain",
          });
        }
      }
    }

    // Rule 4: Route Handler Adapter Hygiene (Correction #4)
    if (isRouteHandlerSource(normalizedFile)) {
      const isReact =
        isPackageOrSubpath(target, "react") ||
        isPackageOrSubpath(target, "react-dom");
      const isUiComponent = target.startsWith("components/");

      if (isReact || isUiComponent) {
        violations.push({
          file: normalizedFile,
          line: stmt.line,
          statementType: stmt.statementType,
          specifier: stmt.specifier,
          normalizedTarget: target,
          ruleName: "Route Adapter Hygiene",
          message:
            "Route handlers are HTTP transport adapters and must not import React or UI components.\nExpected direction: UI -> Application (or HTTP Route -> Application Use Case)",
        });
      }
    }
  }

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
