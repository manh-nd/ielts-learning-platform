# PRD — IELTS Speaking & Writing Assessment Platform

**Version:** 2.0 — Domain-refined MVP
**Status:** Working specification
**Primary purpose:** Làm tài liệu nguồn sự thật để AI Coding Agent / Developer có thể triển khai sản phẩm mà không tự suy diễn business rule.

---

# 1. Product Vision

Xây dựng nền tảng luyện IELTS Speaking và Writing trong đó:

- Learner làm Mock Test hoặc Homework.
- AI hỗ trợ chấm bài và đưa ra đề xuất điểm/feedback.
- Với Homework, Teacher là người chịu trách nhiệm cuối cùng về kết quả.
- AI được dùng để giảm thời gian chấm bài của Teacher, không thay thế Teacher.
- Các chỉnh sửa của Teacher so với kết quả AI phải được lưu lại để tạo dữ liệu cải thiện AI trong tương lai.

Nguyên tắc cốt lõi:

> AI assists. Teacher decides.

---

# 2. MVP Goal

MVP phải chứng minh được vòng lặp nghiệp vụ:

```text
Learner submits
        ↓
AI optionally assesses
        ↓
Teacher reviews
        ↓
Teacher accepts / corrects / grades manually
        ↓
Teacher approves
        ↓
Teacher publishes
        ↓
Learner receives final assessment
```

Success của MVP không được đo bằng số lượng CRUD screens.

Success được đo bằng việc Teacher thực sự giảm thời gian chấm bài trong khi vẫn kiểm soát kết quả cuối cùng.

---

# 3. Actors

## 3.1 Learner

Learner có thể:

- tham gia lớp;
- nhận Homework;
- làm Writing Homework;
- làm Speaking Homework;
- làm Mock Test;
- submit/resubmit bài trong những điều kiện được phép;
- xem kết quả đã được publish;
- xem lịch sử kết quả.

---

## 3.2 Teacher

Teacher có thể:

- tạo lớp;
- thêm Learner vào lớp;
- tạo đề;
- giao Homework;
- xem bài Learner;
- bắt đầu review bài;
- xem AI Assessment Proposal;
- retry AI assessment;
- chấm hoàn toàn thủ công;
- chỉnh sửa kết quả AI;
- approve assessment;
- publish assessment;
- xem lịch sử Learner.

Teacher là:

```text
FINAL ASSESSMENT AUTHORITY
```

đối với Homework.

---

## 3.3 AI Assessment Service

AI không phải actor có quyền quyết định kết quả chính thức.

AI chỉ:

```text
produces Assessment Proposal
```

AI có thể:

- thành công;
- thất bại;
- timeout;
- unavailable;
- hết quota;
- gặp lỗi billing;
- trả output không hợp lệ.

Các trường hợp này KHÔNG được làm Teacher mất khả năng chấm bài.

---

# 4. Core Domain Principle

## 4.1 AI Assessment ≠ Official Assessment

Không được sử dụng một concept chung chung:

```text
Assessment
```

để đồng nhất kết quả AI với kết quả chính thức.

Phải phân biệt:

```text
AI Assessment Proposal
Teacher Assessment
Approved Assessment
Published Assessment
```

Ý nghĩa:

```text
AI Assessment Proposal
```

là đề xuất của AI.

```text
Teacher Assessment
```

là assessment mà Teacher đồng ý chịu trách nhiệm.

```text
Approved Assessment
```

là assessment đã được Teacher xác nhận là hoàn tất.

```text
Published Assessment
```

là assessment chính thức đã được công bố cho Learner.

---

# 5. Primary Business Flows

# 5.1 Homework

Luồng chuẩn:

```text
Teacher creates Homework
        ↓
Teacher assigns Homework
        ↓
Learner submits
        ↓
AI assessment is requested
        ↓
AI succeeds OR fails
        ↓
Teacher starts review
        ↓
Submission becomes locked
        ↓
Teacher chooses one of:

    Accept AI Proposal
    Correct AI Proposal
    Grade Manually
    Retry AI

        ↓
Teacher approves
        ↓
Assessment waits
        ↓
Teacher publishes
        ↓
Learner can see final assessment
```

AI assessment KHÔNG phải prerequisite bắt buộc cho Teacher Review.

---

# 5.2 Mock Test

Mock Test khác Homework.

```text
Learner starts Mock Test
        ↓
System selects active prompt
        ↓
Learner completes test
        ↓
Learner submits
        ↓
AI assesses
        ↓
AI result is published immediately
```

Mock Test không yêu cầu Teacher approval trong MVP.

Policy:

```text
Homework
→ Teacher approval required.

Mock Test
→ AI result may publish automatically.
```

Không implement rule này bằng các `if type === ...` phân tán khắp codebase.

Đây phải là business policy rõ ràng.

---

# 6. Homework Submission Domain

## 6.1 HomeworkSubmission

Một Learner có một HomeworkSubmission cho một Homework.

Một HomeworkSubmission có thể có nhiều Submission Attempts.

Ví dụ:

```text
HomeworkSubmission
    ├── Attempt #1
    ├── Attempt #2
    └── Attempt #3 ← current
```

Không được overwrite bài cũ khi resubmit.

Sai:

```text
submission.content = newContent
```

Đúng về mặt domain:

```text
new SubmissionAttempt
```

---

## 6.2 SubmissionAttempt

Mỗi attempt phải đại diện cho nội dung chính xác được Learner gửi tại thời điểm đó.

Assessment của attempt A không được gắn sang attempt B.

```text
AI Proposal #1
    → Attempt #1

AI Proposal #2
    → Attempt #2
```

---

# 7. Resubmission Rules

Learner ĐƯỢC resubmit khi Teacher chưa bắt đầu review.

State:

```text
Submitted
    ↓
Learner may resubmit

Submitted
    ↓
Teacher starts review

UnderReview
    ↓
Learner may NOT resubmit
```

Invariant:

```text
A Learner MUST NOT resubmit
a HomeworkSubmission
after Teacher Review has started.
```

---

# 8. Start Review

`StartHomeworkReview` là business command.

Không coi việc Teacher mở màn hình review đơn thuần là frontend navigation.

Command:

```text
StartHomeworkReview
```

Event:

```text
HomeworkReviewStarted
```

Khi command thành công:

1. current SubmissionAttempt được xác định là attempt đang review;
2. HomeworkSubmission chuyển sang `UnderReview`;
3. Learner không thể resubmit nữa.

Ví dụ:

```text
Current Attempt = #3

Teacher starts review

        ↓

Reviewed Attempt = #3
Submission = UnderReview
```

Từ thời điểm này:

```text
ResubmitHomework
```

phải bị reject.

Domain error:

```text
HomeworkIsAlreadyUnderReview
```

---

# 9. AI Assessment

Sau mỗi SubmissionAttemptSubmitted, hệ thống SHOULD request AI assessment.

Policy:

```text
WHEN SubmissionAttemptSubmitted
THEN RequestAIAssessment
```

Nhưng đây KHÔNG phải invariant.

AI fail không được rollback việc Learner submit bài.

Luồng:

```text
SubmissionAttemptSubmitted
        ↓
Request AI Assessment
        ↓

   ┌────┴────┐
   │         │
Success     Failure
   │         │
   ▼         ▼
Proposal   AI Unavailable
   │         │
   └────┬────┘
        ↓
Teacher can review
```

---

# 10. AI Failure

Các failure có thể gồm:

- timeout;
- provider outage;
- quota exceeded;
- billing unavailable;
- malformed AI response;
- STT unavailable;
- internal integration error.

AI failure KHÔNG được khiến Homework không thể tiếp tục.

Teacher phải có hai lựa chọn:

```text
Retry AI Assessment
```

hoặc:

```text
Grade Manually
```

AI là optimization, không phải dependency bắt buộc của core workflow.

---

# 11. Teacher Assessment

Teacher có ba con đường chính.

## 11.1 AI hoàn toàn đúng

Teacher chỉ cần:

```text
Approve AI Result
```

Không bắt Teacher copy/chỉnh dữ liệu không cần thiết.

Business meaning:

```text
Teacher accepts the AI proposal
as the assessment they stand behind.
```

---

## 11.2 AI đúng một phần

Teacher được sửa:

- criterion scores;
- overall score;
- feedback;
- detected errors;
- recommendations.

Ví dụ:

```text
Lexical Resource

AI:      6.0
Teacher: 6.5
```

Teacher result luôn là authority cuối cùng.

---

## 11.3 AI không khả dụng

Teacher có thể tự tạo assessment hoàn toàn thủ công.

Không yêu cầu phải retry AI trước.

---

# 12. Assessment Approval

Approval là quyết định của Teacher rằng assessment đã sẵn sàng về mặt chuyên môn.

Command:

```text
ApproveAssessment
```

Event:

```text
AssessmentApproved
```

Invariant:

```text
AI alone MUST NOT approve Homework Assessment.
```

Teacher phải là authority của Homework approval.

---

# 13. Approval ≠ Publication

Đây là distinction bắt buộc.

```text
ApproveAssessment
```

không được tự động làm Learner thấy kết quả.

Sau approval:

```text
Approved
```

assessment vẫn đang chờ publish.

Teacher phải thực hiện:

```text
PublishAssessment
```

Event:

```text
AssessmentPublished
```

State:

```text
Teacher Assessment
        ↓
Approved
        ↓
waiting
        ↓
Published
```

---

# 14. Learner Result Visibility

Learner chỉ được thấy kết quả Homework chính thức khi:

```text
Assessment = Published
```

Không phải khi:

```text
AI Assessment Completed
```

và cũng không phải chỉ khi:

```text
Assessment Approved
```

Invariant:

```text
Only Published Homework Assessment
is visible to Learner as final result.
```

---

# 15. Assessment State Model

Conceptual lifecycle:

```text
AwaitingAssessment
        │
        ├── AI succeeds
        │
        ▼
AIProposalAvailable
        │
        │
        └─────────────┐
                      │
        AI fails      │
            │         │
            ▼         │
     AIUnavailable    │
            │         │
            └────┬────┘
                 ▼
       AwaitingTeacherReview
                 │
        ┌────────┴─────────┐
        │                  │
 Accept AI Proposal   Grade / Correct
        │                  │
        └────────┬─────────┘
                 ▼
          TeacherAssessed
                 │
                 ▼
              Approved
                 │
                 │ waiting
                 ▼
             Published
```

Không nên model state bằng generic integer:

```text
status = 1
status = 2
status = 3
```

Tên state phải mang business meaning.

---

# 16. Candidate Aggregates

## 16.1 HomeworkSubmission

Responsibilities:

```text
HomeworkSubmission
    ├── identifies Learner
    ├── identifies Homework
    ├── owns Submission Attempts
    ├── knows Current Attempt
    ├── allows Resubmission
    └── locks Submission when Review starts
```

Commands:

```text
SubmitHomework
ResubmitHomework
StartHomeworkReview
```

Domain Events:

```text
HomeworkSubmitted
SubmissionAttemptSubmitted
HomeworkReviewStarted
```

Key invariants:

```text
CurrentAttempt is the latest accepted attempt.

Learner may resubmit before review starts.

Learner cannot resubmit after review starts.

Teacher Review always targets the CurrentAttempt
at the moment review starts.
```

---

## 16.2 HomeworkAssessment

Responsibilities:

```text
HomeworkAssessment
    ├── targets one SubmissionAttempt
    ├── stores AI Proposal
    ├── records AI failures
    ├── supports retry
    ├── supports Manual Assessment
    ├── records Teacher corrections
    ├── handles Approval
    └── handles Publication
```

Commands:

```text
RequestAIAssessment
RetryAIAssessment

AcceptAIProposal
GradeManually
CorrectAssessment

ApproveAssessment
PublishAssessment
```

Domain Events:

```text
AIAssessmentRequested
AIAssessmentCompleted
AIAssessmentFailed

AssessmentManuallyGraded
AssessmentCorrected
AssessmentApproved
AssessmentPublished
```

---

# 17. AI Feedback Dataset

MVP KHÔNG cần AI tự học.

MVP PHẢI lưu dữ liệu đủ sạch để có thể cải thiện AI sau này.

Không overwrite AI result bằng Teacher result.

Phải giữ ít nhất:

```text
Original Submission Attempt

AI Assessment Proposal
    ├── criterion scores
    ├── overall score
    └── feedback

Teacher Assessment
    ├── criterion scores
    ├── overall score
    └── feedback

Correction Difference
    ├── AI value
    ├── Teacher value
    └── criterion / feedback affected
```

Ví dụ:

```text
Task Response

AI:      6.0
Teacher: 7.0
Delta:   +1.0
```

Dữ liệu cũ không được mất sau correction.

---

# 18. Writing Assessment

Writing gồm:

```text
Writing Task 1
Writing Task 2
```

Assessment phải chứa 4 criteria:

```text
Task Achievement / Task Response
Coherence and Cohesion
Lexical Resource
Grammatical Range and Accuracy
```

Output:

```text
Criterion Score
Overall Band
Feedback
Detected Problems
Correction Suggestions
Higher-band Suggestions
```

Band sử dụng thang IELTS theo increment 0.5.

---

# 19. Speaking Assessment

Speaking gồm:

```text
Part 1
Part 2
Part 3
```

Input gồm:

```text
Audio
+
Transcript
```

Không được chỉ giữ transcript.

Criteria:

```text
Fluency and Coherence
Lexical Resource
Grammatical Range and Accuracy
Pronunciation
```

Speaking phụ thuộc thêm:

```text
Browser Recording
Audio Storage
Speech-to-Text
Audio / Pronunciation Assessment
```

Vì risk kỹ thuật cao hơn Writing nên Speaking có thể được triển khai sau Writing Golden Path.

---

# 20. Question / Prompt Bank

Teacher có thể tạo Prompt.

Prompt type:

```text
Speaking Part 1
Speaking Part 2
Speaking Part 3
Writing Task 1
Writing Task 2
```

Prompt dành cho Mock Test có lifecycle:

```text
Active
Retired
```

Commands nên sử dụng ubiquitous language:

```text
ActivatePrompt
RetirePrompt
```

Không hard-delete prompt đã từng được Learner sử dụng.

Invariant:

```text
Only Active Mock Test Prompts
may be selected for a new Mock Test.
```

---

# 21. Classroom

Teacher có thể:

```text
CreateClassroom
AddLearnerToClassroom
AssignHomeworkToClassroom
```

Concepts:

```text
Classroom
Membership
HomeworkAssignment
```

Không model toàn bộ business chỉ bằng:

```text
homework.classId
```

Một Learner có thể thuộc nhiều Classroom.

---

# 22. Mock Test Policy

Mock Test phải random từ active prompt bank.

MVP có thể chấp nhận random hoàn toàn, kể cả lặp đề.

Avoid-recently-used-prompt có thể để Phase 2.

Mock Test result:

```text
AI Assessment
→ immediately available to Learner
```

Không đi qua Homework Teacher Review lifecycle.

---

# 23. History & Progress

Learner có thể xem:

```text
Submission history
Published assessment history
Criterion scores over time
Overall bands over time
```

Teacher có thể xem lịch sử theo Learner.

MVP ưu tiên table.

Charts không phải requirement bắt buộc.

---

# 24. Application Architecture Principle

Recommended architecture:

```text
Modular Monolith
```

Không tạo microservice chỉ vì có nhiều Bounded Context.

Candidate contexts/modules:

```text
Practice
Assessment
Question Bank
Classroom
Progress
Identity
```

Core Domain:

```text
Assessment
```

External integrations:

```text
LLM
Speech-to-Text
Audio Storage
```

phải nằm sau adapter/boundary rõ ràng.

---

# 25. Application Service Responsibility

Application Service làm orchestration.

Ví dụ:

```text
Command
    ↓
Load Aggregate
    ↓
Execute Domain Behavior
    ↓
Persist Aggregate
    ↓
Publish Domain Events
```

Application Service KHÔNG phải nơi chứa business invariants.

Không:

```text
if status == UNDER_REVIEW
```

rải trong controller/service.

Business decision phải nằm trong domain model.

---

# 26. Repository Rules

Repository dùng để load/save Aggregate.

Ví dụ:

```text
HomeworkSubmissionRepository

get(id)
save(submission)
```

Tránh API kiểu:

```text
updateStatus()
updateScore()
lockSubmission()
updateById()
```

nếu chúng bypass domain behavior.

---

# 27. External AI Reliability

Submission transaction KHÔNG được phụ thuộc trực tiếp vào AI transaction.

Sai:

```text
Save Submission
    ↓
Call AI
    ↓
AI fails
    ↓
Rollback Submission
```

Desired behavior:

```text
Persist Submission
    ↓
SubmissionAttemptSubmitted
    ↓
Request AI asynchronously / after commit
    ↓

AI success or failure
does not invalidate submission
```

Implementation mechanism có thể dùng:

```text
Transactional Outbox
Job Queue
Reliable Event Handler
```

Việc chọn mechanism là technical decision, không phải domain rule.

---

# 28. Concurrency

Case cần bảo vệ:

```text
Learner clicks Resubmit

and almost simultaneously

Teacher clicks Start Review
```

Không được xảy ra state:

```text
Teacher reviewing Attempt #1
while Attempt #2 silently becomes current.
```

HomeworkSubmission là consistency boundary bảo vệ invariant này.

Recommended MVP mechanism:

```text
Optimistic Concurrency Control
```

Ví dụ Aggregate có `version`.

Một concurrent write thắng; write còn lại phải reload và reevaluate domain command.

---

# 29. Explicit MVP Decisions

Các quyết định đã được xác nhận:

1. AI tồn tại để giảm workload cho Teacher.
2. AI đúng thì Teacher chỉ cần approve, không cần chỉnh sửa giả tạo.
3. Teacher luôn là authority cuối cùng của Homework.
4. AI assessment không bắt buộc để Teacher có thể chấm bài.
5. Khi AI fail, Teacher có thể retry hoặc chấm thủ công.
6. Learner được resubmit trước khi Teacher Review bắt đầu.
7. Khi Teacher bắt đầu review, submission bị khóa.
8. Review phải target current attempt tại thời điểm bắt đầu review.
9. Approval không đồng nghĩa Publication.
10. Teacher phải thực hiện Publish riêng.
11. Phase đầu không xây workflow reopen/revision phức tạp sau khi Published.
12. Original AI result không được overwrite bởi Teacher correction.

---

# 30. MVP Delivery Order

Ưu tiên triển khai theo vertical slice:

```text
Phase 0
Writing → AI → simple result
```

```text
Phase 1
Writing Homework
Learner Submit
→ AI Proposal
→ Teacher Review
→ Approve
→ Publish
```

```text
Phase 2
AI vs Teacher correction dataset
```

```text
Phase 3
Writing Mock Test
```

```text
Phase 4
Classroom + Homework Assignment
```

```text
Phase 5
History / Progress
```

```text
Phase 6
Speaking thin slice
Record
→ STT
→ AI
→ Teacher Review
```

```text
Phase 7
Full Speaking / Mock Test hardening
```

Mỗi phase phải tạo được một behavior có thể demo cho customer.

---

# 31. Out of Scope for Initial Slice

Không được tự động thêm các feature sau nếu chưa có requirement mới:

```text
Payment
Google Login
Email verification workflow phức tạp
Fine-tuning
Automatic AI learning
Advanced analytics
Beautiful charts
Complex roles/permissions
Assessment revision history after publication
Scheduled publication
Review timeout
Review cancellation
Automatic review unlock
Avoid-random-repeat algorithm
Bulk CSV import
```

Một số feature có trong roadmap rộng hơn nhưng không thuộc Writing Homework Golden Path đầu tiên.

---

# 32. Open Questions

AI Agent KHÔNG được tự chọn câu trả lời cho các câu hỏi sau.

Nếu implementation chạm vào chúng, phải đánh dấu assumption hoặc yêu cầu Product decision.

```text
1. Published Assessment có được reopen trong Phase 2 không?

2. Approved-but-not-published assessment
   có được Teacher sửa lại trực tiếp không?

3. Ai ngoài Teacher được phép Publish?

4. Có scheduled publication không?

5. Homework có deadline không?

6. Deadline ảnh hưởng Resubmission như thế nào?

7. Mock Test chính xác là một Prompt
   hay một Test gồm nhiều Prompt?

8. Writing Mock Test gồm Task 1,
   Task 2 hay cả hai?

9. Full Speaking Mock Test composition
   được random như thế nào?

10. AI correction dataset cần lưu diff
    ở mức score hay cả detailed feedback spans?

11. Pronunciation assessment provider nào được sử dụng?

12. LLM provider nào được sử dụng?
```

Không được biến open question thành invariant.

---

# 33. Terminology to Avoid

AI Agent nên tránh domain naming kiểu technical CRUD:

```text
SubmissionDto
UpdateSubmission
UpdateStatus
ScoreDto
UpdateScore
QuestionEntity
AssessmentService.update()
```

Ưu tiên ubiquitous language:

```text
SubmitHomework
ResubmitHomework
StartHomeworkReview
RetryAIAssessment
AcceptAIProposal
GradeManually
CorrectAssessment
ApproveAssessment
PublishAssessment
ActivatePrompt
RetirePrompt
```

Tên code phải kể được business story.

---

# 34. Core Invariants Summary

```text
HOMEWORK-01
Teacher is the final authority for Homework Assessment.

HOMEWORK-02
AI Assessment Proposal is not an official learner result.

HOMEWORK-03
AI failure must not prevent Teacher from assessing Homework.

SUBMISSION-01
Learner may resubmit before Teacher Review starts.

SUBMISSION-02
Learner may not resubmit after Teacher Review starts.

SUBMISSION-03
Teacher Review targets the Current Submission Attempt
at the moment Review starts.

ASSESSMENT-01
Teacher may accept an AI proposal without modifying it.

ASSESSMENT-02
Teacher may assess manually without an AI proposal.

ASSESSMENT-03
Original AI Proposal must be preserved after Teacher corrections.

PUBLICATION-01
Approval and Publication are different business actions.

PUBLICATION-02
Homework result is not visible to Learner before Publication.

MOCKTEST-01
Mock Test assessment does not require Teacher approval in MVP.

PROMPT-01
Only active Mock Test prompts may be selected for new Mock Tests.
```

---

# 35. Acceptance Scenario — Golden Path

```gherkin
Given a Learner has been assigned a Writing Homework
And the Homework has not entered Teacher Review

When the Learner submits an answer

Then a new Submission Attempt is created
And it becomes the Current Attempt
And AI Assessment should be requested
```

```gherkin
Given AI has successfully created an Assessment Proposal

When the Teacher starts reviewing the Homework

Then the Current Attempt becomes the Reviewed Attempt
And the Homework becomes Under Review
And the Learner can no longer resubmit
```

```gherkin
Given the AI Assessment Proposal is completely correct

When the Teacher accepts and approves it

Then the assessment becomes Approved
But the Learner must not see it yet
```

```gherkin
Given an Assessment is Approved

When the Teacher publishes it

Then the Assessment becomes Published
And the Learner can see it as the Final Assessment
```

---

# 36. Acceptance Scenario — AI Failure

```gherkin
Given a Learner submitted Homework

When AI Assessment fails

Then the Submission remains valid
And the Homework remains reviewable
And the Teacher can Retry AI Assessment
And the Teacher can Grade Manually
```

---

# 37. Acceptance Scenario — Resubmission

```gherkin
Given Attempt #1 is the Current Attempt
And Teacher Review has not started

When the Learner resubmits

Then Attempt #2 is created
And Attempt #2 becomes the Current Attempt
And Attempt #1 remains in history
```

---

# 38. Acceptance Scenario — Review Lock

```gherkin
Given Attempt #2 is the Current Attempt

When the Teacher starts review

Then Attempt #2 becomes the Reviewed Attempt
And the Homework becomes Under Review
```

```gherkin
Given the Homework is Under Review

When the Learner tries to resubmit

Then the command must be rejected
Because Homework is already under Teacher Review
```

---

# 39. Instructions for AI Coding Agents

When implementing from this PRD:

**MUST**

- preserve domain terminology;
- enforce invariants inside domain behavior;
- distinguish AI Proposal from Teacher-approved result;
- preserve historical attempts;
- preserve original AI output;
- allow manual Teacher grading;
- treat AI integrations as fallible external dependencies;
- distinguish Approve from Publish;
- reject Resubmit after Review starts.

**MUST NOT**

- invent new business rules;
- infer answers to Open Questions;
- overwrite historical Submission Attempts;
- overwrite original AI assessment with Teacher correction;
- require AI success before Teacher Review;
- expose Approved-but-unpublished Homework result to Learner;
- represent core behavior only as generic CRUD status updates.

**SHOULD**

- use domain events for cross-boundary reactions;
- keep external AI calls outside core domain;
- use optimistic concurrency for Submission Review/Resubmit race conditions;
- prefer small vertical slices;
- keep MVP as a modular monolith unless an actual scaling requirement appears.

When an implementation decision conflicts with this PRD:

```text
Business invariant
    >
Domain model convenience
    >
Technical convenience
```

When a requirement is ambiguous:

```text
DO NOT GUESS.

Mark it as:
Product Decision Required.
```
