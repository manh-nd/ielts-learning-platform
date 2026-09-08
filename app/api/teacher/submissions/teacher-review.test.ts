import { describe, it, expect, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import {
  GET as getReviewCockpitRoute,
  PATCH as saveReviewDraftRoute,
} from "./[id]/review/route";
import { POST as startReviewRoute } from "./[id]/start-review/route";
import { POST as publishAssessmentRoute } from "./[id]/publish/route";
import { POST as submitLearnerRoute } from "@/app/api/learner/assignments/[id]/submit/route";
import {
  clearDevClassroomCache,
  createClassroom,
  addMembership,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  clearDevHomeworkCache,
  createAssignment,
} from "@/modules/homework/infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  createInitialSubmissionWithAttempt,
} from "@/modules/homework/infrastructure/homework-submission-repository";
import {
  clearDevHomeworkAssessmentCache,
  saveAiProposal,
} from "@/modules/homework/infrastructure/homework-assessment-repository";

function createAuthHeaders(
  user?: {
    id: string;
    role: "learner" | "teacher";
    name?: string;
    email?: string;
  } | null
): Headers {
  const headers = new Headers();
  if (user) {
    const session = {
      id: `sess_${user.id}`,
      userId: user.id,
      token: `token_${user.id}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const payload = JSON.stringify({ user, session });
    headers.set("cookie", `e2e_mock_session=${encodeURIComponent(payload)}`);
  }
  headers.set("content-type", "application/json");
  return headers;
}

describe("Teacher Review Cockpit API Endpoints (Issue #76, ADR-0008, ADR-0009)", () => {
  const teacherA = {
    id: "teacher_alice",
    role: "teacher" as const,
    name: "Teacher Alice",
    email: "alice@test.com",
  };

  const teacherB = {
    id: "teacher_bob",
    role: "teacher" as const,
    name: "Teacher Bob",
    email: "bob@test.com",
  };

  const learnerUser = {
    id: "learner_dan",
    role: "learner" as const,
    name: "Learner Dan",
    email: "dan@test.com",
  };

  let classroomId: string;
  let assignmentId: string;
  let submissionId: string;
  let attemptId: string;

  beforeEach(async () => {
    clearDevClassroomCache();
    clearDevHomeworkCache();
    clearDevHomeworkSubmissionCache();
    clearDevHomeworkAssessmentCache();

    // Teacher A creates classroom
    const classroom = await createClassroom(teacherA.id, {
      name: "IELTS Advanced Speaking",
      description: "Week 1 Classroom",
    });
    classroomId = classroom.id;

    // Enroll learner
    await addMembership(classroomId, learnerUser.id);

    // Teacher A creates published assignment
    const assignment = await createAssignment({
      classroomId,
      teacherId: teacherA.id,
      title: "Part 1 Hobbies",
      instructions: "Record answers for both questions.",
      prompts: [
        {
          promptId: "prompt_hobby_1",
          text: "What are your hobbies?",
          partNumber: 1,
        },
        {
          promptId: "prompt_hobby_2",
          text: "How much time do you spend on them?",
          partNumber: 1,
        },
      ],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "published",
    });
    assignmentId = assignment.id;

    // Learner Dan submits attempt #1
    const { submission, attempt } = await createInitialSubmissionWithAttempt({
      assignmentId,
      learnerId: learnerUser.id,
      audioResponses: [
        {
          promptId: "prompt_hobby_1",
          storageKey: `homework/${learnerUser.id}/${assignmentId}/p1.webm`,
          durationMs: 40000,
          audioBytes: 150000,
        },
        {
          promptId: "prompt_hobby_2",
          storageKey: `homework/${learnerUser.id}/${assignmentId}/p2.webm`,
          durationMs: 45000,
          audioBytes: 160000,
        },
      ],
      status: "submitted",
    });
    submissionId = submission.id;
    attemptId = attempt.id;

    // Seed AI proposal
    await saveAiProposal({
      id: crypto.randomUUID(),
      submissionId,
      attemptId,
      attemptNumber: 1,
      status: "ready",
      scores: {
        fluencyAndCoherence: 6.5,
        lexicalResource: 6.0,
        grammaticalRangeAndAccuracy: 6.5,
        pronunciation: 6.5,
      },
      overallBand: 6.5,
      feedbackSummary: "Natural pacing with good lexical variety.",
      strengths: ["Clear pronunciation"],
      improvements: ["Use more varied sentence structures"],
      actionPlan: ["Review conditional clauses"],
      pronunciationNotes: [],
      rawProposalJson: null,
      modelVersion: "gemini-2.5-flash",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe("GET /api/teacher/submissions/:id/review", () => {
    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "GET",
          headers: createAuthHeaders(null),
        }
      );

      const res = await getReviewCockpitRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(401);
    });

    it("should reject learner requests with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "GET",
          headers: createAuthHeaders(learnerUser),
        }
      );

      const res = await getReviewCockpitRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject Teacher B accessing Teacher A's submission with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherB),
        }
      );

      const res = await getReviewCockpitRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(403);
    });

    it("should return cockpit data with AI proposal for Teacher A (200 OK)", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );

      const res = await getReviewCockpitRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.submission.id).toBe(submissionId);
      expect(json.aiProposal).not.toBeNull();
      expect(json.reviewAttempt.attemptNumber).toBe(1);
      expect(json.reviewAttempt.audioClips.length).toBe(2);
      expect(json.reviewAttempt.audioClips[0].audioUrl).toBe(
        `/api/teacher/submissions/${submissionId}/audio/prompt_hobby_1`
      );
      expect(json.attempt).toBeUndefined();
    });
  });

  describe("POST /api/teacher/submissions/:id/start-review & Concurrency Lock", () => {
    it("should acquire lock setting status to in_review and locking attempt number", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/start-review`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
        }
      );

      const res = await startReviewRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.submission.status).toBe("in_review");
      expect(json.submission.reviewedAttemptNumber).toBe(1);
    });

    it("should reject learner resubmissions with 409 Conflict (SUBMISSION_UNDER_REVIEW) once review starts", async () => {
      // 1. Teacher starts review
      const startReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/start-review`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
        }
      );
      const startRes = await startReviewRoute(startReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(startRes.status).toBe(200);

      // 2. Learner attempts resubmission
      const submitReq = new NextRequest(
        `http://localhost/api/learner/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: createAuthHeaders(learnerUser),
          body: JSON.stringify({
            audioResponses: [
              {
                promptId: "prompt_hobby_1",
                storageKey: `homework/${learnerUser.id}/${assignmentId}/p1_v2.webm`,
                durationMs: 42000,
                audioBytes: 155000,
              },
              {
                promptId: "prompt_hobby_2",
                storageKey: `homework/${learnerUser.id}/${assignmentId}/p2_v2.webm`,
                durationMs: 44000,
                audioBytes: 162000,
              },
            ],
          }),
        }
      );

      const submitRes = await submitLearnerRoute(submitReq, {
        params: Promise.resolve({ id: assignmentId }),
      });
      expect(submitRes.status).toBe(409);

      const submitJson = await submitRes.json();
      expect(submitJson.error.code).toBe("SUBMISSION_UNDER_REVIEW");
    });
  });

  describe("POST /api/teacher/submissions/:id/publish", () => {
    it("should reject invalid scores (> 9.0 or not multiple of 0.5) with 400 Bad Request", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/publish`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 9.2, // Invalid step
            lexicalResource: 7.0,
            grammaticalRangeAccuracy: 7.0,
            pronunciation: 7.0,
            overallFeedback: "Good job",
            activeReviewDurationMs: 60000,
          }),
        }
      );

      const res = await publishAssessmentRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(400);
    });

    it("should reject empty overall feedback with 400 Bad Request", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/publish`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 7.0,
            lexicalResource: 7.0,
            grammaticalRangeAccuracy: 7.0,
            pronunciation: 7.0,
            overallFeedback: "   ",
            activeReviewDurationMs: 60000,
          }),
        }
      );

      const res = await publishAssessmentRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(400);
    });

    it("should atomically publish assessment, freeze published snapshot, and record calibration", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/publish`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 7.0,
            lexicalResource: 6.5,
            grammaticalRangeAccuracy: 7.0,
            pronunciation: 6.5,
            overallFeedback:
              "Excellent responses! Very natural flow and clear articulation.",
            criteriaFeedback: {
              fluencyCoherence: "Impressive discourse markers.",
            },
            activeReviewDurationMs: 145000,
          }),
        }
      );

      const res = await publishAssessmentRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.submission.status).toBe("published");
      expect(json.teacherAssessment.overallBand).toBe(7.0);
      expect(json.publishedAssessment.id).not.toBe(json.teacherAssessment.id);
      expect(json.publishedAssessment.overallBand).toBe(7.0);
      expect(json.evaluationFeedback.activeReviewDurationMs).toBe(145000);
      expect(json.evaluationFeedback.aiProposalAccepted).toBe(true);
    });

    it("should reject subsequent publish attempts with 409 Conflict", async () => {
      // 1. First publish
      const firstReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/publish`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 7.0,
            lexicalResource: 7.0,
            grammaticalRangeAccuracy: 7.0,
            pronunciation: 7.0,
            overallFeedback: "First publish",
            activeReviewDurationMs: 80000,
          }),
        }
      );
      const firstRes = await publishAssessmentRoute(firstReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(firstRes.status).toBe(200);

      // 2. Second publish attempt on same submission
      const secondReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/publish`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 7.5,
            lexicalResource: 7.5,
            grammaticalRangeAccuracy: 7.5,
            pronunciation: 7.5,
            overallFeedback: "Second publish attempt",
            activeReviewDurationMs: 30000,
          }),
        }
      );
      const secondRes = await publishAssessmentRoute(secondReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(secondRes.status).toBe(409);
    });
  });

  describe("PATCH /api/teacher/submissions/:id/review (Issue #102)", () => {
    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "PATCH",
          headers: createAuthHeaders(null),
          body: JSON.stringify({
            fluencyCoherence: 6.5,
            lexicalResource: 6.5,
            grammaticalRangeAccuracy: 6.5,
            pronunciation: 6.5,
            overallFeedback: "",
            annotations: [],
          }),
        }
      );
      const res = await saveReviewDraftRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(401);
    });

    it("should reject learner requests with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "PATCH",
          headers: createAuthHeaders(learnerUser),
          body: JSON.stringify({
            fluencyCoherence: 6.5,
            lexicalResource: 6.5,
            grammaticalRangeAccuracy: 6.5,
            pronunciation: 6.5,
            overallFeedback: "",
            annotations: [],
          }),
        }
      );
      const res = await saveReviewDraftRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject non-owner teacher requests with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherB),
          body: JSON.stringify({
            fluencyCoherence: 6.5,
            lexicalResource: 6.5,
            grammaticalRangeAccuracy: 6.5,
            pronunciation: 6.5,
            overallFeedback: "",
            annotations: [],
          }),
        }
      );
      const res = await saveReviewDraftRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject draft save before review is claimed with 409 Conflict (REVIEW_NOT_STARTED)", async () => {
      const patchReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 6.5,
            lexicalResource: 6.5,
            grammaticalRangeAccuracy: 6.5,
            pronunciation: 6.5,
            overallFeedback: "Draft before claim",
            annotations: [],
          }),
        }
      );
      const patchRes = await saveReviewDraftRoute(patchReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(patchRes.status).toBe(409);
      const json = await patchRes.json();
      expect(json.error.code).toBe("REVIEW_NOT_STARTED");
    });

    it("should save valid draft with annotations, and GET returns saved annotations", async () => {
      // 1. First claim review
      const startReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/start-review`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
        }
      );
      const startRes = await startReviewRoute(startReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(startRes.status).toBe(200);

      const firstPrompt = "prompt_hobby_1";
      const draftPayload = {
        fluencyCoherence: 7.0,
        lexicalResource: 6.5,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: 7.5,
        overallFeedback: "Bản nháp nhận xét tốt",
        annotations: [
          {
            id: "ann_api_1",
            promptId: firstPrompt,
            partNumber: 1,
            timestampSeconds: 10.5,
            category: "pronunciation",
            teacherComment: "Cần cải thiện âm đuôi /z/",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      // 2. PATCH saves draft
      const patchReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify(draftPayload),
        }
      );
      const patchRes = await saveReviewDraftRoute(patchReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.success).toBe(true);
      expect(patchJson.teacherDraft.annotations).toHaveLength(1);
      expect(patchJson.teacherDraft.annotations[0].promptId).toBe(firstPrompt);
      expect(patchJson.teacherDraft.annotations[0].teacherComment).toBe(
        "Cần cải thiện âm đuôi /z/"
      );

      // 3. GET review returns the saved draft annotations
      const getReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const getRes = await getReviewCockpitRoute(getReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.teacherDraft).not.toBeNull();
      expect(getJson.teacherDraft.annotations).toHaveLength(1);
      expect(getJson.teacherDraft.annotations[0].id).toBe("ann_api_1");
    });

    it("should reject invalid annotation (invalid category) with 400 Bad Request", async () => {
      // 1. Claim review first
      const startReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/start-review`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
        }
      );
      await startReviewRoute(startReq, {
        params: Promise.resolve({ id: submissionId }),
      });

      const req = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 6.5,
            lexicalResource: 6.5,
            grammaticalRangeAccuracy: 6.5,
            pronunciation: 6.5,
            overallFeedback: "",
            annotations: [
              {
                id: "ann_inv",
                promptId: "p_part1_1",
                partNumber: 1,
                timestampSeconds: 5.0,
                category: "general", // obsolete category
                teacherComment: "Test",
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        }
      );
      const res = await saveReviewDraftRoute(req, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(res.status).toBe(400);
    });

    it("should reject draft save on published submission with 409 Conflict", async () => {
      // First publish
      const pubReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/publish`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 7.0,
            lexicalResource: 7.0,
            grammaticalRangeAccuracy: 7.0,
            pronunciation: 7.0,
            overallFeedback: "Official feedback",
            activeReviewDurationMs: 60000,
          }),
        }
      );
      await publishAssessmentRoute(pubReq, {
        params: Promise.resolve({ id: submissionId }),
      });

      // Try to save draft
      const patchReq = new NextRequest(
        `http://localhost/api/teacher/submissions/${submissionId}/review`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            fluencyCoherence: 7.0,
            lexicalResource: 7.0,
            grammaticalRangeAccuracy: 7.0,
            pronunciation: 7.0,
            overallFeedback: "",
            annotations: [],
          }),
        }
      );
      const patchRes = await saveReviewDraftRoute(patchReq, {
        params: Promise.resolve({ id: submissionId }),
      });
      expect(patchRes.status).toBe(409);
    });
  });
});
