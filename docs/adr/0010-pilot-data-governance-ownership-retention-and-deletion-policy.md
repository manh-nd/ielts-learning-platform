# ADR-0010: Data Governance, Ownership, Retention, and Deletion Policy for IELTS Speaking Pilot

**Status:** Accepted  
**Date:** 2026-09-03  
**Target Module:** Speaking Domain, Data Governance, Storage Pipeline, User Consent & Privacy

---

## Context & Problem

Following privacy legal research ([#59](https://github.com/manh-nd/ielts-learning-platform/issues/59)) under Vietnam's legal framework (Luật 91/2025/QH15 and Nghị định 356/2025/NĐ-CP) and existing domain contracts ([#51](https://github.com/manh-nd/ielts-learning-platform/issues/51), [#61](https://github.com/manh-nd/ielts-learning-platform/issues/61), [ADR-0009](docs/adr/0009-mvp-domain-aggregate-roots-and-consistency-boundaries.md)), the platform requires an authoritative Data Governance Policy for the Pilot MVP.

We needed to resolve 5 key dimensions:

1. Teacher access boundaries for private `SpeakingPractice` vs formal `HomeworkSubmission`.
2. Retention durations, auto-purge lifecycles, and Right to Erasure (deletion) for original audio recordings on S3/SeaweedFS.
3. Classroom access controls and dispute/audit retention windows for homework assignments.
4. Provenance tracking for AI proposals vs Teacher modifications.
5. Google Gemini API tier selection, data collection disclosure, and zero platform model training invariants.

---

## Decisions

### 1. Speaking Practice: Private Learner Sandbox (Zero Teacher Access)

- **Ownership**: `SpeakingPractice` artifacts (`OriginalAudio`, derived transcript, `PracticeFeedback`) belong exclusively to the Learner.
- **Teacher Access**: Teachers have **zero access** (neither UI navigation nor API endpoints) to a Learner's private practice sessions, regardless of whether that Learner is enrolled in the Teacher's `Classroom`.
- **Learner Protection**: Practice remains a psychological safety zone for unguided self-coaching without classroom surveillance.

### 2. Practice Retention & Hard Delete Policy

- **Learner Right to Erasure**: A Learner may trigger an immediate **Hard Delete** of their completed `SpeakingPractice`. This action permanently deletes the `OriginalAudio` blob on S3/SeaweedFS and removes/tombstones associated database rows.
- **Automatic Audio Purge**: Completed `SpeakingPractice` audio files have an automatic retention window of **14 days** (maximum 30 days), after which the binary audio is permanently purged from storage. Aggregate practice counts and scores are retained as anonymized metrics.
- **Abandoned Session Cleanup**: Incomplete or abandoned practice sessions (`in_progress` with no activity for > 24 hours) are automatically purged within **24 hours**.

### 3. Speaking Homework: Classroom RBAC & Audit Retention

- **Access Boundary**: `HomeworkSubmission` artifacts (`SubmissionAttempt`, audio evidence, `AiAssessmentProposal`, `TeacherReviewDraft`, `PublishedAssessment`) are strictly isolated via Role-Based Access Control (RBAC) to:
  1. The submitting Learner.
  2. The authorized Teacher(s) managing that specific `Classroom`.
     Other learners in the cohort have no access.
- **Learner Deletion Prohibition**: A Learner **cannot** unilaterally delete a submitted `SubmissionAttempt`. It serves as formal academic coursework. (Resubmissions create new attempts under the First-Committed-Wins rule before deadline/review lock).
- **Proposal Isolation**: Raw `AiAssessmentProposal` data is strictly hidden from learners; only official `PublishedAssessment` is revealed after teacher approval.
- **Audit Retention Window**: Homework artifacts are retained for the duration of the classroom course plus a **90-day dispute/audit window** following pilot completion, after which personal audio artifacts are permanently purged.

### 4. Provenance & Quality Evaluation (`EvaluationFeedback`)

- **Metadata Recorded**: For every teacher review, the system captures `model_version`, `prompt_template_version`, raw `AiAssessmentProposal` JSON, and the finalized `TeacherAssessment`.
- **Platform Training Invariant**: The platform does **not** train or fine-tune proprietary AI models. The stored `EvaluationFeedback` dataset is used strictly for prompt calibration, error categorization, and algorithmic accuracy telemetry.

### 5. Third-Party API Tier & Mandatory Upfront Consent Notice

- **Tier Selection**: During the pilot testing phase, the platform operates on the **Google Gemini Free Tier**.
- **Data Disclosure & Acceptance**: Under Google's Free Tier terms of service, Google may log and process prompts and audio data for service improvement. The platform explicitly accepts this constraint for the pilot phase.
- **Mandatory User Consent**: Prior to requesting microphone access (`getUserMedia`) or starting any practice/homework session, the application must display a clear, explicit **Consent Notice** (`FreeTierConsentNotice`) informing the user (18+) that audio and transcripts are processed and collected via Google's AI services under free-tier experimental terms.

---

## Consequences

- **Clear Boundary**: Eliminates ambiguity between learner-owned sandbox practice and teacher-governed classroom coursework.
- **Storage Cost Control**: S3/SeaweedFS lifecycle policies can safely purge practice audio after 14 days without breaking user expectations.
- **Legal Compliance**: Satisfies personal data protection transparency by requiring explicit upfront consent regarding third-party processing before any recording begins.
- **Implementation Constraints**: Frontend must incorporate the explicit Google Free Tier Consent modal/gate before granting access to recording rooms.
