# IELTS Speaking Pilot: Specification Acceptance Contract & Handoff Boundary

**Tài liệu:** `docs/specs/speaking-pilot-acceptance-contract.md`  
**Trạng thái:** Approved / Authoritative  
**Giai đoạn:** Wayfinder -> Implementation Planning Handoff  
**Tham chiếu:** [Ticket #52](https://github.com/manh-nd/ielts-learning-platform/issues/52), [Ticket #49](https://github.com/manh-nd/ielts-learning-platform/issues/49), [CONTEXT.md](../../CONTEXT.md)  
**ADRs liên quan:** [ADR-0004](../adr/0004-speaking-session-schema-and-seaweedfs-audio-pipeline.md), [ADR-0005](../adr/0005-storybook-vitest-and-playwright-visual-testing-architecture.md), [ADR-0008](../adr/0008-speaking-first-slice-and-discrete-homework-architecture.md), [ADR-0009](../adr/0009-mvp-domain-aggregate-roots-and-consistency-boundaries.md), [ADR-0010](../adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md)

---

## 1. Mục tiêu & Nguyên tắc Phân định Ranh giới Handoff

Tài liệu này xác lập bộ quy chuẩn kỹ thuật và hợp đồng bàn giao (Handoff Contract) chính thức để kết thúc giai đoạn Wayfinder và chuyển giao sang Implementation Planning. Ranh giới giữa hai giai đoạn được phân tách rạch ròi theo nguyên tắc:

1. **Specification / Wayfinder Readiness (Tiêu chí hoàn tất trong Planning)**:
   - Mọi luồng trải nghiệm (Golden Paths & Failure Paths), ma trận trạng thái (State Transition Matrices), kịch bản nghiệm thu BDD (`Given-When-Then`), quy tắc xử lý xung đột (Concurrency Lock), chính sách bảo vệ dữ liệu (Data Governance) và schema sự kiện đo lường (Telemetry) phải được đặc tả trọn vẹn, không còn điểm suy diễn ngầm.
2. **Pilot Success Metrics (Chỉ số vận hành thực tế)**:
   - Các chỉ số đo lường thế giới thực ($\ge 10$ bài nộp, thời gian chấm giảm $\ge 30\%$, tỷ lệ chấp nhận AI proposal $\ge 50\%$, tỷ lệ lỗi kỹ thuật $< 2\%$) là mục tiêu đo đạc sau khi hệ thống triển khai và vận hành với người dùng thật, **không phải là điều kiện để đóng giai đoạn planning**.

---

## 2. Ranh giới Cắt gọt Phạm vi (Hard Scope Exclusions for Pilot MVP)

Để kiểm soát rủi ro phình to phạm vi (scope creep) và tập trung chứng minh giá trị cốt lõi, các hạng mục sau đây **DỨT KHOÁT NẰM NGOÀI PHẠM VI (HARD OUT-OF-SCOPE)** của Pilot MVP:

1. **Quản lý lớp học nâng cao (Co-teaching & Multi-teacher)**: Mỗi `Classroom` thuộc quyền sở hữu duy nhất của 1 Teacher tạo ra nó. Không hỗ trợ đồng giảng dạy, phân quyền trợ giảng (TA), hoặc chuyển nhượng lớp.
2. **Xử lý cắt ghép âm thanh (Audio Waveform Trimming/Editing)**: Client chỉ cung cấp trình phát kiểm tra lại âm thanh đã thu. Nếu học viên chưa hài lòng, hệ thống chỉ hỗ trợ hành động _"Thu âm lại toàn bộ clip"_ (`Re-record`). Tuyệt đối không xây dựng công cụ cắt/nối sóng âm.
3. **Đồng hồ cưỡng bức phòng thi Speaking Part 2**: Không triển khai luồng đếm ngược 1 phút chuẩn bị / 2 phút ngắt mic tự động chuẩn exam simulation. Trong Pilot, Speaking Practice và Homework chỉ áp dụng đồng hồ đếm thời lượng ghi âm thực tế kèm ngưỡng an toàn tối đa (`MAX_RECORDING_DURATION_SEC = 240`).
4. **Hàng đợi ngoại tuyến (Offline Sync Queue)**: Không xây dựng cơ chế Service Worker lưu trữ bản thu khi mất mạng hoàn toàn để tự động đồng bộ sau đó. Nếu mất kết nối trong quá trình upload, client cung cấp nút _"Thử tải lên lại"_ (`Retry Upload`) với audio buffer còn giữ trong bộ nhớ.
5. **Ứng dụng di động Native (Native Mobile App)**: Nền tảng vận hành 100% trên nền tảng Web tiêu chuẩn (Responsive Web / Progressive Web Application) tối ưu cho Chrome và Safari (iOS).

---

## 3. Golden Paths (Luồng Trải nghiệm Chuẩn)

### 3.1 Speaking Practice (Learner Sandbox)

1. **Consent Gate**: Learner (18+) truy cập Practice, hệ thống hiển thị `FreeTierConsentNotice` ([ADR-0010](../adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md)). Học viên xác nhận đồng ý điều khoản xử lý dữ liệu trước khi trình duyệt yêu cầu quyền microphone.
2. **Cấp quyền Microphone**: Client yêu cầu `getUserMedia({ audio: true })`. Trạng thái mic hiển thị trực quan qua VU meter / audio visualizer.
3. **Nhận Đề bài**: Hệ thống hiển thị câu hỏi luyện tập (Speaking Part 1 hoặc Cue Card Part 2) từ ngân hàng Active Prompt.
4. **Thu âm (Dual Capture)**: Học viên bấm _"Bắt đầu nói"_. Hệ thống ghi song song `MediaRecorder` và in-memory raw 16kHz PCM buffer ([Research #50](../research/speaking-practice-hardening-resilience.md)).
5. **Hoàn tất & Nghe lại**: Học viên bấm _"Hoàn thành"_. Client đóng stream, xuất Blob (tự động fallback WAV nếu `MediaRecorder` rỗng), hiển thị audio player để học viên nghe lại bản thu của chính mình.
6. **Nộp bài lấy nhận xét (Dispatch AI)**: Học viên bấm _"Nhận đánh giá AI"_. Client upload audio lên S3/SeaweedFS, khởi tạo `SpeakingPractice` ở trạng thái `completed`, và kích hoạt bất đồng bộ `PracticeEvaluation`.
7. **Hiển thị PracticeFeedback**: Client lắng nghe kết quả AI qua SSE/polling. Khi AI xử lý xong, giao diện hiển thị `PracticeFeedback` (ước tính band điểm, điểm mạnh, ưu tiên cải thiện, câu trả lời gợi ý) kèm nhãn cảnh báo rõ ràng _"Kết quả thử nghiệm - Không phải chứng chỉ chính thức"_.
8. **Practice Again**: Học viên có thể bấm _"Luyện tập lại"_ để mở một phiên Practice hoàn toàn mới.

> [!IMPORTANT]
> Toàn bộ audio, transcript và feedback của `SpeakingPractice` thuộc quyền sở hữu riêng tư của Learner. Giáo viên **hoàn toàn không có quyền truy cập** (Zero Teacher Access) vào dữ liệu Practice.

### 3.2 Speaking Homework (Classroom Coursework)

1. **Teacher Giao bài**: Teacher tạo `HomeworkAssignment` trong Classroom, chọn từ 1 đến 3 Prompt items rời rạc, thiết lập `SubmissionDeadline`.
2. **Learner Nhận bài & Thu âm**: Learner mở Assignment, lần lượt thu âm từng clip trả lời độc lập cho từng Prompt item, nghe lại kiểm tra chất lượng.
3. **Nộp bài (Submit Attempt)**: Learner bấm _"Nộp bài"_. Hệ thống đóng gói các clip âm thanh thành một `SubmissionAttempt` bất biến và kích hoạt `HomeworkEvaluation` chạy ngầm.
4. **AI Xử lý Đề xuất**: `HomeworkEvaluation` phân tích bài làm và sinh ra `AiAssessmentProposal`. Dữ liệu này **tuyệt đối ẩn** đối với Learner.
5. **Teacher Review Cockpit**:
   - Teacher mở bài nộp của học viên. Hệ thống kích hoạt cơ chế `First-Committed-Wins` khóa `ReviewedAttempt` ([ADR-0009](../adr/0009-mvp-domain-aggregate-roots-and-consistency-boundaries.md)).
   - Hệ thống khởi chạy `ActiveReviewTimer` (tự động tạm dừng khi ẩn tab hoặc bất hoạt > 60s).
   - Teacher nghe từng đoạn audio, xem đề xuất của AI (hoặc tự nhập điểm từ đầu nếu AI thất bại), chỉnh sửa điểm 4 tiêu chí và nhận xét chi tiết.
6. **Duyệt bài Nguyên tử (Atomic Publish)**: Teacher bấm _"Duyệt & Công bố"_ (`Publish`). Hệ thống chuyển đổi `TeacherAssessment` thành `PublishedAssessment`, chốt `active_review_duration_ms`, ghi nhận dữ liệu đối soát `EvaluationFeedback`, và chuyển `HomeworkSubmission` sang trạng thái hoàn tất.
7. **Learner Xem Kết quả**: Learner nhận thông báo bài đã được chấm, xem `PublishedAssessment` chính thức từ Giáo viên (không nhìn thấy raw AI proposal hay lịch sử sửa điểm).

---

## 4. Failure Paths & Cơ chế Tự phục hồi (Recovery Workflows)

| Tình huống lỗi (Failure Scenario)                   | Hành vi Hệ thống & Cơ chế Phục hồi (Recovery Behavior)                         | Trạng thái UI & Trải nghiệm Người dùng                                                                                                                                                                                                                                                            |
| :-------------------------------------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Microphone Permission Denied**                    | Trình duyệt từ chối quyền microphone (`NotAllowedError`).                      | Hiển thị modal hướng dẫn trực quan cách mở lại quyền mic trên trình duyệt. Khóa nút bắt đầu ghi âm cho đến khi quyền được cấp lại.                                                                                                                                                                |
| **WebKit Audio Truncation / 0-byte Blob**           | iOS Safari đóng `MediaRecorder` trả về mảng chunk rỗng hoặc mất đuôi âm thanh. | Cơ chế Dual Capture tự động kích hoạt `pcmBase64ChunksToWavBlob()` chuyển đổi in-memory raw PCM thành file WAV chuẩn RIFF hợp lệ 16kHz Mono ([Research #50](../research/speaking-practice-hardening-resilience.md)). Không mất bản thu.                                                           |
| **Mất kết nối mạng khi tải âm thanh (Upload Drop)** | Lời gọi upload âm thanh lên S3/SeaweedFS bị ngắt quãng do rớt mạng.            | Client giữ audio Blob trong bộ nhớ, hiển thị thông báo lỗi mạng kèm nút _"Thử tải lên lại"_. Không hủy bỏ phiên thu âm của học viên.                                                                                                                                                              |
| **AI Evaluation Timeout / Model Failure**           | Dịch vụ AI (Gemini) quá tải, trả về lỗi hoặc timeout sau 3 lần retry.          | Tách bạch bất biến `PracticeEnded != PracticeEvaluated` và `AiEvaluationFailed != SubmissionFailed`. Với Practice: hiển thị nút _"Thử phân tích lại"_ (tái sử dụng audio đã upload). Với Homework: Teacher buồng lái hiển thị thông báo AI không khả dụng và cho phép Teacher chấm thủ công 100%. |
| **Xung đột Nộp bài (Race Condition 409 Conflict)**  | Learner nộp Attempt 2 đúng lúc Teacher bấm mở chấm Attempt 1.                  | Giao dịch của Teacher commit trước. Request của Learner bị từ chối với `HTTP 409 Conflict` (`SUBMISSION_UNDER_REVIEW`). UI hiển thị banner cảnh báo: _"Bài làm đã được Giáo viên tiếp nhận chấm, không thể nộp lại"_ và chuyển sang Read-only.                                                    |

---

## 5. Domain Aggregate Lifecycles & State Transition Matrices

### 5.1 `SpeakingPractice` Lifecycle Matrix

| Trạng thái Hiện tại | Sự kiện Kích hoạt (Event Trigger)     | Trạng thái Mới            | Ràng buộc Bất biến (Invariants)                                                                                     |
| :------------------ | :------------------------------------ | :------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| `[None]`            | Learner xác nhận Consent & Bắt đầu    | `in_progress`             | Tạo ID phiên, lưu metadata thiết bị.                                                                                |
| `in_progress`       | Learner bấm Hoàn thành & Upload audio | `completed`               | Audio blob được lưu trữ bất biến trên storage.                                                                      |
| `in_progress`       | Bỏ dở không có tương tác > 24 giờ     | `abandoned` -> `[Purged]` | Tự động dọn dẹp sau 24h ([ADR-0010](../adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md)). |
| `completed`         | Learner yêu cầu Hard Delete           | `deleted`                 | Xóa vĩnh viễn audio trên storage và xóa DB record.                                                                  |
| `completed`         | Quá thời hạn lưu trữ 14 ngày          | `audio_purged`            | Xóa audio binary, chỉ giữ thống kê ẩn danh.                                                                         |

### 5.2 `PracticeEvaluation` Lifecycle Matrix

| Trạng thái Hiện tại | Sự kiện Kích hoạt (Event Trigger) | Trạng thái Mới | Ràng buộc Bất biến (Invariants)                           |
| :------------------ | :-------------------------------- | :------------- | :-------------------------------------------------------- |
| `[None]`            | Audio upload thành công           | `pending`      | Khởi tạo evaluation record, liên kết `practice_id`.       |
| `pending`           | Worker/Background task tiếp nhận  | `processing`   | Tạo `EvaluationRun` lần 1.                                |
| `processing`        | AI hoàn tất phân tích hợp lệ      | `ready`        | Tạo `PracticeFeedback`, client nhận qua SSE/polling.      |
| `processing`        | AI timeout / lỗi API              | `failed`       | Ghi nhận lỗi vào run. Phiên Practice vẫn giữ `completed`. |
| `failed`            | Learner bấm "Thử phân tích lại"   | `pending`      | Tạo `EvaluationRun` mới, không ghi đè run cũ.             |

### 5.3 `HomeworkSubmission` & `TeacherReviewDraft` Lifecycle Matrix

| Trạng thái Hiện tại | Sự kiện Kích hoạt (Event Trigger)            | Trạng thái Mới | Ràng buộc Bất biến (Invariants)                                                    |
| :------------------ | :------------------------------------------- | :------------- | :--------------------------------------------------------------------------------- |
| `[None]`            | Learner nộp bài lần đầu trước deadline       | `submitted`    | Tạo `SubmissionAttempt` #1 (bất biến).                                             |
| `submitted`         | Learner nộp lại trước deadline & chưa review | `submitted`    | Tạo `SubmissionAttempt` #2, cập nhật `CurrentAttempt`.                             |
| `submitted`         | Teacher mở buồng lái & bấm bắt đầu chấm      | `in_review`    | Khóa `ReviewedAttempt = CurrentAttempt`. Mọi attempt mới bị chặn với 409 Conflict. |
| `in_review`         | Teacher lưu bản nháp đánh giá                | `in_review`    | Cập nhật `TeacherReviewDraft` cục bộ trong transaction.                            |
| `in_review`         | Teacher bấm "Duyệt & Công bố" (`Publish`)    | `published`    | Đóng gói nguyên tử `PublishedAssessment`. Kết thúc chấm. Không thể sửa lại.        |

---

## 6. Bộ Kịch bản Nghiệm thu Chuẩn hóa (BDD Acceptance Matrix)

### Kịch bản 1: Practice Golden Path (Thành công trọn vẹn)

- **Given**: Học viên đã đăng nhập, đủ 18 tuổi và chưa cấp quyền mic cho trang Practice.
- **When**: Học viên truy cập trang Practice, nhấn đồng ý thông báo `FreeTierConsentNotice`, chấp nhận quyền microphone trình duyệt, bấm _"Bắt đầu nói"_, nói trong 45 giây, bấm _"Hoàn thành"_, và bấm _"Nhận đánh giá AI"_.
- **Then**:
  1. Bản thu âm được tải lên storage thành công với định dạng hợp lệ.
  2. Bảng `telemetry_events` ghi nhận `practice_started`, `practice_audio_recorded`, `practice_submitted_for_feedback`.
  3. Giao diện hiển thị trạng thái chờ phân tích của AI.
  4. Trong vòng 15 giây, giao diện hiển thị `PracticeFeedback` với đầy đủ 4 tiêu chí điểm số và nhận xét.
  5. Giáo viên trong hệ thống không thể nhìn thấy hoặc truy cập phiên luyện tập này qua bất kỳ URL nào.

### Kịch bản 2: Phục hồi khi Safari sinh ra Audio 0-byte (Failure Recovery)

- **Given**: Học viên sử dụng trình duyệt WebKit trên iOS, luồng thu âm bị lỗi ngắt quãng khiến `MediaRecorder` trả về mảng buffer rỗng khi gọi `.stop()`.
- **When**: Học viên hoàn tất câu trả lời và bấm _"Hoàn thành"_.
- **Then**:
  1. Hệ thống client tự động phát hiện chunk rỗng và kích hoạt hàm fallback `pcmBase64ChunksToWavBlob()`.
  2. File âm thanh WAV 16kHz chuẩn RIFF được tạo ra từ in-memory PCM buffer mà không báo lỗi cho học viên.
  3. Audio player phát lại bình thường âm thanh học viên vừa nói.
  4. Quá trình upload và chấm điểm AI tiếp diễn thành công.

### Kịch bản 3: First-Committed-Wins Concurrency Conflict (409 Conflict)

- **Given**: Học viên A đã nộp `SubmissionAttempt` #1 cho bài tập Homework. Hạn nộp bài chưa kết thúc.
- **When**: Giáo viên mở buồng lái chấm bài của Học viên A và bấm _"Bắt đầu chấm"_. Đồng thời, Học viên A bấm nút _"Nộp bản làm mới"_ (`Resubmit Attempt #2`).
- **Then**:
  1. Transaction của Giáo viên commit thành công trước, chuyển trạng thái Submission sang `in_review` và khóa `ReviewedAttempt` là Attempt #1.
  2. Yêu cầu nộp bài của Học viên A bị từ chối với mã lỗi `HTTP 409 Conflict`.
  3. Giao diện Học viên A xuất hiện thông báo cảnh báo: _"Bài làm của bạn đã được Giáo viên tiếp nhận chấm điểm, không thể cập nhật bản nộp mới"_.
  4. Nút nộp bài của Học viên bị vô hiệu hóa, màn hình chuyển sang chế độ xem chỉ đọc.

### Kịch bản 4: Xử lý Đề xuất AI Thất bại trong Buồng lái Giáo viên

- **Given**: Học viên nộp bài Homework, nhưng dịch vụ Gemini gặp sự cố khiến `HomeworkEvaluation` chuyển sang trạng thái `failed`.
- **When**: Giáo viên mở buồng lái chấm bài tập đó.
- **Then**:
  1. Hệ thống không chặn buồng lái chấm bài và không hiển thị màn hình crash.
  2. Giao diện hiển thị thông báo: _"Đề xuất tự động từ AI tạm thời không khả dụng. Thầy/Cô vui lòng chấm điểm trực tiếp."_
  3. Form nhập điểm 4 tiêu chí và ô nhận xét được mở trống để Giáo viên chấm thủ công từ đầu.
  4. Giáo viên hoàn tất chấm và bấm _"Duyệt"_, `PublishedAssessment` được công bố bình thường cho học viên.

### Kịch bản 5: Đo lường Active Engagement Timer của Giáo viên

- **Given**: Giáo viên mở buồng lái chấm bài tập của học viên.
- **When**:
  1. Giáo viên chấm bài trong 90 giây.
  2. Giáo viên chuyển sang tab trình duyệt khác trong 120 giây (tab review bị ẩn).
  3. Giáo viên quay lại tab review, chấm thêm 60 giây rồi bấm _"Duyệt"_.
- **Then**:
  1. Timer tự động tạm dừng trong suốt 120 giây tab bị ẩn (`document.visibilityState === 'hidden'`).
  2. Tổng thời gian `active_review_duration_ms` được ghi nhận trong cơ sở dữ liệu là xấp xỉ 150 giây (2.5 phút), không tính 120 giây rác.

---

## 7. Telemetry & Observability Contract

### 7.1 Cấu trúc Dữ liệu `telemetry_events`

Mọi sự kiện đo lường hành vi và độ tin cậy được lưu trữ trực tiếp vào cơ sở dữ liệu PostgreSQL qua endpoint `POST /api/telemetry/events`:

```sql
CREATE TABLE telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('learner', 'teacher', 'system')),
    event_name VARCHAR(64) NOT NULL,
    context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('practice', 'homework', 'system')),
    context_id UUID,
    duration_ms INTEGER,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_event_name_created ON telemetry_events (event_name, created_at);
CREATE INDEX idx_telemetry_context ON telemetry_events (context_type, context_id);
```

### 7.2 Danh mục Sự kiện Chuẩn (Event Taxonomy)

#### Speaking Practice Events

- `practice_started`: Học viên bấm bắt đầu phiên luyện tập.
- `practice_audio_recorded`: Thu âm thành công một clip (kèm `duration_ms` và `audio_bytes`).
- `practice_submitted_for_feedback`: Học viên bấm gửi yêu cầu phân tích AI.
- `practice_feedback_ready`: AI trả về kết quả `PracticeFeedback` thành công (kèm `duration_ms` phản hồi).
- `practice_again_started`: Học viên bấm luyện tập lại từ màn hình kết quả.
- `practice_audio_error`: Gặp lỗi phần cứng mic, WebKit 0-byte, hoặc lỗi encoding (kèm error code).
- `practice_purged`: Hệ thống thực hiện xóa hard-delete hoặc auto-purge theo chính sách retention.

#### Speaking Homework Events

- `homework_viewed`: Học viên hoặc Giáo viên mở xem chi tiết bài tập.
- `homework_record_completed`: Học viên thu âm xong một discrete prompt item.
- `homework_submitted`: Học viên gửi thành công bài nộp (`SubmissionAttempt`).
- `homework_resubmitted`: Học viên gửi thành công bài nộp lại trước hạn và trước khi review.
- `homework_submit_conflict_rejected`: Yêu cầu nộp bị chặn bởi HTTP 409 Conflict do Teacher đang chấm.
- `teacher_review_opened`: Giáo viên mở buồng lái review của một bài nộp.
- `teacher_ai_proposal_accepted`: Giáo viên chấp nhận hoặc sửa nhẹ đề xuất AI.
- `teacher_ai_proposal_rejected`: Giáo viên bấm bác bỏ toàn bộ đề xuất AI và chấm lại từ đầu.
- `teacher_assessment_published`: Giáo viên bấm Duyệt & Công bố điểm (kèm `active_review_duration_ms`).

### 7.3 Công thức Tính Toán Chỉ số Thành công Pilot (Success Formulas)

1. **Teacher Review-Time Reduction ($\ge 30\%$)**:
   $$\text{Reduction Rate} = \frac{\text{Baseline Time} - \text{Avg}(\text{active\_review\_duration\_ms})}{\text{Baseline Time}} \times 100\%$$
   _(Baseline Time được xác lập qua khảo sát thực nghiệm trước pilot đối với quy trình chấm thủ công)._

2. **AI Proposal Acceptance Rate ($\ge 50\%$)**:
   Một bài chấm được tính là **Chấp nhận / Sửa nhẹ** khi thỏa mãn đồng thời:
   - Giáo viên **không** kích hoạt sự kiện `teacher_ai_proposal_rejected`.
   - $|\text{Teacher Overall Band} - \text{AI Overall Band}| \le 0.5$.
   - Không quá 1 tiêu chí thành phần có $|\text{Teacher Criterion} - \text{AI Criterion}| \ge 1.0$.
     $$\text{Acceptance Rate} = \frac{\text{Số bài chấm Chấp nhận / Sửa nhẹ}}{\text{Tổng số bài chấm có AI proposal}} \times 100\%$$

3. **Technical Error Rate ($< 2\%$)**:
   $$\text{Error Rate} = \frac{\text{Count}(\text{practice\_audio\_error})}{\text{Count}(\text{practice\_started})} \times 100\% < 2.0\%$$

---

## 8. Triple-Tier Testing Gate (Phân tầng Kiểm thử Bắt buộc)

Trước khi nghiệm thu bất kỳ PR tính năng nào trong giai đoạn Implementation, mã nguồn phải vượt qua 3 tầng kiểm thử nghiêm ngặt:

1. **Vitest Unit/Integration Tests (`bun run test`)**:
   - Kiểm thử 100% các quy tắc chuyển đổi trạng thái trong State Transition Matrix.
   - Kiểm thử logic xử lý đồng thời First-Committed-Wins với database transactions thực tế.
   - Kiểm thử chính sách RBAC: Giáo viên bị từ chối truy cập 100% vào dữ liệu Speaking Practice.
2. **Storybook Interaction & A11y Tests (`bun run test:storybook`)**:
   - Kiểm thử toàn bộ các trạng thái giao diện cô lập: `empty`, `loading`, `recording`, `audio_error`, `locked_attempt_banner`, `review_cockpit`.
   - Đảm bảo **không có bất kỳ vi phạm trợ năng nào** (`a11y: { test: "error" }`).
3. **Playwright E2E Tests (`ENABLE_E2E_MOCK_AUTH=true bun run test:e2e`)**:
   - Kiểm thử trọn vẹn luồng người dùng thực tế:
     - Practice Golden Path (từ lúc vào phòng đến lúc nhận kết quả).
     - Homework Submission -> AI dispatch -> Teacher Review Cockpit -> Publish.
     - Race condition test: Bắn 2 request đồng thời (resubmit vs review start) và kiểm tra HTTP 409 phản hồi đúng kỳ vọng.

---

## 9. Wayfinder Handoff Checklist & Exit Criteria

Giai đoạn Wayfinder cho IELTS Speaking kết thúc khi và chỉ khi:

- [x] Đã ban hành toàn diện chính sách bảo vệ dữ liệu và lưu trữ âm thanh ([ADR-0010](../adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md)).
- [x] Đã hoàn thành nghiên cứu kỹ thuật chống lỗi âm thanh đa nền tảng và resilience ([Research #50](../research/speaking-practice-hardening-resilience.md)).
- [x] Đã thông qua bộ tiêu chuẩn nghiệm thu và ranh giới bàn giao `docs/specs/speaking-pilot-acceptance-contract.md` ([Ticket #52](https://github.com/manh-nd/ielts-learning-platform/issues/52)).
- [ ] Phân rã backlog thành các Implementation Epics/Tasks chi tiết trên GitHub Issue Tracker theo nguyên tắc _Practice-first, Homework-second_.
- [ ] Đóng chính thức Ticket [#52](https://github.com/manh-nd/ielts-learning-platform/issues/52).
