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
  await page.waitForTimeout(200);
}

test.describe("Storybook Visual Regression Suite", () => {
  test.describe("1. TeacherReviewAnnotator", () => {
    test("AI Pre-Graded State", async ({ page }) => {
      await loadStory(
        page,
        "ielts-review-teacherreviewannotator--ai-pre-graded"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "teacher-review-annotator-ai-pregraded.png"
      );
    });

    test("Teacher Edits AI Suggestion", async ({ page }) => {
      await loadStory(
        page,
        "ielts-review-teacherreviewannotator--teacher-edits-ai-suggestion"
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
        "ielts-review-teacherreviewworkspace--default-desktop"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "teacher-review-workspace-default.png"
      );
    });

    test("Published Readonly State", async ({ page }) => {
      await loadStory(
        page,
        "ielts-review-teacherreviewworkspace--published-readonly"
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
        "ielts-assessment-assessmentscorecard--interactive-teacher-review"
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
        "speaking-review-teacherspeakingreviewworkspace--default-with-ai-proposal"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "speaking-review-workspace-ai-proposal.png"
      );
    });

    test("Teacher Approved State", async ({ page }) => {
      await loadStory(
        page,
        "speaking-review-teacherspeakingreviewworkspace--teacher-approved"
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
        "ielts-writing-ieltswritingsuite--default-task-2-practice"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "writing-suite-task2-default.png"
      );
    });

    test("Strict Exam Mode", async ({ page }) => {
      await loadStory(
        page,
        "ielts-writing-ieltswritingsuite--strict-exam-mode"
      );
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "writing-suite-strict-exam.png"
      );
    });
  });

  test.describe("6. Chat Primitives & Alert", () => {
    test("Message Inbound Assistant", async ({ page }) => {
      await loadStory(page, "ui-chat-message--inbound-assistant");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-message-inbound.png"
      );
    });

    test("Bubble Variants", async ({ page }) => {
      await loadStory(page, "ui-chat-bubble--variants");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-bubble-variants.png"
      );
    });

    test("Marker Default", async ({ page }) => {
      await loadStory(page, "ui-chat-marker--default");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-marker-default.png"
      );
    });

    test("Message Scroller Default", async ({ page }) => {
      await loadStory(page, "ui-chat-messagescroller--default");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "chat-messagescroller-default.png"
      );
    });

    test("Alert Semantic Variants", async ({ page }) => {
      await loadStory(page, "ui-alert--default");
      await expect(page.locator("#storybook-root")).toHaveScreenshot(
        "alert-default.png"
      );
    });
  });
});
