import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  MOCK_TEACHER,
  MOCK_LEARNER,
} from "./fixtures/auth-fixtures";

test.describe("Speaking Homework End-to-End Workflow (#77, ADR-0008, ADR-0009)", () => {
  test("Full Golden Path: Assign -> Submit -> AI Proposal -> Teacher Review & Publish -> Learner Published Assessment View", async ({
    page,
    request,
  }) => {
    // 1. Setup Teacher session and create Classroom + Assignment with 2 prompts
    await mockAuthenticatedUser(page, MOCK_TEACHER);

    const teacherAuthHeader = {
      cookie: `e2e_mock_session=${encodeURIComponent(
        JSON.stringify({
          user: MOCK_TEACHER,
          session: {
            id: `sess_${MOCK_TEACHER.id}`,
            userId: MOCK_TEACHER.id,
            token: `token_${MOCK_TEACHER.id}`,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        })
      )}`,
      "content-type": "application/json",
    };

    const learnerAuthHeader = {
      cookie: `e2e_mock_session=${encodeURIComponent(
        JSON.stringify({
          user: MOCK_LEARNER,
          session: {
            id: `sess_${MOCK_LEARNER.id}`,
            userId: MOCK_LEARNER.id,
            token: `token_${MOCK_LEARNER.id}`,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        })
      )}`,
      "content-type": "application/json",
    };

    // Step 1: Teacher creates classroom
    const createClassRes = await request.post("/api/teacher/classrooms", {
      headers: teacherAuthHeader,
      data: {
        name: "IELTS Speaking Golden Path Cohort",
        description: "Automated test cohort for homework golden path",
      },
    });
    expect(createClassRes.status()).toBe(201);
    const classData = await createClassRes.json();
    const classroomId = classData.classroom.id;

    // Step 2: Teacher enrolls learner
    const enrollRes = await request.post(
      `/api/teacher/classrooms/${classroomId}/members`,
      {
        headers: teacherAuthHeader,
        data: {
          email: MOCK_LEARNER.email,
        },
      }
    );
    expect(enrollRes.status()).toBe(201);

    // Step 3: Teacher creates & publishes Homework Assignment with 2 prompt items
    const futureDeadline = new Date(Date.now() + 86400000).toISOString();
    const createAsgRes = await request.post(
      `/api/teacher/classrooms/${classroomId}/assignments`,
      {
        headers: teacherAuthHeader,
        data: {
          title: "IELTS Speaking Part 1 & 2: Travel & Exploration",
          instructions: "Answer all questions clearly and fluently.",
          prompts: [
            {
              promptId: "p_trav_1",
              partNumber: 1,
              text: "Do you prefer traveling alone or with a group of friends? Why?",
            },
            {
              promptId: "p_trav_2",
              partNumber: 2,
              text: "Describe a memorable vacation you have taken.",
              subPrompts: [
                "Where you went",
                "Who you went with",
                "What you did there",
              ],
            },
          ],
          submissionDeadline: futureDeadline,
          status: "published",
        },
      }
    );
    expect(createAsgRes.status()).toBe(201);
    const asgData = await createAsgRes.json();
    const assignmentId = asgData.assignment.id;

    // Step 4: Switch to Learner session and visit assignment page
    await mockAuthenticatedUser(page, MOCK_LEARNER);
    await page.goto(`/learner/assignments/${assignmentId}`);

    // Verify assignment page mounts and shows both prompts
    await expect(
      page.getByTestId("learner-homework-recording-view")
    ).toBeVisible();
    await expect(page.getByTestId("prompt-card-p_trav_1")).toBeVisible();
    await expect(page.getByTestId("prompt-card-p_trav_2")).toBeVisible();

    // Step 5: Learner submits homework (via API with valid storage keys)
    const submitRes = await request.post(
      `/api/learner/assignments/${assignmentId}/submit`,
      {
        headers: learnerAuthHeader,
        data: {
          audioResponses: [
            {
              promptId: "p_trav_1",
              storageKey: `homework/${MOCK_LEARNER.id}/${assignmentId}/p_trav_1/clip1.webm`,
              durationMs: 42000,
              audioBytes: 65000,
            },
            {
              promptId: "p_trav_2",
              storageKey: `homework/${MOCK_LEARNER.id}/${assignmentId}/p_trav_2/clip2.webm`,
              durationMs: 110000,
              audioBytes: 150000,
            },
          ],
        },
      }
    );
    expect(submitRes.status()).toBe(201);
    const submitData = await submitRes.json();
    const submissionId = submitData.submission.id;

    // Reload page as learner to verify submitted state
    await page.reload();
    await expect(page.getByTestId("submission-success-banner")).toBeVisible();

    // Step 6: Switch back to Teacher session and open Review Cockpit
    await mockAuthenticatedUser(page, MOCK_TEACHER);
    await page.goto(`/teacher/submissions/${submissionId}`);

    // Verify Review Cockpit is loaded
    await expect(page.getByTestId("teacher-review-cockpit")).toBeVisible();

    // Start Review (First-Committed-Wins Lock)
    const startReviewBtn = page.getByTestId("start-review-button");
    await expect(startReviewBtn).toBeVisible();
    await startReviewBtn.click();

    // Verify status transitions to In Review
    await expect(page.getByTestId("submission-status-badge")).toHaveText(
      /Đang Chấm Bài/i
    );

    // Teacher inputs overall feedback and publishes assessment
    const feedbackTextarea = page.getByTestId("overall-feedback-textarea");
    await feedbackTextarea.fill(
      "Bài nói rất ấn tượng! Tốc độ nói tự nhiên, ngữ âm rõ ràng và từ vựng phong phú. Em đã phát triển tốt các ý trong Part 2."
    );

    // Teacher clicks Publish
    const publishBtn = page.getByTestId("publish-assessment-button");
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // Verify status transitions to Published
    await expect(page.getByTestId("submission-status-badge")).toHaveText(
      /Đã Công Bố/i
    );

    // Step 7: Switch to Learner session and visit Published Result page
    await mockAuthenticatedUser(page, MOCK_LEARNER);
    await page.goto(`/learner/assignments/${assignmentId}/result`);

    // Verify Learner Published Assessment View mounts
    await expect(
      page.getByTestId("learner-published-assessment-view")
    ).toBeVisible();

    // Verify Official Published Badge
    await expect(page.getByTestId("published-badge")).toBeVisible();
    await expect(page.getByTestId("published-badge")).toHaveText(
      /Kết quả chính thức/i
    );

    // Verify IELTS Overall Band Hero Card
    const overallBandCard = page.getByTestId("overall-band-card");
    await expect(overallBandCard).toBeVisible();
    await expect(page.getByTestId("overall-band-badge")).toBeVisible();

    // Verify 4 Criteria scores are visible
    await expect(page.getByTestId("score-fc")).toBeVisible();
    await expect(page.getByTestId("score-lr")).toBeVisible();
    await expect(page.getByTestId("score-gra")).toBeVisible();
    await expect(page.getByTestId("score-pr")).toBeVisible();

    // Verify Teacher overall feedback
    const feedbackElement = page.getByTestId("teacher-overall-feedback-text");
    await expect(feedbackElement).toBeVisible();
    await expect(feedbackElement).toContainText("Bài nói rất ấn tượng!");

    // Verify Audio Replay Card & Controls
    await expect(page.getByTestId("audio-replay-card")).toBeVisible();
    await expect(page.getByTestId("prompt-tab-p_trav_1")).toBeVisible();
    await expect(page.getByTestId("prompt-tab-p_trav_2")).toBeVisible();

    const togglePlayBtn = page.getByTestId("toggle-play-button");
    await expect(togglePlayBtn).toBeVisible();
    await expect(togglePlayBtn).toHaveText(/Phát lại/i);

    // Toggle play
    await togglePlayBtn.click();
    await expect(togglePlayBtn).toHaveText(/Tạm dừng/i);
    await togglePlayBtn.click();
    await expect(togglePlayBtn).toHaveText(/Phát lại/i);

    // Invariant Check: Verify NO raw AI proposals or internal draft data are leaked
    await expect(page.locator("body")).not.toContainText(
      "AiAssessmentProposal"
    );
    await expect(page.locator("body")).not.toContainText("rawProposalJson");
    await expect(page.locator("body")).not.toContainText(
      "active_review_duration_ms"
    );
  });

  test("First-Committed-Wins Concurrency Lock: Teacher Start Review blocks Learner Resubmit with HTTP 409 Conflict", async ({
    page,
    request,
  }) => {
    const teacherAuthHeader = {
      cookie: `e2e_mock_session=${encodeURIComponent(
        JSON.stringify({
          user: MOCK_TEACHER,
          session: {
            id: `sess_${MOCK_TEACHER.id}`,
            userId: MOCK_TEACHER.id,
            token: `token_${MOCK_TEACHER.id}`,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        })
      )}`,
      "content-type": "application/json",
    };

    const learnerAuthHeader = {
      cookie: `e2e_mock_session=${encodeURIComponent(
        JSON.stringify({
          user: MOCK_LEARNER,
          session: {
            id: `sess_${MOCK_LEARNER.id}`,
            userId: MOCK_LEARNER.id,
            token: `token_${MOCK_LEARNER.id}`,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        })
      )}`,
      "content-type": "application/json",
    };

    // 1. Teacher creates classroom & assignment
    const createClassRes = await request.post("/api/teacher/classrooms", {
      headers: teacherAuthHeader,
      data: {
        name: "IELTS Concurrency Lock Class",
      },
    });
    const classData = await createClassRes.json();
    const classroomId = classData.classroom.id;

    await request.post(`/api/teacher/classrooms/${classroomId}/members`, {
      headers: teacherAuthHeader,
      data: { email: MOCK_LEARNER.email },
    });

    const createAsgRes = await request.post(
      `/api/teacher/classrooms/${classroomId}/assignments`,
      {
        headers: teacherAuthHeader,
        data: {
          title: "Speaking Concurrency Assignment",
          prompts: [
            {
              promptId: "p_conc_1",
              partNumber: 1,
              text: "Tell me about your morning routine.",
            },
          ],
          submissionDeadline: new Date(Date.now() + 86400000).toISOString(),
          status: "published",
        },
      }
    );
    const asgData = await createAsgRes.json();
    const assignmentId = asgData.assignment.id;

    // 2. Learner submits attempt #1
    const submitRes = await request.post(
      `/api/learner/assignments/${assignmentId}/submit`,
      {
        headers: learnerAuthHeader,
        data: {
          audioResponses: [
            {
              promptId: "p_conc_1",
              storageKey: `homework/${MOCK_LEARNER.id}/${assignmentId}/p_conc_1/clip1.webm`,
              durationMs: 30000,
              audioBytes: 45000,
            },
          ],
        },
      }
    );
    expect(submitRes.status()).toBe(201);
    const submitData = await submitRes.json();
    const submissionId = submitData.submission.id;

    // 3. Teacher starts review, triggering First-Committed-Wins Concurrency Lock
    const startReviewRes = await request.post(
      `/api/teacher/submissions/${submissionId}/start-review`,
      {
        headers: teacherAuthHeader,
      }
    );
    expect(startReviewRes.status()).toBe(200);

    // 4. Learner attempts to resubmit while under review
    const resubmitRes = await request.post(
      `/api/learner/assignments/${assignmentId}/submit`,
      {
        headers: learnerAuthHeader,
        data: {
          audioResponses: [
            {
              promptId: "p_conc_1",
              storageKey: `homework/${MOCK_LEARNER.id}/${assignmentId}/p_conc_1/clip1_v2.webm`,
              durationMs: 35000,
              audioBytes: 50000,
            },
          ],
        },
      }
    );

    // Verify HTTP 409 Conflict rejection
    expect(resubmitRes.status()).toBe(409);
    const conflictData = await resubmitRes.json();
    expect(conflictData.error.code).toBe("SUBMISSION_UNDER_REVIEW");
    expect(conflictData.error.message).toContain(
      "Bài làm đã được Giáo viên tiếp nhận chấm"
    );

    // 5. Learner visits UI: verify conflict lock banner is rendered
    await mockAuthenticatedUser(page, MOCK_LEARNER);
    await page.goto(`/learner/assignments/${assignmentId}`);

    const conflictBanner = page.getByTestId("conflict-warning-banner");
    await expect(conflictBanner).toBeVisible();
    await expect(conflictBanner).toContainText(
      "Bài làm đã được Giáo viên tiếp nhận chấm điểm"
    );
  });
});
