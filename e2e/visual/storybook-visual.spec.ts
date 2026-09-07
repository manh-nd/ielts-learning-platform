import { test, expect, Page } from "@playwright/test";

/**
 * Prepares the Storybook iframe page for deterministic, flake-free visual regression snapshots.
 * Waits for Storybook main container to mount and disables CSS animations.
 */
async function loadStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);

  // Wait for Storybook's runtime to complete mounting the story (body gets sb-show-main class)
  await expect(page.locator("body")).toHaveClass(/sb-show-main/, {
    timeout: 15000,
  });

  // Inject CSS to eliminate animation/transition/caret flakiness
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001s !important;
        animation-delay: 0s !important;
        transition-duration: 0.001s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });

  // Ensure root element has rendered content
  const root = page.locator("#storybook-root");
  await expect(root).toBeVisible();

  // Wait for font set readiness and verify Chilly Inter loaded across production weights (upright & italic)
  await page.evaluate(async () => {
    await document.fonts.ready;
    const probeString = "ă â ê ô ơ ư đ ắ ằ ẳ ẵ ặ ế ề ể ễ ệ ớ ờ ở ỡ ợ ứ ừ ử ữ ự";
    const requiredWeights = ["400", "500", "600", "700"];
    for (const weight of requiredWeights) {
      // Normal / upright font face verification
      const normalFontDesc = `${weight} 16px "Chilly Inter"`;
      const loadedNormalFaces = await document.fonts.load(
        normalFontDesc,
        probeString
      );
      const hasLoadedNormal = loadedNormalFaces.some(
        (face) =>
          face.family === "Chilly Inter" &&
          face.style === "normal" &&
          face.status === "loaded"
      );
      if (!hasLoadedNormal) {
        throw new Error(
          `Primary font "Chilly Inter" (normal) at weight ${weight} failed to load for Vietnamese probe: "${probeString}"`
        );
      }

      // Italic font face verification (separate InterVariable-Italic.woff2 asset)
      const italicFontDesc = `italic ${weight} 16px "Chilly Inter"`;
      const loadedItalicFaces = await document.fonts.load(
        italicFontDesc,
        probeString
      );
      const hasLoadedItalic = loadedItalicFaces.some(
        (face) =>
          face.family === "Chilly Inter" &&
          face.style === "italic" &&
          face.status === "loaded"
      );
      if (!hasLoadedItalic) {
        throw new Error(
          `Primary font "Chilly Inter" (italic) at weight ${weight} failed to load for Vietnamese probe: "${probeString}"`
        );
      }
    }
  });
}

test.describe("Storybook Visual Regression Suite", () => {
  test.describe("0. Foundations Typography", () => {
    test("Vietnamese Typography Coverage & Platform Font Verification", async ({
      page,
    }, testInfo) => {
      await loadStory(
        page,
        "design-system-foundations-typography--vietnamese-coverage"
      );

      // Verify that runtime devicePixelRatio strictly matches the visual-project contract (canonical DPR 2)
      const expectedDpr = testInfo.project.use.deviceScaleFactor;
      const actualDpr = await page.evaluate(() => window.devicePixelRatio);
      expect(actualDpr).toBe(expectedDpr);
      expect(actualDpr).toBe(2);

      // Verify via Chromium CDP that probe glyphs are rendered from project-owned Chilly Inter
      const client = await page.context().newCDPSession(page);
      await client.send("DOM.enable");
      await client.send("CSS.enable");

      const doc = await client.send("DOM.getDocument");
      const probeNode = await client.send("DOM.querySelector", {
        nodeId: doc.root.nodeId,
        selector: "[data-testid='vietnamese-font-probe']",
      });

      expect(probeNode.nodeId).toBeGreaterThan(0);

      const fontData = await client.send("CSS.getPlatformFontsForNode", {
        nodeId: probeNode.nodeId,
      });

      expect(fontData.fonts).toHaveLength(1);
      const [primaryFont] = fontData.fonts;
      expect(primaryFont.isCustomFont).toBe(true);
      expect(primaryFont.familyName).toBe("Inter Variable");
      expect(primaryFont.glyphCount).toBeGreaterThan(0);

      // Verify via Chromium CDP that italic probe glyphs are rendered from project-owned Chilly Inter italic
      const probeItalicNode = await client.send("DOM.querySelector", {
        nodeId: doc.root.nodeId,
        selector: "[data-testid='vietnamese-font-probe-italic']",
      });

      expect(probeItalicNode.nodeId).toBeGreaterThan(0);

      const italicFontData = await client.send("CSS.getPlatformFontsForNode", {
        nodeId: probeItalicNode.nodeId,
      });

      expect(italicFontData.fonts).toHaveLength(1);
      const [primaryItalicFont] = italicFontData.fonts;
      expect(primaryItalicFont.isCustomFont).toBe(true);
      expect(primaryItalicFont.familyName).toBe("Inter Variable");
      expect(primaryItalicFont.glyphCount).toBeGreaterThan(0);

      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "typography-vietnamese-coverage.png"
      );
    });
  });

  test.describe("1. TeacherReviewAnnotator", () => {
    test("AI Pre-Graded State", async ({ page }) => {
      await loadStory(
        page,
        "product-writing-teacherreviewannotator--ai-pre-graded"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "teacher-review-annotator-ai-pregraded.png"
      );
    });

    test("Teacher Edits AI Suggestion", async ({ page }) => {
      await loadStory(
        page,
        "product-writing-teacherreviewannotator--teacher-edits-ai-suggestion"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "teacher-review-annotator-teacher-edits.png"
      );
    });
  });

  test.describe("2. TeacherReviewWorkspace", () => {
    test("Default Desktop Review State", async ({ page }) => {
      await loadStory(
        page,
        "product-writing-teacherreviewworkspace--default-desktop"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "teacher-review-workspace-default.png"
      );
    });

    test("Published Readonly State", async ({ page }) => {
      await loadStory(
        page,
        "product-writing-teacherreviewworkspace--published-readonly"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "teacher-review-workspace-published.png"
      );
    });
  });

  test.describe("3. AssessmentScorecard", () => {
    test("Interactive Teacher Review Scorecard", async ({ page }) => {
      await loadStory(
        page,
        "product-writing-assessmentscorecard--interactive-teacher-review"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "assessment-scorecard-interactive.png"
      );
    });
  });

  test.describe("4. TeacherSpeakingReviewWorkspace", () => {
    test("Default With AI Proposal", async ({ page }) => {
      await loadStory(
        page,
        "product-speaking-teacherspeakingreviewworkspace-prototype--default-with-ai-proposal"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "speaking-review-workspace-ai-proposal.png"
      );
    });

    test("Teacher Approved State", async ({ page }) => {
      await loadStory(
        page,
        "product-speaking-teacherspeakingreviewworkspace-prototype--teacher-approved"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "speaking-review-workspace-approved.png"
      );
    });
  });

  test.describe("5. IELTS Writing Suite", () => {
    test("Default Task 2 Practice", async ({ page }) => {
      await loadStory(
        page,
        "product-writing-ieltswritingsuite-prototype--default-task-2-practice"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "writing-suite-task2-default.png"
      );
    });

    test("Strict Exam Mode", async ({ page }) => {
      await loadStory(
        page,
        "product-writing-ieltswritingsuite-prototype--strict-exam-mode"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "writing-suite-strict-exam.png"
      );
    });
  });

  test.describe("6. Chat Primitives & Alert", () => {
    test("Message Inbound Assistant", async ({ page }) => {
      await loadStory(page, "product-speaking-message--inbound-assistant");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-message-inbound.png"
      );
    });

    test("Bubble Variants", async ({ page }) => {
      await loadStory(page, "product-speaking-bubble--variants");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-bubble-variants.png"
      );
    });

    test("Marker Default", async ({ page }) => {
      await loadStory(page, "product-speaking-marker--default");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-marker-default.png"
      );
    });

    test("Message Scroller Default", async ({ page }) => {
      await loadStory(page, "product-speaking-messagescroller--default");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-messagescroller-default.png"
      );
    });

    test("Alert Semantic Variants", async ({ page }) => {
      await loadStory(page, "design-system-primitives-alert--default");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "alert-default.png"
      );
    });
  });

  test.describe("7. Dashboard App Shell", () => {
    test("Teacher Default App Shell", async ({ page }) => {
      await loadStory(page, "product-layout-appshell--teacher-default");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "app-shell-teacher-default.png"
      );
    });

    test("Desktop Collapsed App Shell", async ({ page }) => {
      await loadStory(page, "product-layout-appshell--desktop-collapsed");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "app-shell-desktop-collapsed.png"
      );
    });

    test("Mobile Off Canvas Open", async ({ page }) => {
      await loadStory(page, "product-layout-appshell--mobile-off-canvas-open");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "app-shell-mobile-off-canvas-open.png"
      );
    });
  });
});
