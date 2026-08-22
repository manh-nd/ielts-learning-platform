# Async AI dispatch via Next.js after() + ai_proposals table

Issue #5 decided synchronous on-demand AI assessment (teacher clicks "Get AI"). We override this to auto-trigger AI assessment asynchronously when a learner submits, using Next.js `after()` for fire-and-forget dispatch and a dedicated `ai_proposals` table to track status. The `ai_proposals` table is separate from `homework_assessments` because they are born at different times: AI dispatch fires on submission, while `HomeworkAssessment` is created when the teacher starts review. If AI fails, the teacher sees the status and can retry manually or skip and grade without AI (HOMEWORK-03, ASSESSMENT-02). The `HomeworkAssessment` state machine (Created → TeacherAssessed → Approved → Published) is unchanged — AI dispatch status is orthogonal data, not a state gate.

## Considered Options

- **On-demand sync** (#5's original decision): teacher clicks "Get AI", waits ~3-5s. Simpler but teacher always waits; AI could be ready before they look.
- **Full job queue** (BullMQ, Inngest): proper retry, visibility, dead-letter. Overkill for MVP — adds infrastructure dependency.
- **after() + ai_proposals table** (chosen): zero infrastructure, AI pre-computes while teacher hasn't opened the review yet. Manual retry covers failure cases. Swap `after()` for a queue later without changing the domain model.
