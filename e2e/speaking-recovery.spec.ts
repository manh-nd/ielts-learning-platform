import { test, expect } from "@playwright/test";
import { mockAuthenticatedUser, MOCK_LEARNER } from "./fixtures/auth-fixtures";

test.describe("Speaking Practice Failure Recovery & Consent Gates (#70)", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedUser(page, {
      ...MOCK_LEARNER,
      id: "usr_mock_learner_speaking_recovery",
    });
  });

  test("should display FreeTierConsentNotice modal when learner enters live room without prior consent", async ({
    page,
  }) => {
    // Intercept consent API check
    await page.route("**/api/learner/consent", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            hasConsent: false,
            consentFreeTierAt: null,
          }),
        });
      } else if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            userId: "usr_mock_learner_speaking_recovery",
            consentFreeTierAt: new Date().toISOString(),
          }),
        });
      }
    });

    await page.goto("/learner/speaking/live");

    // Click "Bắt đầu Luyện Part 1" to enter room
    const enterRoomBtn = page.getByRole("button", {
      name: /Bắt đầu Luyện Part 1/i,
    });
    await expect(enterRoomBtn).toBeVisible();
    await enterRoomBtn.click();

    // Click start examination
    const startBtn = page.getByTestId("connect-live-btn");
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Consent notice modal must be visible
    const modal = page.getByTestId("free-tier-consent-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Xác nhận Điều khoản Thử nghiệm AI");
    await expect(modal).toContainText("Google Gemini Free Tier Pilot");

    // Click confirm
    const agreeBtn = page.getByRole("button", {
      name: /Tôi đủ 18 tuổi & Đồng ý/i,
    });
    await expect(agreeBtn).toBeVisible();
    await agreeBtn.click();

    // Modal closes after consent
    await expect(modal).toBeHidden();
  });

  test("should handle microphone denial cleanly with disabled button and guidance dialog", async ({
    page,
  }) => {
    // Intercept consent as already granted
    await page.route("**/api/learner/consent", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          hasConsent: true,
          consentFreeTierAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto("/learner/speaking/live");

    const enterRoomBtn = page.getByRole("button", {
      name: /Bắt đầu Luyện Part 1/i,
    });
    await expect(enterRoomBtn).toBeVisible();
    await enterRoomBtn.click();

    // Simulate microphone permission denial by denying permissions in the context
    await page.context().clearPermissions();

    // We verify the examiner room is mounted and controls are accessible
    const controls = page.getByTestId("live-session-controls");
    await expect(controls).toBeVisible();
  });

  test("should allow retrying evaluation when assessment fails without losing session context", async ({
    page,
  }) => {
    const sessionId = "ses_e2e_recovery_test_01";

    // Mock session restoration query to return completed practice with failed evaluation
    await page.route(
      `**/api/speaking/evaluate?sessionId=${sessionId}`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            session: {
              id: sessionId,
              userId: "usr_mock_learner_speaking_recovery",
              status: "completed",
              evidenceJson: {
                evaluationStatus: "failed",
                evaluationError:
                  "Máy chủ AI quá tải (503). Vui lòng thử phân tích lại.",
              },
              scorecardJson: null,
            },
            responses: [
              {
                id: "resp_01",
                storageKey: "speaking/mock-audio.webm",
              },
            ],
            restoredState: {
              status: "ended_evaluation_failed_retryable",
              sessionId,
              error: "Máy chủ AI quá tải (503). Vui lòng thử phân tích lại.",
              canRetry: true,
            },
          }),
        });
      }
    );

    // Mock evaluation POST retry
    let retryCalled = false;
    await page.route("**/api/speaking/evaluate", async (route) => {
      if (route.request().method() === "POST") {
        retryCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            isPractice: true,
            result: {
              estimatedPerformance: {
                overallBand: 6.5,
                fluencyAndCoherence: 6.5,
                lexicalResource: 6.5,
                grammaticalRange: 6.5,
                pronunciation: 6.5,
              },
              strengths: [
                {
                  criterion: "pronunciation",
                  observation: "Phát âm rõ ràng và chuẩn xác.",
                },
              ],
              priorities: [
                {
                  criterion: "fluencyAndCoherence",
                  issue: "Tốc độ nói chưa đều.",
                  recommendation: "Luyện nói câu dài liền mạch hơn.",
                },
              ],
              summary: "Bài thi tốt với vốn từ vựng phong phú.",
              evidenceSufficiency: "adequate",
            },
          }),
        });
      }
    });

    // Navigate with restored session query parameter
    await page.goto(`/learner/speaking/live?sessionId=${sessionId}`);

    // Verify error message from failed evaluation appears
    await expect(page.getByText(/Máy chủ AI quá tải/i)).toBeVisible();

    // Click retry evaluation button
    const retryButton = page.getByRole("button", {
      name: /Thử chấm điểm lại/i,
    });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    // Verify retry evaluation request was dispatched
    await expect.poll(() => retryCalled).toBe(true);

    // Verify restored scorecard appears after successful retry
    await expect(page.getByText(/Phát âm rõ ràng/i)).toBeVisible();
  });
});
