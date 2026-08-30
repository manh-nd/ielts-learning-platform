# ADR-0009: MVP Domain Aggregate Roots and Consistency Boundaries for IELTS Speaking

**Status:** Accepted  
**Date:** 2026-08-30  
**Target Module:** Speaking Domain, Homework Submission, Practice, AI Evaluation

---

## Context & Problem

The IELTS Speaking domain involves distinct workflows across Learner self-service practice and Classroom homework assignments. We needed to establish clean consistency boundaries and aggregate roots for the Pilot MVP that:

1. Prevent race conditions and state machine deadlocks (e.g. Learner resubmission vs. Teacher review lock, async AI evaluation vs. finalized submissions).
2. Avoid speculative generic abstractions (such as generic `SpeakingSession`, `EvaluationResult`, or shared assessment hierarchies) that conflate learner-facing coaching with official teacher evaluations.
3. Establish clear ownership and immutability for audio evidence, derived transcripts, review drafts, and publication.

---

## Decisions

### 1. 5 Core MVP Aggregate Roots

We partition the IELTS Speaking domain into exactly 5 Aggregate Roots:

1. **`SpeakingPractice`**: Learner-owned practice session containing selected prompt scope, audio evidence links, and derived transcript with optional correction.
2. **`HomeworkAssignment`**: Teacher-owned assignment bound to a Classroom, holding 1–3 immutable prompts, deadline, and assignment status.
3. **`HomeworkSubmission`**: Scoped to `1 Learner + 1 HomeworkAssignment`. Encapsulates immutable `SubmissionAttempt` history, current attempt pointer, Teacher review lock (`ReviewTarget`), editable `TeacherReviewDraft`, and atomic `PublishedAssessment`.
4. **`PracticeEvaluation`**: Manages asynchronous AI evaluation lifecycle for a `SpeakingPractice`, tracking `EvaluationRun`s and producing learner-facing `PracticeFeedback`.
5. **`HomeworkEvaluation`**: Manages asynchronous AI evaluation lifecycle for a `SubmissionAttempt`, tracking `EvaluationRun`s and producing teacher-facing `AiAssessmentProposal`.

### 2. Entity & Value Object Ownership (Audio, Transcripts, Rubrics, Drafts)

- **Audio & Transcripts are NOT Aggregate Roots**: Original audio is authoritative evidence owned by `SpeakingPractice` or `SubmissionAttempt`. Transcripts are derived evidence. MVP transcript correction stores original + optional corrected transcript without a complex revision-history subsystem.
- **`IeltsRubric`**: An immutable domain definition referenced by version (`rubricVersion` / `EvaluationPolicyVersion`). No dynamic rubric aggregate in MVP.
- **`TeacherReviewDraft`**: A simple internal entity inside `HomeworkSubmission` attached to the `ReviewTarget` attempt; not a standalone aggregate.

### 3. Concurrency & Lifecycle Invariants

- **AI Failure & Lifecycle Decoupling**: AI evaluation completion or failure never alters the state of an already-ended `SpeakingPractice` (`EvaluationFailed != PracticeFailed`) or committed `HomeworkSubmission` (`AiEvaluationFailed != SubmissionFailed`).
- **First-Committed-Wins**: Race conditions between Learner Resubmit and Teacher Start Review resolve to whichever transaction commits first.
- **Single-Action Atomic Publish**: Publishing finalizes `TeacherAssessment` into `PublishedAssessment` and transitions `HomeworkSubmission` to terminal in one step (`Publish = Finalize + MakeOfficial`).
- **Late AI Results Resilience**: AI proposals arriving late or after retries never overwrite `TeacherReviewDraft` or alter `PublishedAssessment`.
- **Non-Overwriting Evaluation Runs**: AI retries create new `EvaluationRun` records without overwriting historical runs.

---

## Consequences

- **Domain Clarity**: Clear separation between learner coaching (`PracticeFeedback`) and authoritative grading (`AiAssessmentProposal` -> `TeacherAssessment` -> `PublishedAssessment`).
- **Resilience**: Prevents distributed race conditions and queue deadlocks by keeping asynchronous AI lifecycles in separate aggregates.
- **Minimal MVP Footprint**: Avoids over-engineered abstractions while preserving critical invariants.
