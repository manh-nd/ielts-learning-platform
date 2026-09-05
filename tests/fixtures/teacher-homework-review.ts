import {
  clearDevHomeworkCache,
  createAssignment,
} from "@/modules/homework/infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  createInitialSubmissionWithAttempt,
} from "@/modules/homework/infrastructure/homework-submission-repository";
import { clearDevHomeworkAssessmentCache } from "@/modules/homework/infrastructure/homework-assessment-repository";
import {
  clearDevClassroomCache,
  createClassroom,
  addMembership,
} from "@/modules/classroom/infrastructure/classroom-repository";

export const teacherId = "teacher_owner";
export const otherTeacherId = "teacher_stranger";
export const learnerId = "learner_123";

export async function createTeacherHomeworkReviewFixture() {
  clearDevHomeworkCache();
  clearDevHomeworkSubmissionCache();
  clearDevHomeworkAssessmentCache();
  clearDevClassroomCache();

  // Setup classroom owned by teacherId
  const classroom = await createClassroom(teacherId, {
    name: "IELTS Masterclass",
    description: "Classroom for pilot testing",
  });
  const classroomId = classroom.id;

  // Enroll learner
  await addMembership(classroomId, learnerId);

  // Create published assignment with 2 prompts
  const assignment = await createAssignment({
    classroomId,
    teacherId,
    title: "Speaking Homework Week 1",
    instructions: "Answer both prompts carefully.",
    prompts: [
      {
        promptId: "prompt_p1_1",
        text: "Do you like flowers?",
        partNumber: 1,
      },
      {
        promptId: "prompt_p1_2",
        text: "What is your favorite flower?",
        partNumber: 1,
      },
    ],
    submissionDeadline: new Date(Date.now() + 86400000), // Tomorrow
    status: "published",
  });
  const assignmentId = assignment.id;

  // Learner submits attempt #1
  const { submission, attempt } = await createInitialSubmissionWithAttempt({
    assignmentId,
    learnerId,
    audioResponses: [
      {
        promptId: "prompt_p1_1",
        storageKey: `homework/${learnerId}/${assignmentId}/p1.webm`,
        durationMs: 45000,
        audioBytes: 150000,
      },
      {
        promptId: "prompt_p1_2",
        storageKey: `homework/${learnerId}/${assignmentId}/p2.webm`,
        durationMs: 38000,
        audioBytes: 120000,
      },
    ],
    status: "submitted",
  });
  return {
    classroomId,
    assignmentId,
    submissionId: submission.id,
    attemptId: attempt.id,
  };
}
