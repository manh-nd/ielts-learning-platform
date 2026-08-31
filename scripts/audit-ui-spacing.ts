#!/usr/bin/env bun
/**
 * Automated UI/UX Spacing & Layout Auditor
 *
 * Scans component files in `components/` and `app/` to detect common layout
 * antipatterns and design system token violations:
 * 1. Card Header Flushness: `<Card>` containing `<CardHeader>` with border-b/bg-* must have `py-0 gap-0`.
 * 2. Arbitrary Spacing: Flags arbitrary non-token values like `p-[*px]`, `gap-[*px]`.
 */

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

interface Violation {
  file: string;
  line: number;
  rule: string;
  message: string;
  snippet: string;
}

const VIOLATION_RULES = {
  CARD_HEADER_FLUSH: "CARD_HEADER_FLUSH",
  ARBITRARY_SPACING: "ARBITRARY_SPACING",
} as const;

function walkDir(dir: string, fileList: string[] = []): string[] {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file.startsWith(".") || file === "node_modules" || file === "dist") {
        continue;
      }
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, fileList);
      } else if (
        file.endsWith(".tsx") &&
        !file.endsWith(".stories.tsx") &&
        !file.endsWith(".test.tsx")
      ) {
        fileList.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist
  }
  return fileList;
}

function checkCardHeaderFlushness(
  content: string,
  filePath: string,
  violations: Violation[]
) {
  // Regex to match <Card ...> tags that contain <CardHeader ...> within their scope
  // We check if CardHeader has border-b or bg- and Card does not have py-0 or gap-0
  const lines = content.split("\n");
  let inCard = false;
  let cardClosedTag = false;
  let cardStartLine = 0;
  let cardClassStr = "";
  let cardTagBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      line.includes("<Card ") ||
      line.includes("<Card\n") ||
      line.trim() === "<Card>"
    ) {
      inCard = true;
      cardClosedTag = false;
      cardStartLine = i + 1;
      cardTagBuffer = line;
      cardClassStr = "";
    }

    if (inCard) {
      if (!cardClosedTag) {
        cardTagBuffer += " " + line;
        if (line.includes(">")) {
          // Extract className inside the Card tag itself
          const classMatch = cardTagBuffer.match(
            /className=(?:\{cn\(([^)]+)\)\}|["'`]([^"'`]+)["'`])/
          );
          if (classMatch) {
            cardClassStr = classMatch[1] || classMatch[2] || "";
          }
          cardClosedTag = true;
        }
      }

      // Check if this card contains a CardHeader with border-b or bg- on the CardHeader itself
      if (line.includes("<CardHeader")) {
        let headerTagBuffer = "";
        for (let j = i; j < Math.min(lines.length, i + 5); j++) {
          headerTagBuffer += " " + lines[j];
          if (lines[j].includes(">")) break;
        }
        const hasBorderOrBg =
          headerTagBuffer.includes("border-b") ||
          /\bbg-\w+/.test(headerTagBuffer);

        if (hasBorderOrBg) {
          const hasPy0 = cardClassStr.includes("py-0");
          const hasGap0 = cardClassStr.includes("gap-0");

          if (!hasPy0 || !hasGap0) {
            violations.push({
              file: relative(process.cwd(), filePath),
              line: cardStartLine,
              rule: VIOLATION_RULES.CARD_HEADER_FLUSH,
              message:
                "Thẻ <Card> chứa <CardHeader> có nền màu/border-b nhưng thiếu 'py-0 gap-0'. Padding mặc định 16px của Card sẽ làm header bị thụt xuống.",
              snippet: line.trim(),
            });
          }
        }
      }

      if (line.includes("</Card>")) {
        inCard = false;
        cardClosedTag = false;
      }
    }
  }
}

function checkArbitrarySpacing(
  content: string,
  filePath: string,
  violations: Violation[]
) {
  // Primitives in components/ui (shadcn internals like tabs, sliders) use micro offsets
  if (filePath.includes("components/ui/")) {
    return;
  }

  const lines = content.split("\n");
  const arbitrarySpacingRegex =
    /\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y)-\[\d+px\]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(arbitrarySpacingRegex);
    if (match) {
      violations.push({
        file: relative(process.cwd(), filePath),
        line: i + 1,
        rule: VIOLATION_RULES.ARBITRARY_SPACING,
        message: `Sử dụng spacing tùy tiện '${match.join(", ")}' thay vì dùng token tiêu chuẩn của Tailwind (2, 3, 4, 6, 8...).`,
        snippet: line.trim(),
      });
    }
  }
}

function runAudit() {
  console.log(
    "🔍 Đang quét toàn bộ UI components để kiểm tra tỷ lệ Spacing & Layout..."
  );

  const targetDirs = [
    join(process.cwd(), "components"),
    join(process.cwd(), "app"),
  ];

  const files: string[] = [];
  for (const dir of targetDirs) {
    walkDir(dir, files);
  }

  const violations: Violation[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    checkCardHeaderFlushness(content, file, violations);
    checkArbitrarySpacing(content, file, violations);
  }

  console.log(`📊 Đã kiểm tra ${files.length} file component .tsx.\n`);

  if (violations.length > 0) {
    console.error(
      `❌ Phát hiện ${violations.length} lỗi Spacing & Layout cần khắc phục:\n`
    );
    for (const v of violations) {
      console.error(`  - [${v.rule}] ${v.file}:${v.line}`);
      console.error(`    Chi tiết: ${v.message}`);
      console.error(`    Code: ${v.snippet}\n`);
    }
    process.exit(1);
  } else {
    console.log(
      "✅ Tuyệt vời! Không phát hiện vi phạm spacing hay layout container nào."
    );
    process.exit(0);
  }
}

runAudit();
