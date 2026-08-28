# ADR-0004: Speaking Session Schema, Normalized Audio Responses, and SeaweedFS S3 Pipeline

We established the database schema architecture and storage pipeline for multi-part IELTS Speaking recordings, AI evaluation proposals, and Teacher timestamp annotations.

## Context & Problem

IELTS Speaking submissions consist of distinct audio recordings across 3 parts:

- **Part 1**: 3–4 short questions (15–30s each).
- **Part 2**: 1 Cue Card talk (1 minute preparation notes + up to 2 minutes continuous speech).
- **Part 3**: 3–4 in-depth discussion questions (45–60s each).

We needed a robust, type-safe data model and storage pipeline that supports:

1. Direct multi-part audio uploads from browsers without overloading application server memory.
2. Granular teacher review with timestamped audio markers and waveform navigation.
3. Multi-criteria AI assessment via Gemini Multimodal Audio (FC, LR, GRA, PR).
4. Both Homework submissions (`HomeworkSubmission` -> `SubmissionAttempt` -> `HomeworkAssessment`) and self-service practice (`MockTest`).

## Decisions

### 1. Normalized Relational Schema (`speaking_responses` & `speaking_review_annotations`)

Rather than storing unstructured JSON arrays inside `submission_attempts`, we define explicit child tables:

- **`speaking_responses`**:
  - `id`: UUID v7 primary key.
  - `submission_attempt_id`: FK to `submission_attempts.id` (nullable for mock tests).
  - `mock_test_id`: FK to `mock_tests.id` (nullable for homework).
  - `part_number`: Integer (1, 2, or 3).
  - `item_index`: Zero-based integer index within the part.
  - `prompt_question`: Text of the specific question or cue card prompt.
  - `storage_key`: S3 key (`speaking/{userId}/{attemptId}/part{part}_{item}_{uuid}.webm`).
  - `mime_type`: E.g., `audio/webm;codecs=opus` or `audio/mp4`.
  - `duration_seconds`: Real / numeric audio length in seconds.
  - `file_size_bytes`: File size in bytes.
  - `transcript`: AI/STT generated transcription text.
  - `created_at`: Timestamp with timezone.

- **`speaking_review_annotations`**:
  - `id`: UUID v7 primary key.
  - `homework_assessment_id`: FK to `homework_assessments.id`.
  - `speaking_response_id`: FK to `speaking_responses.id`.
  - `timestamp_seconds`: Real number indicating the exact second marker in the audio.
  - `category`: Enum (`pronunciation`, `grammar`, `lexical`, `fluency`, `general`).
  - `original_quote`: Text snippet from transcript.
  - `teacher_comment`: Teacher's specific feedback or pronunciation correction.
  - `audio_clip_start_ms` / `audio_clip_end_ms`: Optional millisecond ranges for looping audio clips.

### 2. On-Demand Presigned PUT S3 Upload Pipeline

- Client records each answer in the browser via `MediaRecorder` / Web Audio API.
- Upon completing each response, the client requests a presigned PUT URL from a Server Action (`getSpeakingAudioUploadUrl`).
- Client uploads the audio blob directly to SeaweedFS S3 via HTTP PUT.
- When all parts are recorded, the client submits the attempt (`submitHomeworkAttempt` or `submitMockTest`).
- Server verifies storage keys on SeaweedFS before committing the attempt and triggering async AI grading via `after()` ([ADR-0002](0002-async-ai-dispatch-with-after.md)).

### 3. 2-Tier Hierarchical Assessment Rubric

`AiAssessmentProposal` and `TeacherAssessment` schemas structure speaking evaluation in two layers:

1. **Overall Session Scorecard**: 4 criteria scores (`fluency_and_coherence`, `lexical_resource`, `grammatical_range_and_accuracy`, `pronunciation`) scored from 0.0 to 9.0 (step 0.5), plus the computed `overall_band`, executive summary, key strengths, weaknesses, and an actionable practice plan.
2. **Per-Part Breakdown**: Part-specific transcript, vocabulary upgrades (idiomatic expressions/collocations), grammatical corrections, and phoneme/timestamped pronunciation notes.

### 4. Playback and Media Access

- Storage keys are saved in standardized format: `speaking/{userId}/{attemptId}/part{part}_{item}_{uuid}.webm`.
- When learners or teachers play recordings, short-lived Presigned GET URLs (1–24 hours expiry) are minted on demand via `@aws-sdk/s3-request-presigner`, offloading streaming directly to SeaweedFS without consuming Next.js process memory.

## Consequences

- **Type Safety & Integrity**: Drizzle ORM models enforce relational constraints between attempts, individual responses, and teacher timestamp markers.
- **Scalability**: Zero server RAM consumed by audio proxying during recording and playback.
- **Extensibility**: Ready for immediate backend implementation in [#24](https://github.com/manh-nd/ielts-learning-platform/issues/24) (Gemini Grader) and Storybook UI in [#25](https://github.com/manh-nd/ielts-learning-platform/issues/25) (Teacher Review Workspace).
