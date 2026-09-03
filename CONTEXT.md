# IELTS Assessment Platform

Platform for IELTS Speaking & Writing assessment where AI produces proposals and Teachers hold final assessment authority.

## Core Language

### Homework & Submission

**HomeworkAssignment**:
An assignment created by a Teacher and assigned to a Classroom with one or more Prompts.
_Avoid_: Homework, AssignmentEntity, Exercise, Task

**HomeworkSubmission**:
The aggregate root record representing a single Learner's work for a specific HomeworkAssignment, maintaining the sequence of SubmissionAttempts, Teacher review state, and final publication.
_Avoid_: SubmissionRecord, StudentHomework, SpeakingAssessment

**SubmissionAttempt**:
An immutable snapshot of work submitted by a Learner at a specific point in time. A permitted resubmission creates a new SubmissionAttempt and never overwrites an earlier one.
_Avoid_: SubmissionRevision, SubmissionVersion

**SubmissionDeadline**:
The final instant when a Learner may submit or resubmit Homework, interpreted in the Classroom timezone. A Teacher may extend it, but no SubmissionAttempt is accepted after it passes.
_Avoid_: SoftDeadline, SuggestedDueDate

**CurrentAttempt**:
The most recent SubmissionAttempt submitted by the Learner before Teacher Review starts.
_Avoid_: ActiveSubmission, LatestAttempt

**ReviewedAttempt**:
The specific SubmissionAttempt locked in and evaluated when the Teacher starts review.
_Avoid_: TargetAttempt, LockedAttempt

**TeacherReviewDraft**:
The teacher's in-progress, editable evaluation draft associated with a specific SubmissionAttempt under review within a HomeworkSubmission.
_Avoid_: ReviewSession, TeacherGradingRecord

**TeacherAssessment**:
The professional evaluation created, verified, or corrected by a Teacher.
_Avoid_: ManualGrade, FinalScore

**PublishedAssessment**:
The official TeacherAssessment visible to the Learner after the Teacher completes review by choosing “Duyệt”. In the MVP, approval and publication are one business decision rather than separate lifecycle states.
_Avoid_: PublicGrade, FinalResult, ApprovedAssessment, SpeakingAssessment

**ActiveReviewTimer**:
The active engagement timer in the Teacher Review cockpit that measures genuine teacher grading duration by automatically pausing when the review tab is hidden or user interaction is idle (> 60s), finalized and committed upon Publish.
_Avoid_: GradingStopwatch, ReviewDuration, IdleTracker, ManualTimer

### Assessment & AI Evaluation

**HomeworkEvaluation**:
The aggregate root managing the asynchronous AI evaluation lifecycle for a specific SubmissionAttempt, tracking EvaluationRuns and producing an AiAssessmentProposal.
_Avoid_: HomeworkAssessment, EvaluationJob, GradingRun

**PracticeEvaluation**:
The aggregate root managing the asynchronous AI evaluation lifecycle for a SpeakingPractice session, tracking EvaluationRuns and producing PracticeFeedback.
_Avoid_: PracticeAssessment, ScoringJob

**AiAssessmentProposal**:
An AI-generated draft containing criterion scores, overall band, and feedback specifically for teacher review. Non-authoritative suggestion, strictly hidden from learners.
_Avoid_: AssessmentResult, EvaluationResult, AiScore, SystemGrade

**PracticeFeedback**:
The unofficial, learner-facing coaching report containing estimated scores, key strengths, improvement priorities, and sample answers produced by a PracticeEvaluation.
_Avoid_: EvaluationResult, PracticeAssessment, PracticeScorecard

**EvaluationRun**:
An individual execution attempt of AI evaluation within a PracticeEvaluation or HomeworkEvaluation lifecycle. Retries create new EvaluationRuns without overwriting historical runs.
_Avoid_: EvaluationAttempt, GradingRetry, JobExecution

**IeltsRubric**:
The immutable IELTS scoring criteria and descriptor definitions referenced by version across evaluations.
_Avoid_: IELTSRubric, DynamicRubric, ScoringGuide

**EvaluationFeedback (AiFeedbackDataset)**:
Structured comparison data capturing the original AI proposal, the TeacherAssessment, and their score deltas for audit, product evaluation, and prompt or workflow improvement. It is never model-training data.
_Avoid_: TrainingData, ModelTrainingDataset, DiffLog

### Prompts & Questions

**Prompt**:
An IELTS task specification (Speaking Part 1/2/3, Writing Task 1/2) with rubric and instructions.
_Avoid_: Question, Topic

**ActivePrompt**:
A Prompt currently available for selection in Mock Tests or Homework assignments.
_Avoid_: EnabledPrompt, AvailableQuestion

**RetiredPrompt**:
A Prompt archived from new test selection while preserving historical submission links.
_Avoid_: DeletedPrompt, DisabledQuestion

### Practice

**SpeakingPractice**:
The aggregate root representing a Learner-initiated speaking activity that returns immediate, explicitly unofficial AI feedback (PracticeFeedback) without Teacher review. It is distinct from an exam-condition MockTest and never produces a PublishedAssessment.
_Avoid_: SpeakingSession, SpeakingMockTest, FullSpeakingExam

**MockTest**:
A self-service exam simulation taken by a Learner using a randomly selected ActivePrompt. Its AI result is immediately visible without Teacher review but is not a PublishedAssessment.
_Avoid_: PracticeTest, QuickTest, SelfTest

### Speaking & Audio Responses

**SpeakingResponse**:
A single audio recording and transcript corresponding to a specific question or cue card within a SubmissionAttempt or SpeakingPractice. Audio is authoritative evidence while transcript is derived.
_Avoid_: AudioRecord, SpeakingItem, SpeakingAudio, GenericTranscript, VoiceAnswer

**SpeakingReviewAnnotation**:
A teacher-authored evaluation note attached to an exact audio timestamp and category (pronunciation, grammar, lexical, fluency) within a SpeakingResponse.
_Avoid_: AudioMarker, VoiceNote, TimeTag

### Classroom & Organization

**Classroom**:
A learning cohort created by a Teacher grouping Learners.
_Avoid_: Course, Batch, ClassGroup

**Membership**:
The association between a Learner and a Classroom.
_Avoid_: Enrollment, UserClass

### Speaking Modality & Workflows

**SpeakingDiscreteHomework**:
A homework assignment consisting of discrete speaking tasks or prompt items (e.g. specific Part 2 cue card or Part 1 questions) recorded individually and submitted for teacher review and approval.
_Avoid_: SpeakingTaskAssignment, HomeworkRecording

**SpeakingContinuousMockTest**:
A future three-part MockTest modality conducted under exam conditions and drawn from the active prompt bank. Unlike SpeakingPractice, it is an exam simulation rather than an unofficial coaching activity.
_Avoid_: FullSpeakingExam, InstantSpeakingTest

### Design System & Visual Tokens

**CriterionToken**:
A semantic color token dedicated to an IELTS assessment criterion (Task Achievement: Emerald, Coherence & Cohesion: Amber, Lexical Resource: Blue, Grammatical Range & Accuracy: Rose, Pronunciation: Violet) with high contrast for both light and dark themes.
_Avoid_: CustomColorClass, RawHexCode

**BandScoreBadge**:
A standardized visual badge component encoding candidate proficiency across 4 band tiers (8.0-9.0: Expert/Emerald, 6.5-7.5: Competent/Blue, 5.0-6.0: Modest/Amber, <5.0: Limited/Rose) across 3 scale sizes.
_Avoid_: ScoreTag, GradePill

**ErrorSeverityEncoding**:
A 3-tier visual underline and callout standard for diagnostic errors (minor_slip: dotted underline, systematic_error: solid underline with tint, impedes_communication: wavy destructive underline).
_Avoid_: CustomUnderline, TextErrorMarker

**DensityTier**:
Layout density classification governing UI padding and information compactness (Compact: 12px for Teacher Review multi-pane cockpit; Standard: 16px; Spacious: 24px for Learner Dashboard).
_Avoid_: LayoutSpacingMode, CustomPaddingPreset

### Privacy & Data Governance

**FreeTierConsentNotice**:
An upfront, mandatory consent gate presented to an adult Learner (18+) before recording or starting practice/homework, disclosing that audio and textual transcripts are processed and collected by Google Gemini under experimental Free Tier terms.
_Avoid_: GenericDisclaimer, TermsCheckbox, HiddenPrivacyNote

**HardDeletePolicy**:
The immediate and irreversible deletion of a Learner's OriginalAudio on object storage (S3/SeaweedFS) and associated database references upon explicit user request.
_Avoid_: SoftDeleteArchive, DelayedPurge, Deactivation
