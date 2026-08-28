# IELTS Assessment Platform

Platform for IELTS Speaking & Writing assessment where AI produces proposals and Teachers hold final assessment authority.

## Core Language

### Homework & Submission

**Homework**:
An assignment created by a Teacher and assigned to a Classroom with one or more Prompts.
_Avoid_: AssignmentEntity, Exercise, Task

**HomeworkSubmission**:
The root record representing a Learner's work for a specific Homework, maintaining the sequence of Submission Attempts and review state.
_Avoid_: SubmissionRecord, StudentHomework

**SubmissionAttempt**:
An immutable snapshot of work submitted by a Learner at a specific point in time.
_Avoid_: SubmissionRevision, SubmissionVersion

**CurrentAttempt**:
The most recent SubmissionAttempt submitted by the Learner before Teacher Review starts.
_Avoid_: ActiveSubmission, LatestAttempt

**ReviewedAttempt**:
The specific SubmissionAttempt locked in and evaluated when the Teacher starts review.
_Avoid_: TargetAttempt, LockedAttempt

**HomeworkAssessment**:
The root record governing the full assessment lifecycle for a single ReviewedAttempt — from AI proposal through Teacher evaluation and publication.
_Avoid_: AssessmentRecord, GradingSession, ReviewResult

### Assessment Lifecycle & Proposals

**AiAssessmentProposal**:
An AI-generated draft containing criterion scores, overall band, and feedback. Non-authoritative suggestion.
_Avoid_: AssessmentResult, AiScore, SystemGrade

**TeacherAssessment**:
The professional evaluation created, verified, or corrected by a Teacher.
_Avoid_: ManualGrade, FinalScore

**PublishedAssessment**:
The official assessment visible to the Learner immediately after the Teacher completes review by choosing “Duyệt”.
_Avoid_: PublicGrade, FinalResult

**EvaluationFeedback (AiFeedbackDataset)**:
Structured comparison data capturing original AI proposal vs Teacher final assessment and score deltas for AI calibration.
_Avoid_: TrainingData, DiffLog

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

**MockTest**:
A self-service practice test taken by a Learner using a randomly selected active Prompt. AI assesses directly and publishes immediately without Teacher approval.
_Avoid_: PracticeTest, QuickTest, SelfTest

### Speaking & Audio Responses

**SpeakingResponse**:
A single audio recording and transcript corresponding to a specific question or cue card within a SubmissionAttempt or MockTest.
_Avoid_: AudioRecord, SpeakingItem, VoiceAnswer

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

**HomeworkAssignment**:
The binding of a Homework to a Classroom.
_Avoid_: ClassHomework, TaskAssignment

### Speaking Modality & Workflows

**SpeakingDiscreteHomework**:
A homework assignment consisting of discrete speaking tasks or prompt items (e.g. specific Part 2 cue card or Part 1 questions) recorded individually and submitted for teacher review and approval.
_Avoid_: SpeakingTaskAssignment, HomeworkRecording

**SpeakingContinuousMockTest**:
A full 3-part continuous exam simulation randomly drawn from the active prompt bank that AI evaluates and publishes immediately without teacher review.
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
