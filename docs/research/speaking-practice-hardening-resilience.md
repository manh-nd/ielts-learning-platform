# Research: Kỹ thuật Hardening, Độ tin cậy Audio & An toàn Vận hành cho Speaking Practice

**Ticket:** [#50](https://github.com/manh-nd/ielts-learning-platform/issues/50)  
**Tài liệu tham chiếu:** `docs/research/speaking-practice-hardening-resilience.md`  
**Liên quan:** [#61](https://github.com/manh-nd/ielts-learning-platform/issues/61) (Practice Lifecycle), [#55](https://github.com/manh-nd/ielts-learning-platform/issues/55) (AI Resilience), [#60](https://github.com/manh-nd/ielts-learning-platform/issues/60) & [ADR-0010](docs/adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md) (Data Governance), [ADR-0004](docs/adr/0004-speaking-session-schema-and-seaweedfs-audio-pipeline.md) (Storage Pipeline)  
**Status:** Completed

---

## Bối cảnh & Mục tiêu

Sau khi hợp đồng hành vi và vòng đời sản phẩm của `SpeakingPractice` được chốt tại [#61](https://github.com/manh-nd/ielts-learning-platform/issues/61) và chính sách quản trị dữ liệu được ban hành tại [ADR-0010](docs/adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md), nghiên cứu này giải quyết trực diện 6 khoảng trống kỹ thuật P0 (P0 Technical Gaps) nhằm đảm bảo hệ thống âm thanh và hạ tầng AI đạt tỷ lệ lỗi kỹ thuật **< 2%** trước khi bước vào thử nghiệm pilot.

---

## 1. Audio Completion & Recording Reliability (Độ tin cậy Thu âm Đa Nền tảng)

### 1.1 Vấn đề Kỹ thuật (Technical Gaps)

- **WebKit / Mobile Safari (iOS)**:
  1. Sự kiện `stop()` của `MediaRecorder` là bất đồng bộ: `ondataavailable` phát ra chunk cuối cùng có độ trễ so với lời gọi `stop()`. Nếu ứng dụng đọc trực tiếp mảng buffer mà không đợi event `stop` kích hoạt, file âm thanh sẽ bị mất phần đuôi (audio truncation).
  2. Một số phiên bản iOS WebKit sinh ra Blob 0 bytes hoặc lỗi silent fail nếu khoảng thời gian thu âm quá ngắn (< 500ms) hoặc `timeslice` quá nhỏ.
  3. Mã hóa container: iOS Safari 16.4+ hỗ trợ `audio/webm;codecs=opus`, tuy nhiên các thiết bị iOS cũ hơn chỉ hỗ trợ native container `audio/mp4;codecs=aac`.
- **Chromium / Android**:
  Mặc định tối ưu `audio/webm;codecs=opus` nhưng có thể bị gián đoạn luồng dữ liệu khi bộ nhớ RAM thiết bị thấp.

### 1.2 Giải pháp Kiến trúc Kỹ thuật

```
                             [ Microphone Input ]
                                      │
                                      ▼
                        [ PcmAudioController ]
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
     [ Primary Track: MediaRecorder ]        [ Secondary Fallback Track ]
     - Codec Negotiation                     - AudioWorklet / ScriptProcessor
     - timeslice: 1000ms                     - 16kHz 16-bit Mono Float32
     - ondataavailable -> Chunks[]           - rawPcmChunksRef[] (In-Memory)
                 │                                         │
                 ▼                                         ▼
      MediaRecorder.stop()                    Nếu MediaRecorder sinh 0 bytes:
      (await 'stop' & 'error' events)                      │
                 │                                         ▼
                 ├──────────> Chunks > 0? ──(YES)──> Blob(Chunks, mimeType)
                 │                                         │
                 └──────────> Chunks == 0? ─(FALLBACK)─> pcmBase64ChunksToWavBlob()
                                                           (Synthesize Valid WAV)
```

1. **Cơ chế Dual Capture & Tự phục hồi (Dual Capture & Synthetic WAV Fallback)**:
   - Trong `useLiveAudioRecorder` (`components/speaking/live/hooks/use-live-audio-recorder.ts`), hệ thống thu song song 2 luồng:
     - Luồng 1 (Primary): Native `MediaRecorder` bắt chu kỳ `timeslice = 1000ms`.
     - Luồng 2 (Fallback): `rawPcmChunksRef` ghi nhận mẫu âm thanh PCM 16kHz liên tục từ `AudioWorklet` (hoặc `ScriptProcessorNode`).
   - Hàm `finalizeRecording()` thiết lập Promise lắng nghe đồng thời `stop` và `error` với flag `{ once: true }`.
   - Nếu `recordedChunksRef` có dữ liệu: xuất Blob theo MIME type (`audio/webm` hoặc `audio/mp4`).
   - Nếu `recordedChunksRef` rỗng (do Safari lỗi không phát chunk): fallback ngay sang `pcmBase64ChunksToWavBlob(rawPcmChunksRef.current, 16000)` để tái tạo file WAV 16-bit Mono hợp lệ chuẩn RIFF. Không bao giờ để mất bản thu của học viên.
2. **Ngưỡng an toàn thời lượng (Minimum Duration Guard)**:
   - Nếu thời gian ghi âm `< 500ms`, client cảnh báo học viên thu âm quá ngắn thay vì gửi payload rác lên server.
3. **MIME Type Negotiation Matrix**:
   - Trật tự ưu tiên: `audio/webm;codecs=opus` -> `audio/webm` -> `audio/mp4` -> `audio/aac` -> `audio/wav`.

---

## 2. Persistence & Secure Playback (Lưu trữ Bền vững & Phát lại An toàn)

### 2.1 Vấn đề Kỹ thuật

- File âm thanh `OriginalAudio` của bài Practice là tài sản riêng tư nhạy cảm của Learner ([ADR-0010](docs/adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md)).
- Không được phép mở public access bucket trên S3/SeaweedFS; không được để lộ URL tĩnh (hardcoded CDN/object URL).
- Cần cơ chế phát lại trực tiếp mà giáo viên hoặc người dùng khác không thể nghe lén hay đoán URL.

### 2.2 Giải pháp Kỹ thuật

```
[ Learner Client ]                   [ Next.js API Route ]               [ SeaweedFS / S3 ]
       │                                       │                                  │
       │── 1. GET /api/speaking/practice/ ────>│                                  │
       │      [sessionId]/playback-url         │                                  │
       │      (Bearer Session Cookie)          │                                  │
       │                                       │── 2. Authenticate Session        │
       │                                       │── 3. Check Learner Ownership     │
       │                                       │      (learnerId == session.user) │
       │                                       │                                  │
       │                                       │── 4. Generate Presigned GET ────>│
       │                                       │      (TTL = 900s / 15 mins)      │
       │                                       │<── 5. Presigned URL ─────────────│
       │<── 6. { playbackUrl } ────────────────│                                  │
       │       (200 OK)                        │                                  │
       │                                                                          │
       │── 7. Fetch Audio Stream via Presigned URL ──────────────────────────────>│
       │<── 8. 206 Partial Content (Audio Stream) ────────────────────────────────│
```

1. **Namespace Phân lập Tuyệt đối**:
   - Khóa lưu trữ (Storage Key) bắt buộc tuân theo định dạng:
     `speaking/practices/{learnerId}/{sessionId}/original_audio.{ext}`.
   - Server use case (`finishSpeakingPractice`) kiểm tra regex và tiền tố: nếu `storageKey` không bắt đầu bằng `speaking/practices/${learnerId}/`, ngay lập tức từ chối với `ForbiddenError (403)`.
2. **Chính sách Bucket Riêng tư (Private S3 Bucket)**:
   - Bucket `ielts-audio` trên SeaweedFS được cấu hình chế độ Private (`read: false`, `write: false` cho public).
   - Chỉ duy nhất Next.js server giữ `S3_ACCESS_KEY` và `S3_SECRET_KEY` nội bộ.
3. **Presigned GET URL Ngắn hạn (Ephemeral Presigned URL)**:
   - Endpoint `/api/speaking/practice/[sessionId]/playback-url` xác thực danh tính qua Better Auth.
   - Nếu `requestingUserId !== practice.learnerId`, trả về `404 Not Found` (ngăn enumeration).
   - Sinh Presigned GET URL với thời hạn sống (TTL) ngắn: **15 phút (900 giây)** thông qua AWS SDK `@aws-sdk/s3-request-presigner`.
4. **Vòng đời Tự động Dọn dẹp (Auto-purge Lifecycle)**:
   - Cấu hình Lifecycle Rule trên SeaweedFS S3 bucket: tiền tố `speaking/practices/` tự động hết hạn và xóa vĩnh viễn sau **14 ngày** theo đúng quy định [ADR-0010](docs/adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md).

---

## 3. Disconnect & Reconnect (Phục hồi Mạng & Ngắt quãng Kết nối)

### 3.1 Vấn đề Kỹ thuật

- Mạng di động (4G/5G/Wi-Fi) không ổn định có thể khiến kết nối WebSocket với Gemini Live bị đứt giữa chừng.
- Nếu phiên đứt gãy, học viên không thể hoàn tất phần thi hoặc bị mất trắng dữ liệu đã thu âm.

### 3.2 Giải pháp Kỹ thuật

1. **Nguyên tắc Độc lập: Lưu trữ Dữ liệu Trước, Đánh giá Sau**:
   - Theo [#61](https://github.com/manh-nd/ielts-learning-platform/issues/61) và [#55](https://github.com/manh-nd/ielts-learning-platform/issues/55): `PracticeEnded != PracticeEvaluated`.
   - Client thu âm cục bộ vào bộ nhớ trình duyệt; khi kết thúc hoặc khi gặp sự cố, dữ liệu âm thanh của câu trả lời đã thu thành công được lưu trữ ngay vào database/S3 với trạng thái `completed`.
2. **Chiến lược Thử lại Kết nối WebSocket (Exponential Backoff with Jitter)**:
   - Khi WebSocket bị đóng bất thường (`event.code !== 1000`):
     - Lần 1: thử lại sau 1000ms ± 200ms jitter.
     - Lần 2: thử lại sau 2000ms ± 400ms jitter.
     - Lần 3: thử lại sau 4000ms ± 800ms jitter.
     - Tối đa 3 lần thử lại. Nếu không thành công, chuyển sang trạng thái Graceful Interruption.
3. **Graceful Interruption & Partial Practice History**:
   - Khi kết nối không thể phục hồi, phiên được chốt lại với phạm vi đã hoàn thành (`CompletedPracticeScope`).
   - Theo [#61](https://github.com/manh-nd/ielts-learning-platform/issues/61): _"Completed and partial Practices with at least one learner response appear in history."_ Học viên vẫn có thể nghe lại âm thanh phần đã thu và bấm **"Thử lại đánh giá" (Retry Evaluation)** mà không cần làm lại từ đầu.
4. **Cơ chế Idempotent Retry Evaluation**:
   - Đã triển khai và có test suite trong `modules/speaking/application/retry-practice-evaluation.ts`.
   - Nếu AI evaluation ban đầu bị lỗi (503 / timeout / network drop), bản ghi phiên vẫn giữ nguyên trạng thái `completed`. Học viên nhấn "Thử lại đánh giá", server tái sử dụng nguyên vẹn `OriginalAudio` từ S3 và kích hoạt lại AI Pipeline.

---

## 4. Microphone & Browser Quirks (Xử lý Ngoại lệ Trình duyệt & Phần cứng)

### 4.1 Vấn đề Kỹ thuật

1. **Từ chối Quyền Microphone (`NotAllowedError`)**: Trình duyệt chặn quyền truy cập mic.
2. **Ngắt kết nối Thiết bị Ngoại vi giữa chừng**: Rút tai nghe Bluetooth, mất kết nối mic USB khi đang nói.
3. **Chuyển Tab / Ẩn Ứng dụng (`document.visibilityState === 'hidden'`)**: Safari và Chrome tự động suspend `AudioContext` khi chuyển tab sang ứng dụng khác để tiết kiệm pin.

### 4.2 Giải pháp Kỹ thuật

1. **Taxonomy Lỗi Microphone Thân thiện**:
   ```typescript
   export type MicErrorCode =
     | "PERMISSION_DENIED" // NotAllowedError
     | "DEVICE_NOT_FOUND" // NotFoundError
     | "DEVICE_IN_USE" // NotReadableError (ứng dụng khác đang chiếm mic)
     | "BROWSER_UNSUPPORTED"; // navigator.mediaDevices không khả dụng
   ```
   - Khi phát hiện `NotAllowedError`, UI hiển thị thông báo hướng dẫn cụ thể cách mở lại quyền trên thanh địa chỉ của Chrome/Safari, không để màn hình treo vô tận.
2. **Lắng nghe Sự kiện Phần cứng (Track Events)**:
   - Lắng nghe `MediaStreamTrack.onended` và `MediaStreamTrack.onmute`:
     ```typescript
     const audioTrack = stream.getAudioTracks()[0];
     audioTrack.onended = () => {
       // Thiết bị bị rút hoặc hệ điều hành thu hồi quyền
       notifyHardwareDisconnected(
         "Mất kết nối microphone. Vui lòng kiểm tra lại thiết bị."
       );
       pauseSessionAndPreserveAudio();
     };
     ```
3. **Quản lý Vòng đời AudioContext khi Ẩn Tab (Tab Visibility Handling)**:
   - Lắng nghe sự kiện `visibilitychange`:
     ```typescript
     document.addEventListener("visibilitychange", () => {
       if (document.visibilityState === "visible") {
         if (audioContext && audioContext.state === "suspended") {
           audioContext.resume();
         }
       }
     });
     ```
   - Kết hợp lắng nghe `audioContext.onstatechange` để chủ động gọi `.resume()` khi có tương tác người dùng.

---

## 5. Quota & Rate Limits (Quản lý Định mức API & An toàn Vận hành Gemini)

### 5.1 Vấn đề Kỹ thuật

- Dưới thỏa thuận thử nghiệm pilot ([ADR-0010](docs/adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md)), nền tảng sử dụng **Google Gemini Free Tier**.
- Định mức thực tế:
  - `gemini-3.5-flash-lite`: **15 RPM**, 250K TPM, **500 RPD**.
  - `gemini-3.7-flash`: **5 RPM**, 250K TPM, **20 RPD**.
  - `gemma-4-31b`: **30 RPM**, 16K TPM, **14,400 RPD**.
- Nguy cơ: Nếu 10–20 học viên cùng nộp bài một lúc, tốc độ gọi API có thể vượt 15 RPM, dẫn đến mã lỗi `429 Resource Exhausted`.

### 5.2 Giải pháp Kỹ thuật

```
                               [ Yêu cầu Đánh giá Practice ]
                                             │
                                             ▼
                                [ Rate Limiter Per-Learner ]
                                - Tối đa 5 lượt / giờ / learner
                                - Tối đa 1 evaluation đồng thời (Lock)
                                             │
                                             ▼
                                [ Model Cascading Pipeline ]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             Tier 1: gemini-3.5-flash-lite               Tier 2: gemini-3.1-flash-lite
             (15 RPM / 500 RPD)                          (15 RPM / 500 RPD Backup)
                       │                                           │
                       ├─────(Lỗi 429 / 503 / Timeout)─────────────┤
                       │                                           ▼
                       ▼                                 Tier 3: gemma-4-31b
             Exponential Backoff + Jitter                (30 RPM / 14,400 RPD Fallback)
             (1.5s -> 3.0s -> 6.0s)
```

1. **Kiến trúc Phân tầng Mô hình (Model Cascading)**:
   - Primary: `gemini-3.5-flash-lite` (nhanh < 3s, context 1M, format JSON chuẩn).
   - Khi gặp `429` hoặc `503`, tự động cascade sang `gemini-3.1-flash-lite`, sau đó tới `gemini-3.5-flash` và `gemma-4-31b` trước khi báo lỗi. Đã được cài đặt và kiểm thử trong `lib/gemini/speaking-evaluator.ts`.
2. **Rate Limiting Tầng Người dùng & Concurrency Lock**:
   - Giới hạn: Mỗi Learner chỉ được kích hoạt tối đa **5 phiên đánh giá / giờ**.
   - Concurrency Lock: Tại một thời điểm, mỗi Learner chỉ được có tối đa **1 phiên đang chấm (`status === 'evaluating'`)**. Nếu có yêu cầu mới khi đang chấm, trả về thông báo đợi phiên hiện tại hoàn thành.
3. **Thử lại với Backoff Thông minh (Smart Backoff)**:
   - Delay cơ sở 1500ms, hệ số nhân 2.0, thêm random jitter ±20%, tối đa 3 lần thử lại cho mỗi tầng model.
4. **Bắt buộc Đồng thuận Điều khoản Free Tier (FreeTierConsentNotice)**:
   - Theo [ADR-0010](docs/adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md), trước khi cấp quyền mic hoặc bắt đầu buổi luyện, hệ thống hiển thị modal giải thích dữ liệu âm thanh/văn bản được xử lý qua dịch vụ thử nghiệm của Google.

---

## 6. Security & Ownership Enforcement (An toàn Dữ liệu & Ranh giới Sở hữu)

### 6.1 Vấn đề Kỹ thuật

- Tuyệt đối cấm Giáo viên hoặc Learner khác nghe lén, xem lén dữ liệu bài luyện tập cá nhân ([ADR-0010](docs/adr/0010-pilot-data-governance-ownership-retention-and-deletion-policy.md)).
- Tránh các lỗ hổng IDOR (Insecure Direct Object References) khi query hoặc lấy link audio.

### 6.2 Giải pháp Kỹ thuật

1. **Kiểm tra Quyền Sở hữu Đa lớp (Multi-layer Ownership Check)**:
   - **Tầng Use Case (`get-speaking-practice.ts`)**:
     ```typescript
     if (practice.learnerId !== requestingUserId) {
       // Trả về 404 thay vì 403 để triệt tiêu việc rà quét ID (enumeration attacks)
       throw new NotFoundError("Speaking practice session not found");
     }
     ```
   - **Tầng Use Case (`finish-speaking-practice.ts`)**:
     ```typescript
     if (existingSession && existingSession.learnerId !== requestingUserId) {
       throw new ForbiddenError(
         "Cannot finish a speaking practice belonging to another user"
       );
     }
     ```
   - **Tầng Route Handler**: Đảm bảo phiên đăng nhập Better Auth (`auth.api.getSession`) được truyền vào use case, không lấy `userId` từ body/query do client gửi lên.
2. **Zero Teacher Access Invariant**:
   - Các API liên quan đến `SpeakingPractice` nằm hoàn toàn trong route group `app/(protected)/learner/` và prefix `/api/speaking/practice/`.
   - Hoàn toàn không có liên kết nào giữa `Classroom` và `SpeakingPractice`. Kể cả khi Teacher phụ trách lớp có học viên đó, Teacher không có bất kỳ view hay endpoint nào để liệt kê bài practice cá nhân của học sinh.

---

## 7. Bằng chứng Thực nghiệm Nghiệm thu (Acceptance Evidence: Error Rate < 2%)

Để chứng minh hạ tầng kỹ thuật đạt tỷ lệ lỗi **< 2%** trong đợt thử nghiệm pilot, hệ thống đo lường và kiểm chứng qua các tiêu chí sau:

### 7.1 Công thức Đo lường Ngân sách Lỗi (Technical Error Budget)

$$\text{Technical Error Rate} = \frac{E_{\text{audio\_record}} + E_{\text{audio\_upload}} + E_{\text{socket\_fatal}}}{N_{\text{sessions\_started}}} \times 100\%$$

Trong đó:

- $E_{\text{audio\_record}}$: Số lượt không thu được âm thanh (Blob rỗng không cứu được bằng Synthetic WAV).
- $E_{\text{audio\_upload}}$: Số lượt tải file âm thanh lên S3/SeaweedFS thất bại sau khi đã thử lại 3 lần.
- $E_{\text{socket\_fatal}}$: Số lượt mất kết nối WebSocket không thể phục hồi và không lưu được partial session.
- Mục tiêu nghiệm thu: **$\text{Technical Error Rate} < 2.0\%$**.

_(Lưu ý: Sự cố do học viên từ chối cấp quyền mic hoặc cố tình đóng tab không tính vào Technical Error Rate)._

### 7.2 Danh mục Kiểm thử Tự động (Automated Verification Matrix)

1. **Unit / Integration Tests**:
   - `modules/speaking/application/finish-speaking-practice.test.ts`: 100% pass (xác nhận RBAC, namespace validation, lưu trạng thái hoàn thành trước khi AI đánh giá, retry evaluation).
   - `modules/speaking/application/get-speaking-practice.test.ts`: 100% pass (xác nhận bảo mật IDOR 404).
   - `lib/gemini/speaking-evaluator.test.ts`: 100% pass (xác nhận model cascading và retry backoff).
2. **Cross-Browser Smoke Test Matrix (Thực tế)**:
   - **iOS Safari (iOS 16+)**: Kiểm tra ghi âm bằng `useLiveAudioRecorder`, xác nhận thu đủ âm thanh cả khi `MediaRecorder` trả về `audio/mp4` hoặc khi dùng synthetic WAV fallback.
   - **Android Chrome**: Kiểm tra ghi âm `audio/webm;codecs=opus`, ngắt kết nối mạng mô phỏng 4G rớt sóng.
   - **macOS / Windows Chrome & Safari**: Kiểm tra thu âm, phát lại qua Presigned URL 15 phút, và luồng thử lại chấm điểm.

---

## Kết luận & Hướng Triển khai Tiếp theo

Nghiên cứu đã xác lập trọn vẹn giải pháp cho 6 khoảng trống kỹ thuật P0:

- **Audio Recording**: Đã có cơ chế Dual Capture + Synthetic WAV Fallback trong `useLiveAudioRecorder`.
- **Persistence & Security**: Đã có S3 presigned URL ngắn hạn (15m), lifecycle 14 ngày auto-purge, và RBAC phân lập hoàn toàn với giáo viên.
- **Resilience**: Độc lập giữa ghi nhận phiên và đánh giá AI (`PracticeEnded != PracticeEvaluated`), hỗ trợ `RetryEvaluation`.
- **Quota & Scale**: Cascade mô hình thông minh (`gemini-3.5-flash-lite` -> `gemini-3.1-flash-lite` -> `gemma-4-31b`) kèm per-learner rate limit.

Đặc tả này cung cấp đầy đủ cơ sở kỹ thuật để đóng ticket [#50](https://github.com/manh-nd/ielts-learning-platform/issues/50) và mở đường cho việc hoàn tất nghiệm thu pilot tại [#52](https://github.com/manh-nd/ielts-learning-platform/issues/52).
