# TÀI LIỆU YÊU CẦU SẢN PHẨM HỢP NHẤT (UNIFIED PRD)

## Nền Tảng Chấm Chữa IELTS Speaking & Writing Bằng AI & Giáo Viên Kiểm Duyệt

**Phiên bản:** 3.0 — Product Context & Requirements Baseline (Chuẩn hoá từ Yêu cầu gốc của Stakeholder, Domain Invariants & ADRs 0001–0008)  
**Ngày khởi tạo:** 20/08/2026 | **Ngày chuẩn hoá:** 28/08/2026  
**Trạng thái:** Ngữ cảnh sản phẩm & lịch sử (Product/Historical Context — có thể bị thay thế bởi các ADR đã được chấp thuận trong `docs/adr/` và `CONTEXT.md` theo quy tắc thứ tự ưu tiên tài liệu)  
**Mục tiêu tài liệu:** Cung cấp đầy đủ ngữ cảnh gốc của Stakeholder, bối cảnh sản phẩm ban đầu và luồng nghiệp vụ tổng thể. Khi có sự khác biệt hoặc mâu thuẫn, các quyết định kiến trúc trong ADR đã được chấp thuận (`docs/adr/`) và ngôn ngữ miền chuẩn trong `CONTEXT.md` luôn là nguồn sự thật có mức ưu tiên cao hơn.

---

# 1. Tổng Quan Sản Phẩm & Bối Cảnh Nghiệp Vụ

Website hỗ trợ học viên luyện thi **IELTS Speaking và Writing**, chấm điểm tự động bằng AI theo đúng tiêu chí chấm thi IELTS chính thức của Cambridge / IDP / British Council, có giáo viên kiểm duyệt lại kết quả. Về lâu dài, hệ thống sẽ **học từ các chỉnh sửa của giáo viên** để tự cải thiện độ chính xác của AI theo thời gian.

> [!NOTE]
> **Ghi chú gốc từ Stakeholder (20/08/2026):**  
> _"Overall thì cái em cần gấp hiện tại là web có phần AI chấm chữa bài tập speaking, giáo viên duyệt và trả điểm, nhận xét chi tiết. Em muốn triển khai luôn sau đó thì có thể tích hợp thêm các tính năng khác sau ạ."_  
> _"Đối tượng dùng ban đầu: Học viên tự học cá nhân, luyện thi IELTS Speaking & Writing. Quy mô ban đầu: Vài chục học viên, 1 giáo viên duyệt bài toàn bộ hệ thống. Mô hình kinh doanh: Miễn phí hoàn toàn ở giai đoạn đầu (không cần tích hợp thanh toán trong MVP). Deadline mong muốn: Dưới 1 tháng cho bản MVP đầu tiên (rất gấp, Dev có thể propose thời gian hợp lí)."_

### Nguyên Tắc Bất Biến Cốt Lõi:

```text
AI assists. Teacher decides.
```

AI sinh đề xuất đánh giá (`AiAssessmentProposal`), Giáo viên là người giữ thẩm quyền chuyên môn và chịu trách nhiệm cuối cùng (`TeacherAssessment`) đối với bài tập của học viên.

---

# 2. Hai Luồng Nghiệp Vụ Chính (Core Business Flows)

### 2.1. Luồng "Bài Tập Về Nhà" (Homework — Giáo Viên Duyệt Bắt Buộc)

```text
Teacher creates & assigns Homework to a Classroom
        ↓
Learner records audio (Speaking) OR writes essay (Writing)
        ↓
Learner submits SubmissionAttempt
        ↓
System triggers Async AI Assessment (Next.js after() / Gemini Interactions API)
        ↓
AI produces AiAssessmentProposal (Hoặc ghi nhận AI Failure)
        ↓
Teacher starts review (Submission is locked: UnderReview)
        ↓
Teacher chooses 1 of 3 review paths:
  ├─ 1. Accept AI Proposal (Duyệt nguyên bản nếu AI đúng)
  ├─ 2. Correct AI Proposal (Sửa điểm / Ghi chú ngữ âm / Thêm nhận xét)
  └─ 3. Grade Manually (Chấm hoàn toàn thủ công nếu AI fail hoặc muốn tự chấm)
        ↓
Teacher executes Atomic Publish ("Duyệt & Công bố", ADR-0009: Publish = Finalize TeacherAssessment + MakeOfficial PublishedAssessment)
        ↓
Learner receives PublishedAssessment & System records clean EvaluationFeedback delta
```

> [!IMPORTANT]
> **Invariant:** AI assessment KHÔNG phải prerequisite bắt buộc cho Teacher Review. Nếu AI gặp sự cố (timeout, quota, network), Teacher vẫn có toàn quyền chấm bài thủ công (`HOMEWORK-03`, `ASSESSMENT-02`).

---

### 2.2. Luồng "Thi Thử" (Mock Test — AI Trả Điểm Ngay Lập Tức)

```text
Learner clicks "Làm bài thi thử"
        ↓
System randomly selects 1 ActivePrompt from Quarterly Mock Bank
        ↓
Learner completes test under exam conditions (3 Continuous Speaking Parts / Writing Task)
        ↓
Learner submits
        ↓
AI evaluates submission using official Cambridge Rubrics
        ↓
Result is Published immediately to Learner (Không qua Giáo viên duyệt)
```

> [!NOTE]
> **Chính Sách Nghiệp Vụ (Business Policy):**
>
> - **Homework:** Bắt buộc qua Giáo viên Review & Publish để đảm bảo chất lượng giảng dạy trong lớp (`HOMEWORK-01`, `PUBLICATION-02`).
> - **Mock Test:** AI tự động chấm và công bố ngay lập tức để học viên luyện phản xạ nhanh với đề thi ngẫu nhiên không đoán trước được (`MOCKTEST-01`).

---

# 3. Vai Trò Người Dùng & Phân Quyền (Actors & Roles)

| Vai trò                             | Mô tả & Trách nhiệm                                                                                                                                                                 | Trong MVP?                                                    |
| :---------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------ |
| **Learner** (Học viên)              | Đăng ký tài khoản, tham gia lớp, làm bài thi thử (Mock Test), làm bài tập về nhà (Homework), nộp bài, resubmit trước khi review bắt đầu, xem kết quả đã công bố và lịch sử tiến độ. | **Có**                                                        |
| **Teacher** (Giáo viên / Trợ giảng) | Tạo lớp học, thêm học viên vào lớp bằng email, soạn đề bài, quản lý kho đề thi thử theo quý, duyệt/sửa kết quả AI chấm, theo dõi tiến trình học viên.                               | **Có** (1 tài khoản giáo viên dùng chung cho trợ giảng ở MVP) |
| **Admin** (Quản trị viên)           | Quản trị hệ thống và xem thống kê tổng quan.                                                                                                                                        | **Gộp chung với vai trò Teacher ở MVP**                       |
| **AI Assessment Service**           | Dịch vụ AI sinh đề xuất đánh giá không có thẩm quyền chính thức.                                                                                                                    | **Có** (External Dependency)                                  |

> [!NOTE]
> **Ghi chú gốc từ Stakeholder về Giáo viên & Trợ giảng:**  
> _"Sau khi giáo viên bấm 'Duyệt', học viên mới thấy được kết quả. Có thể có nhiều giáo viên, vì sau có thể em sẽ tuyển trợ giảng."_  
> **Quyết định kiến trúc MVP:** Giữ 1 role `teacher` duy nhất cho toàn bộ người chấm bài (dùng chung tài khoản giáo viên cho các trợ giảng) để tối giản hoá phân quyền và kịp tiến độ dưới 1 tháng.

**Đăng nhập / Đăng ký trong MVP:** Email + Mật khẩu đơn giản (Better Auth). Chưa cần Google OAuth, chưa cần luồng xác thực email SMTP phức tạp.

---

# 4. Các Bất Biến Miền Cốt Lõi (Core Domain Invariants)

```text
HOMEWORK-01: Teacher is the final authority for Homework Assessment.
HOMEWORK-02: AI Assessment Proposal is never an official learner result.
HOMEWORK-03: AI failure must never prevent a Teacher from reviewing and grading Homework.

SUBMISSION-01: Learner may resubmit as long as Teacher Review has NOT started.
SUBMISSION-02: Learner MUST NOT resubmit once Teacher Review has started (UnderReview).
SUBMISSION-03: Teacher Review always targets the CurrentAttempt at the exact moment review starts.
SUBMISSION-04: Historical Submission Attempts are immutable snapshots and must never be overwritten.

ASSESSMENT-01: Teacher may accept an AI proposal without fake/unnecessary modifications.
ASSESSMENT-02: Teacher may grade completely manually without an AI proposal.
ASSESSMENT-03: Original AI Assessment Proposal must be preserved intact after Teacher modifications.

PUBLICATION-01 [SUPERSEDED by ADR-0009]: In MVP, approval and publication are unified into a single atomic action ("Duyệt & Công bố", Publish = Finalize TeacherAssessment + MakeOfficial PublishedAssessment).
PUBLICATION-02 [SUPERSEDED by ADR-0009]: There is no intermediate "Approved" state stored or visible separately; publishing atomically creates PublishedAssessment and transitions HomeworkSubmission to terminal.

MOCKTEST-01: Mock Test assessments publish automatically to the Learner upon AI completion.
PROMPT-01: Only Active Mock Test Prompts may be selected for a new Mock Test.
```

---

# 5. Đặc Tả Chi Tiết Các Module Tính Năng

## 5.1. Module Speaking (Trọng Tâm Cấp Bách Số 1)

### A. Ghi Âm & Thể Thức Làm Bài:

- **Ghi âm trực tiếp trên trình duyệt**: Sử dụng HTML5 MediaRecorder API + AudioWorklet (không bắt học viên tự upload file, xin quyền micro rõ ràng). Hỗ trợ cả máy tính và điện thoại.
- **Phân tách 2 thể thức Speaking (ADR-0008)**:
  1. `SpeakingDiscreteHomework`: Bài tập về nhà giao theo từng câu hỏi/task biệt lập (ví dụ 1 cue card Part 2 hoặc 3 câu Part 1). Học viên ghi âm riêng lẻ từng clip và nộp bài. Bắt buộc qua Giáo viên mở màn hình chấm âm thanh và duyệt bài.
  2. `SpeakingContinuousMockTest`: Thi thử 3 Parts liên tục với đồng hồ đếm ngược và giám khảo AI. AI chấm trọn gói và công bố kết quả ngay.

### B. 4 Tiêu Chí Chấm Điểm IELTS Speaking Chính Thức:

1. **Fluency and Coherence (FC)**: Độ trôi chảy, mạch lạc, tốc độ nói, khoảng ngập ngừng.
2. **Lexical Resource (LR)**: Vốn từ vựng, độ chính xác ngữ cảnh, thành ngữ học thuật.
3. **Grammatical Range and Accuracy (GRA)**: Độ đa dạng cấu trúc câu, độ chính xác ngữ pháp.
4. **Pronunciation (PR)**: Phát âm, ngữ điệu, trọng âm từ và câu, nối âm.

### C. Pipeline Xử Lý AI 2 Giai Đoạn (`speaking-evaluator.ts`):

- **Lưu trữ**: File âm thanh WebM/Opus được đẩy lên SeaweedFS (S3-compatible) qua Presigned Upload URL (ADR-0003, ADR-0004).
- **Pass 1 (Verbatim STT)**: Gemini chuyển giọng nói thành văn bản nguyên văn kèm timestamp millisecond.
- **Pass 2 (Examiner Scoring & Evidence)**: Gemini phân tích ngữ âm/ngữ pháp và sinh đề xuất điểm 4 tiêu chí kèm các ghi chú phát âm gắn đúng timestamp trong file âm thanh.
- **Làm tròn điểm chuẩn Cambridge**: Server tính trung bình cộng 4 tiêu chí và làm tròn ($<0.25 \to .0$, $0.25..0.75 \to .5$, $\ge 0.75 \to +1.0$).

---

## 5.2. Module Writing

- **Trình soạn thảo**: TipTap rich text editor tối ưu typography `.prose-essay` (measure $68\text{ch}$, line-height $1.8$), đếm từ tự động và cảnh báo khi bài viết chưa đạt độ dài tối thiểu (`TASK_1` < 150 từ, `TASK_2` < 250 từ).
- **4 Tiêu chí IELTS Writing**:
  1. _Task Achievement (Task 1) / Task Response (Task 2)_
  2. _Coherence and Cohesion (CC)_
  3. _Lexical Resource (LR)_
  4. _Grammatical Range and Accuracy (GRA)_
- **Gemini Structured Output Engine**: Sử dụng `@google/genai` với JSON Schema bắt buộc, kiểm tra CoT chống lạm phát điểm và Quote Grounding Verifier (loại bỏ hoàn toàn lỗi trích dẫn ảo).

---

## 5.3. Module Quản Lý Đề Bài & Kho Đề Thi Thử (Prompt Bank)

- **Soạn đề**: Giáo viên tạo đề bài mới, chọn loại (`Speaking Part 1/2/3`, `Writing Task 1/2`), nhập nội dung đề, chỉ định đề là "Thi thử" hay "Homework".
- **Kho đề thi thử theo quý (Quarterly Mock Test Bank)**:
  - Hệ thống quản lý trạng thái đề: `active` (đang dùng để random) và `retired` (đề cũ của quý trước được ẩn đi nhưng bảo toàn 100% lịch sử bài làm của học viên).
  - Lệnh nghiệp vụ: `ActivatePrompt`, `RetirePrompt`.
  - **Chính sách Random trong MVP**: Random 1 đề hoàn toàn ngẫu nhiên trong các đề `active` (chấp nhận có thể lặp đề để kịp tiến độ MVP; cơ chế chống trùng đề chuyển sang Phase 2).
  - **Nhập đề trong MVP**: Form nhập nhanh từng đề trên giao diện (nhập hàng loạt qua Excel/CSV chuyển sang Phase 2).

---

## 5.4. Module Quản Lý Lớp Học (Classroom & Homework)

- Giáo viên tạo lớp học (ví dụ: _"IELTS Speaking 7.0 - Khóa T8"_), đặt tên, mô tả.
- Thêm học viên vào lớp bằng địa chỉ email đã đăng ký tài khoản.
- Giáo viên giao Homework gắn riêng cho một lớp cụ thể (`HomeworkAssignment`).
- Một học viên có thể tham gia nhiều lớp học đồng thời.
- Giáo viên xem danh sách học viên trong lớp và trạng thái nộp bài (đã nộp, chưa nộp, đang chờ duyệt).

---

## 5.5. Module Duyệt Bài Của Giáo Viên (Teacher Review Workspace)

- **Giao diện Split-Pane Density Compact**:
  - Cột trái: Đề bài + Trình phát audio theo timestamp (Speaking) hoặc Bài viết TipTap với các highlight lỗi (Writing).
  - Cột phải: Bảng điểm `<AssessmentScorecard />`, danh sách gợi ý sửa lỗi AI, khung nhận xét tổng quát, và các nút `Lưu nháp`, `Duyệt bài`, `Công bố`.
- **Thao tác duyệt bài**:
  - Giáo viên nghe lại từng đoạn âm thanh, chỉnh sửa nhãn phát âm.
  - Sửa điểm trực tiếp trên slider từng tiêu chí (1.0 đến 9.0, bước 0.5).
  - Sau khi giáo viên bấm "Duyệt" và "Công bố", học viên mới thấy được kết quả chính thức.

---

## 5.6. Module Thu Thập Dữ Liệu Sạch (AI Calibration Dataset)

> [!NOTE]
> **Ghi chú gốc từ Stakeholder (Yêu cầu ban đầu §5.4):**  
> _"Giai đoạn 1 (MVP): Chỉ cần lưu lại đầy đủ dữ liệu mỗi lần giáo viên sửa (điểm AI chấm ban đầu vs. điểm giáo viên sửa lại, kèm bài làm gốc). Đây là bước 'thu thập dữ liệu', CHƯA CẦN AI tự động học ngay. Giai đoạn 2 (sau MVP): Dùng dữ liệu đã thu thập để tinh chỉnh prompt hoặc fine-tune mô hình."_

### Cơ Chế Lưu Trữ Tự Động:

- **Bảng `ai_assessment_proposals`**: Lưu nguyên vẹn 100% kết quả ban đầu của Gemini.
- **Bảng `homework_assessments`**: Lưu kết quả chính thức do Giáo viên chịu trách nhiệm.
- **Bảng `evaluation_feedbacks`**: Tự động được sinh ra khi Giáo viên duyệt bài, ghi nhận:
  - Delta chênh lệch điểm từng tiêu chí ($TA, CC, LR, GRA, PR$).
  - Danh sách lỗi do AI đề xuất mà giáo viên: _Chấp nhận (Accepted)_, _Chỉnh sửa (Modified)_, hoặc _Xóa bỏ (Rejected)_.
  - Danh sách lỗi/ghi chú mới do giáo viên tự thêm thủ công (_Teacher Added_).

---

## 5.7. Module Lịch Sử & Theo Dõi Tiến Trình

- **Góc nhìn Học viên**: Xem lại lịch sử các bài đã làm (thi thử + homework), điểm từng tiêu chí theo thời gian.
- **Góc nhìn Giáo viên**: Xem danh sách toàn bộ bài làm của từng học viên, điểm số các tiêu chí qua từng bài dạng bảng số liệu (biểu đồ đồ họa trực quan chuyển sang Phase 2).

---

# 6. Chuẩn Hoá Design System & Visual Language (ADR-0006, ADR-0007)

### 6.1. 5 Bộ Semantic Tokens Trong `@theme inline` (`globals.css`)

| Tiêu Chí                         | Semantic Token          | Màu Sắc     | Ứng Dụng                                                |
| :------------------------------- | :---------------------- | :---------- | :------------------------------------------------------ |
| **Task Achievement / Response**  | `--color-criterion-ta`  | **Emerald** | Bảng điểm TA/TR, highlight luận điểm, badge Expert      |
| **Coherence & Cohesion**         | `--color-criterion-cc`  | **Amber**   | Bảng điểm CC, từ nối mạch lạc, badge Modest             |
| **Lexical Resource**             | `--color-criterion-lr`  | **Blue**    | Bảng điểm LR, nâng cấp từ vựng C1/C2, badge Competent   |
| **Grammatical Range & Accuracy** | `--color-criterion-gra` | **Rose**    | Bảng điểm GRA, lỗi ngữ pháp/cấu trúc câu, badge Limited |
| **Pronunciation**                | `--color-criterion-pr`  | **Violet**  | Bảng điểm PR, dấu nhấn trọng âm, waveform audio marker  |

### 6.2. Visual Encoding 3 Tầng Cho Error Annotations

- `minor_slip` (Lỗi nhỏ, sơ suất): Gạch chân chấm bi (`border-b-2 border-dotted`).
- `systematic_error` (Lỗi hệ thống): Gạch chân nét liền (`border-b-2 border-solid`) + nền highlight 15%.
- `impedes_communication` (Lỗi cản trở hiểu nghĩa): Gạch lượn sóng (`underline wavy`) + cảnh báo destructive.

### 6.3. Component Chuẩn `<BandScoreBadge />`

- Tự động phân tầng 4 mức năng lực: $\ge 8.0$ (Emerald), $6.5-7.5$ (Blue), $5.0-6.0$ (Amber), $< 5.0$ (Rose).
- Hỗ trợ 4 kích thước: `sm`, `md`, `lg`, `xl`.
- Đảm bảo độ tương phản tiếp cận **WCAG 2.1 AA** ($\ge 4.5:1$).

### 6.4. Density Tiers

- **Compact (12px padding, gap-3)**: Áp dụng cho Teacher Review multi-pane cockpit.
- **Standard (16px padding, gap-4)**: Áp dụng cho Modal, Card nội dung, Form đăng ký.
- **Spacious (24px padding, gap-6)**: Áp dụng cho Learner Dashboard & Trang thi thử.

---

# 7. Đối Chiếu & Giải Quyết Các Câu Hỏi Kỹ Thuật Ban Đầu (Resolved Matrix)

Bảng đối chiếu giữa các câu hỏi mở trong bản ghi yêu cầu ban đầu (§7) với các quyết định kiến trúc đã chốt:

| Câu hỏi ban đầu (Stakeholder)             | Giải pháp kỹ thuật đã chọn                                                                               | Tài liệu tham chiếu                             |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| **Dịch vụ Speech-to-Text nào?**           | Google Gemini 2-Stage Audio Pipeline (Pass 1 Verbatim STT, Pass 2 Examiner Scoring).                     | `speaking-evaluator.ts`, ADR-0004               |
| **LLM nào để chấm?**                      | Google Gemini Interactions API (`gemini-3.5-flash-lite` mặc định, `gemini-3.7-flash` cho phân tích sâu). | `docs/research/writing-ai-assessment-schema.md` |
| **Lưu trữ file âm thanh ở đâu?**          | SeaweedFS self-hosted (S3-compatible API) qua Presigned Upload URLs.                                     | ADR-0003, ADR-0004                              |
| **Giới hạn số lượt làm bài/ngày?**        | Không giới hạn trong MVP vì quy mô ban đầu nhỏ (vài chục học viên).                                      | ADR-0008                                        |
| **Giao diện ghi âm hỗ trợ thiết bị nào?** | Hỗ trợ cả Desktop Web và Mobile Web qua MediaRecorder API + AudioWorklet.                                | `lib/audio/worklets/microphone-worklet.ts`      |

---

# 8. Phân Định Phạm Vi MVP & Ngoài Phạm Vi (MVP Scope vs Out of Scope)

### Bắt Buộc Có Trong MVP (Deadline < 1 Tháng):

1. Đăng ký / Đăng nhập email-password đơn giản (Better Auth).
2. Giáo viên tạo lớp học, thêm học viên vào lớp bằng email.
3. Giáo viên đăng đề bài (Speaking + Writing), quản lý kho đề Active/Retired, gán Homework cho lớp.
4. Học viên làm Speaking Homework (ghi âm) $\rightarrow$ AI chấm trước $\rightarrow$ Giáo viên duyệt $\rightarrow$ Học viên xem kết quả.
5. Học viên làm Writing Homework (nhập văn bản) $\rightarrow$ AI chấm trước $\rightarrow$ Giáo viên duyệt $\rightarrow$ Học viên xem kết quả.
6. Học viên làm Mock Test (random đề active) $\rightarrow$ AI chấm và công bố kết quả ngay.
7. Giáo viên xem lịch sử bài làm và điểm số của từng học viên dạng bảng.
8. Tự động lưu trữ bảng `EvaluationFeedback` (dữ liệu sạch phục vụ cải thiện AI ở Phase 2).

### Ngoài Phạm Vi MVP (Chuyển Sang Phase 2):

```text
- Tích hợp cổng thanh toán
- Đăng nhập Google OAuth / Quên mật khẩu qua email SMTP
- AI tự động fine-tune trong thời gian thực
- Thuật toán chống trùng đề thi thử 100%
- Nhập đề hàng loạt qua file Excel/CSV
- Biểu đồ đồ họa xu hướng điểm số (MVP dùng bảng số liệu)
- Mời học viên vào lớp qua mã code / link tham gia
- Phân quyền nhiều cấp (Trợ giảng có tài khoản riêng)
- Sửa lại bài sau khi đã Published
```

---

# 9. Lộ Trình Triển Khai Theo Vertical Slice (Delivery Order)

```text
Phase 1 (Cấp bách số 1 - Speaking Golden Path):
  Học viên ghi âm Speaking Homework (từng câu)
  → SeaweedFS Presigned Upload
  → Gemini 2-Stage STT & Scoring
  → Teacher Review Workspace chấm âm thanh theo timestamp
  → Teacher Approve & Publish
  → Học viên xem kết quả chính thức.

Phase 2 (Writing Golden Path):
  Học viên làm Writing Homework trên TipTap
  → Gemini Structured Output Scoring
  → Teacher Review Workspace sửa lỗi & duyệt bài
  → Publish kết quả.

Phase 3 (AI Feedback Dataset Pipeline):
  Tự động ghi nhận bảng EvaluationFeedback khi duyệt bài
  → Xuất báo cáo hiệu chuẩn AI dạng JSONL.

Phase 4 (Mock Test Suite):
  Học viên làm Speaking Mock Test (3 parts liên tục) & Writing Mock Test
  → AI chấm và tự động công bố kết quả ngay lập tức.

Phase 5 (Classroom & Progress Tracking):
  Giáo viên quản lý danh sách lớp, thêm học viên bằng email
  → Bảng theo dõi tiến độ điểm số của từng học viên qua thời gian.
```

---

# 10. Kịch Bản Chấp Nhận Nghiệp Vụ Mẫu (Gherkin Acceptance Scenarios)

### Kịch bản 1: Speaking Golden Path (Ưu Tiên #1)

```gherkin
Given Học viên được giao bài tập Speaking Homework
When Học viên ghi âm câu trả lời trên trình duyệt và bấm nộp bài
Then File âm thanh được tải lên SeaweedFS an toàn
And Bản ghi SubmissionAttempt mới được tạo
And AI tự động thực hiện 2-stage STT & chấm 4 tiêu chí
And Giáo viên mở Teacher Review Workspace
And Giáo viên nghe âm thanh theo timestamp, sửa điểm và hoàn thiện TeacherReviewDraft
When Giáo viên bấm "Duyệt & Công bố" (Atomic Publish theo ADR-0009)
Then Bản ghi PublishedAssessment chính thức được tạo và trạng thái HomeworkSubmission chuyển thành Published
And Học viên nhìn thấy bảng điểm chính thức kèm nhận xét chi tiết
And Bản ghi EvaluationFeedback được lưu lại vào cơ sở dữ liệu.
```

### Kịch bản 2: Khóa Bài Nộp Khi Giáo Viên Bắt Đầu Chấm (Review Lock)

```gherkin
Given Học viên đã nộp Attempt #1 cho bài tập Homework
And Giáo viên bấm "Bắt đầu Chấm bài" (Start Review)
Then Attempt #1 trở thành ReviewedAttempt
And Trạng thái HomeworkSubmission chuyển thành UnderReview
When Học viên cố gắng bấm Resubmit bài làm
Then Hệ thống từ chối yêu cầu với lỗi HomeworkIsAlreadyUnderReview.
```

### Kịch bản 3: Thi Thử Tự Động Công Bố (Mock Test Instant Result)

```gherkin
Given Học viên chọn "Làm bài thi thử"
When Hệ thống chọn ngẫu nhiên một đề từ kho ActivePrompt
And Học viên hoàn thành và nộp bài
Then AI đánh giá bài thi theo chuẩn Cambridge
And Kết quả được công bố ngay lập tức (Published) cho học viên
And Không yêu cầu giáo viên phải duyệt bài.
```
