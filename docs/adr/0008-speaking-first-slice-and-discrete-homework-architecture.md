# ADR-0008: Speaking-First Slice, Modality Separation, and AI Calibration Dataset Architecture

**Status:** Accepted  
**Date:** 2026-08-28  
**Target Module:** Curriculum, Speaking Infrastructure, Homework Assessment, Evaluation Feedback

---

## Context & Problem

Based on the initial stakeholder requirements in the PRD, the platform's primary urgent deliverable is the **AI-assisted Speaking Assessment & Teacher Review Pipeline**.

Additionally, previous drafts did not distinguish the modality requirements between:

1. **Speaking Discrete Homework**: Individual prompt clips (e.g. 1 cue card or 3 part 1 questions) assigned per classroom with required teacher review and approval.
2. **Speaking Continuous Mock Test**: 3-part continuous exam simulation randomly drawn from the quarterly active prompt bank with instant AI publication.

Furthermore, the stakeholder requirements (§5.4) mandated a clean data collection infrastructure (AI proposal vs Teacher final assessment vs calculated score deltas) to train future AI iterations.

---

## Decisions

### 1. Speaking-First MVP Delivery Priority

We elevate the Speaking assessment slice (learner recording, 2-stage Gemini evaluation, timestamped teacher review annotator, approval, and publication) to MVP Priority #1.

### 2. Modality Separation: Discrete Homework vs Continuous Mock Test

- **Homework Flow**: Teachers assign discrete prompt items (`SpeakingDiscreteHomework`). Audio clips are recorded and evaluated individually. Results enter `UnderReview` state and require explicit Teacher `ApproveAssessment` and `PublishAssessment`.
- **Mock Test Flow**: Learners take an unguided full 3-part session (`SpeakingContinuousMockTest`) drawn randomly from the active prompt bank (`ActivePrompt`). Results are directly published upon AI evaluation completion (`MOCKTEST-01`).

### 3. Dedicated AI Calibration Dataset Persistence

To fulfill the stakeholder clean-data collection requirement (§5.4) without complex infrastructure:

- We persist `ai_assessment_proposals` containing untouched AI evaluations.
- We persist `homework_assessments` containing the official teacher-approved scores and modifications.
- On teacher approval/publication, the system automatically computes and stores structured difference records in `evaluation_feedbacks` (criterion score deltas, accepted/modified/rejected annotations, and teacher additions).

---

## Consequences

- **Aligned Product Velocity**: Directly delivers the stakeholder's highest-priority pain point first.
- **Data Integrity for Future AI**: Creates a high-trust fine-tuning dataset without manual exporter overhead.
- **Architectural Clarity**: Clear separation between asynchronous teacher-reviewed assignments and instant mock practice tests.
