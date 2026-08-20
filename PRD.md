# **TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD)**

## **Website chấm chữa IELTS Speaking & Writing bằng AI**

**Ngày tạo:** 20/08/2026

**Trạng thái:** Bản nháp v1

## **1\. TỔNG QUAN SẢN PHẨM**

Website hỗ trợ học viên luyện thi **IELTS Speaking và Writing**, chấm điểm tự động bằng AI theo đúng tiêu chí chấm thi IELTS chính thức, có giáo viên kiểm duyệt lại kết quả. Về lâu dài, hệ thống sẽ **học từ các chỉnh sửa của giáo viên** để tự cải thiện độ chính xác của AI theo thời gian.

**Đối tượng dùng ban đầu:** Học viên tự học cá nhân, luyện thi IELTS Speaking & Writing.

**Quy mô ban đầu:** Vài chục học viên, 1 giáo viên duyệt bài toàn bộ hệ thống.

**Mô hình kinh doanh:** Miễn phí hoàn toàn ở giai đoạn đầu (không cần tích hợp thanh toán trong MVP).

**Deadline mong muốn:** Dưới 1 tháng cho bản MVP đầu tiên (rất gấp, Dev có thể propose thời gian hợp lí)

Overall thì cái em cần gấp hiện tại là web có phần AI chấm chữa bài tập speaking, giáo viên duyệt và trả điểm, nhận xét chi tiết. Em muốn triển khai luôn sau đó thì có thể tích hợp thêm các tính năng khác sau ạ. Em muốn triển khai luôn sau đó thì có thể tích hợp thêm các bước sau

**2\. VAI TRÒ NGƯỜI DÙNG**

| Vai trò       | Mô tả                                                                                                    | Trong MVP?                                   |
| :------------ | :------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| Học viên      | Đăng ký tài khoản, tham gia lớp, làm bài thi thử/homework, xem kết quả chấm                              | Có                                           |
| Giáo viên     | Tạo lớp học, thêm học viên vào lớp, soạn đề bài, duyệt/sửa kết quả AI chấm, theo dõi tiến trình học viên | Có (1 người dùng)                            |
| Quản trị viên | Quản lý hệ thống, xem thống kê                                                                           | Có thể gộp chung với vai trò Giáo viên ở MVP |

**Đăng nhập/Đăng ký:** Email \+ mật khẩu đơn giản (chưa cần Google OAuth, chưa cần xác thực email phức tạp ở giai đoạn MVP — có thể thêm sau).

## **3\. HAI LUỒNG NGHIỆP VỤ CHÍNH**

### **3.1. Luồng "Thi thử" (Mock Test)**

- Học viên bấm "Làm bài thi thử" → hệ thống **tự động random 1 đề** từ kho đề thi thử hiện có \- cập nhật theo quý (không cho học viên tự chọn đề, để mô phỏng đúng cảm giác thi thật).
- Học viên làm bài Speaking (ghi âm) hoặc Writing trong điều kiện giống thi thật (có giới hạn thời gian).
- AI chấm và **trả kết quả ngay lập tức**, không qua giáo viên duyệt.
- Mục đích: học viên luyện tập nhanh, có phản hồi tức thì, không đoán trước được đề để luyện phản xạ thật.

  ### **3.2. Luồng "Homework" (Bài tập về nhà)**

- Giáo viên soạn và đăng đề bài.
- Học viên làm bài, nộp lên hệ thống.
- AI chấm trước → **giáo viên xem lại, chỉnh sửa điểm/nhận xét nếu cần** → học viên nhận kết quả cuối cùng (đã qua duyệt).
- Mỗi lần giáo viên chỉnh sửa, dữ liệu này được lưu lại làm "dữ liệu huấn luyện" để cải thiện AI về sau (xem mục 5.4).

  ## **4\. YÊU CẦU TÍNH NĂNG CHI TIẾT**

  ### **4.1. Module Speaking**

- Học viên ghi âm trực tiếp trên trình duyệt (không cần upload file — cần xin quyền micro).
- Hệ thống chuyển giọng nói thành văn bản (Speech-to-Text) để phục vụ chấm nội dung, đồng thời giữ lại file âm thanh để chấm phát âm/ngữ điệu.
- Chấm theo 4 tiêu chí chính thức IELTS Speaking:
  1. Fluency and Coherence (Độ trôi chảy và mạch lạc)
  2. Lexical Resource (Vốn từ vựng)
  3. Grammatical Range and Accuracy (Ngữ pháp)
  4. Pronunciation (Phát âm)
- Kết quả trả về: điểm từng tiêu chí (thang 1.0–9.0, bước 0.5) \+ điểm tổng (band trung bình) \+ nhận xét, lí do sai và gợi ý sửa lỗi (phát âm, ngữ pháp, từ vựng), bổ sung những cách dùng từ/diễn đạt tự nhiên để nâng band (từ vựng/ngữ pháp)
- Với đề thi thử hay với làm bài tập về nhà, web mô phỏng 1 giám khảo đang hỏi học viên, với thời lượng của 1 kì thi Ielts Speaking chuẩn. Bài tập về nhà sẽ có các phần speaking khá biệt lập với nhau, không thông suốt như phần thi thử với 3 parts.

**4.2. Module Writing**

- Học viên nhập bài viết trực tiếp trên web (text editor đơn giản, có đếm số từ).
- Chấm theo 4 tiêu chí chính thức IELTS Writing (Task 1 và Task 2 có tiêu chí hơi khác nhau, cần làm rõ đề bài thuộc Task nào):
  1. Task Achievement/Response
  2. Coherence and Cohesion
  3. Lexical Resource
  4. Grammatical Range and Accuracy
- Kết quả trả về: điểm từng tiêu chí \+ điểm tổng \+ nhận xét, lí do sai và gợi ý sửa lỗi \+ bổ sung những cách dùng từ/diễn đạt để nâng band (từ vựng/ngữ pháp)

  ### **4.3. Module Quản lý đề bài (dành cho giáo viên)**

- Giáo viên tạo đề bài mới: chọn loại (Speaking Part 1/2/3, Writing Task 1/2), nhập nội dung đề, gắn nhãn chủ đề/độ khó (tùy chọn).
- Giáo viên chỉ định đề bài đó là "Thi thử" hay "Homework".
- **Kho đề thi thử (Mock Test Bank) — MỚI:**
  - Giáo viên upload/nhập nhiều đề cùng lúc vào kho đề thi thử (cần hỗ trợ nhập hàng loạt — ví dụ qua file Excel/CSV hoặc form nhập nhanh nhiều đề liên tiếp, để giáo viên không phải nhập từng đề một khi cập nhật theo quý).
  - Hệ thống lưu trạng thái đề: đang active (dùng để random) hay đã ngừng dùng (ví dụ đề cũ của quý trước, giáo viên có thể ẩn đi mà không cần xóa hẳn — để vẫn giữ lịch sử học viên nào đã làm đề nào).
  - Khi học viên làm thi thử, hệ thống **random 1 đề trong số các đề đang active**, có tùy chọn tránh lặp lại đề học viên đã làm gần đây (hỏi thêm dev về độ ưu tiên tính năng này, có thể để phase 2 nếu phức tạp).
  - Giáo viên xem được danh sách đề trong kho, dễ dàng thêm đề mới/ẩn đề cũ mỗi quý.
- Danh sách đề bài để học viên chọn làm (áp dụng cho Homework — học viên hoặc giáo viên chỉ định đề cụ thể, khác với Thi thử là random).

  ### **4.4. Module Duyệt bài (dành cho giáo viên)**

- Danh sách các bài homework đang chờ duyệt (đã có điểm AI chấm sẵn).
- Giao diện cho giáo viên xem bài làm gốc (audio/văn bản) \+ kết quả AI \+ chỉnh sửa điểm/nhận xét.
- Sau khi giáo viên bấm "Duyệt", học viên mới thấy được kết quả. Có thể có nhiều giáo viên, vì sau có thể em sẽ tuyển trợ giảng.

**4.5. Module Lịch sử & tiến độ học viên (góc nhìn học viên)**

- Học viên xem lại lịch sử các bài đã làm, điểm số theo thời gian (để thấy tiến bộ của chính mình).

  ### **4.6. Module Quản lý lớp học (dành cho giáo viên) — MỚI**

- Giáo viên tạo lớp học (ví dụ: "IELTS Speaking 7.0 \- Khóa T8"), đặt tên, mô tả.
- Thêm học viên vào lớp (theo email đã đăng ký, hoặc gửi lời mời/mã/link tham gia lớp).
- Một học viên có thể thuộc nhiều lớp (tùy chọn thiết kế, cần thống nhất với dev).
- Giao đề bài/homework có thể gán riêng cho một lớp cụ thể, thay vì công khai cho tất cả học viên.
- Danh sách học viên trong từng lớp, xem nhanh trạng thái (đã nộp bao nhiêu bài, còn bao nhiêu bài chưa nộp...).

  ### **4.7. Module Theo dõi tiến trình học viên (dành cho giáo viên) — MỚI**

- Với mỗi học viên, giáo viên xem được:
  - Lịch sử toàn bộ bài đã làm (thi thử \+ homework), điểm từng tiêu chí theo thời gian.
  - Biểu đồ xu hướng điểm số (band trung bình tăng/giảm qua từng bài, theo từng tiêu chí Speaking/Writing).
  - Số lượng bài đã hoàn thành, tỷ lệ nộp bài đúng hạn (nếu có deadline cho homework).
- Xem tổng quan theo lớp: điểm trung bình cả lớp, học viên nào đang tiến bộ chậm cần chú ý.
- (Biểu đồ trực quan có thể làm đơn giản ở MVP — bảng số liệu trước, biểu đồ đẹp để sau.)

  ## **5\. YÊU CẦU KỸ THUẬT & KIẾN TRÚC AI**

  ### **5.1. Lựa chọn công nghệ chấm AI**

- **Dùng API có sẵn** (ví dụ Claude, GPT-4, kết hợp Google Speech-to-Text/Whisper cho phần audio) — nhanh, chi phí theo lượt gọi, độ chính xác phụ thuộc vào prompt engineering.
- **Fine-tune/huấn luyện riêng** — chính xác hơn theo thời gian nhưng tốn thời gian, không khả thi cho deadline dưới 1 tháng.

**Khuyến nghị cho MVP:** Dùng API có sẵn (LLM \+ Speech-to-Text) với prompt được thiết kế kỹ theo band descriptor chính thức của IELTS, KHÔNG fine-tune riêng ở giai đoạn này.

### **5.2. Speech-to-Text cho phần Speaking**

Cần chọn dịch vụ chuyển giọng nói thành văn bản (ảnh hưởng đến độ chính xác chấm phát âm và nội dung). Đây là điểm kỹ thuật cần đội dev khảo sát kỹ vì chấm phát âm khó hơn nhiều so với chấm nội dung văn bản thuần túy.

### **5.3. Lưu trữ dữ liệu**

- File âm thanh: cần dịch vụ lưu trữ (cloud storage), tính toán dung lượng dự kiến theo số lượng học viên và số bài ghi âm.
- Văn bản bài viết, điểm số, nhận xét: lưu trong database.

  ### **5.4. Cơ chế "AI học từ giáo viên" — CẦN LÀM RÕ THÊM**

Đây là phần có độ phức tạp kỹ thuật cao nhất trong toàn bộ dự án, và **khó khả thi trọn vẹn trong MVP dưới 1 tháng**. Đề xuất chia làm 2 giai đoạn:

- **Giai đoạn 1 (MVP):** Chỉ cần lưu lại đầy đủ dữ liệu mỗi lần giáo viên sửa (điểm AI chấm ban đầu vs. điểm giáo viên sửa lại, kèm bài làm gốc). Đây là bước "thu thập dữ liệu", **chưa cần** AI tự động học ngay.
- **Giai đoạn 2 (sau MVP):** Dùng dữ liệu đã thu thập để tinh chỉnh prompt, hoặc fine-tune mô hình, hoặc xây dựng cơ chế feedback loop tự động. Việc này cần thời gian và khối lượng dữ liệu đủ lớn để có ý nghĩa (vài chục bài chưa đủ để huấn luyện hiệu quả).

**Khuyến nghị:** Nói rõ với đội dev rằng MVP chỉ cần xây "hạ tầng thu thập dữ liệu sạch" (lưu đúng, đủ, có cấu trúc), việc AI tự học sẽ làm ở phase 2\.

## **6\. ĐỀ XUẤT PHẠM VI MVP (DEADLINE DƯỚI 1 THÁNG)**

Vì thời gian rất gấp, khuyến nghị **thu hẹp phạm vi** để kịp deadline, ưu tiên theo thứ tự:

**Bắt buộc có trong MVP:**

1. Đăng ký/đăng nhập bằng email-password
2. Giáo viên tạo lớp học, thêm học viên vào lớp (bản đơn giản: thêm bằng email)
3. Giáo viên đăng đề bài (Speaking \+ Writing), nhập được nhiều đề vào kho đề thi thử, có thể gán homework cho lớp cụ thể
4. Học viên bấm làm thi thử → hệ thống random đề từ kho, làm bài Writing (nhập text) \+ AI chấm ngay
5. Học viên bấm làm thi thử → hệ thống random đề từ kho, làm bài Speaking (ghi âm) \+ AI chấm ngay
6. Luồng Homework: AI chấm trước → giáo viên duyệt → học viên xem kết quả
7. Giáo viên xem được lịch sử bài làm \+ điểm số theo thời gian của từng học viên (dạng bảng, chưa cần biểu đồ đẹp)
8. Lưu trữ dữ liệu chỉnh sửa của giáo viên (phục vụ cải thiện AI ở phase 2\)

**Có thể lùi sang Phase 2 (sau MVP) nếu cần cắt giảm thêm để kịp tiến độ:**

- Cơ chế tránh random trùng đề học viên đã làm gần đây (MVP có thể random hoàn toàn ngẫu nhiên, chấp nhận trùng)
- Nhập đề hàng loạt qua Excel/CSV (MVP có thể để giáo viên nhập từng đề qua form, đủ dùng với quy mô nhỏ)
- Biểu đồ trực quan hóa xu hướng điểm số (thay vì chỉ bảng số liệu)
- Tổng quan thống kê theo cả lớp (điểm trung bình lớp, cảnh báo học viên tiến bộ chậm)
- Mời học viên vào lớp qua mã tham gia (thay vì giáo viên thêm thủ công bằng email)
- Cơ chế AI tự động học/cải thiện từ dữ liệu giáo viên sửa
- Đăng nhập Google, quên mật khẩu qua email
- Thanh toán (vì miễn phí giai đoạn đầu nên không cần)
- Phân loại đề bài theo chủ đề/độ khó nâng cao

⚠️ **Lưu ý quan trọng:** Trong 2 module Speaking và Writing, module **Speaking phức tạp và tốn thời gian hơn nhiều** (do cần xử lý ghi âm, chuyển giọng nói thành văn bản, chấm phát âm). Nếu deadline quá gấp, có thể cân nhắc ra mắt **Writing trước**, Speaking ra sau vài tuần — nên trao đổi thẳng với đội dev về việc này ngay từ đầu.

## **7\. CÂU HỎI CÒN MỞ — CẦN THẢO LUẬN THÊM VỚI ĐỘI DEV**

- Chọn dịch vụ Speech-to-Text nào (ảnh hưởng chi phí và độ chính xác)?
- Chọn LLM nào để chấm (Claude, GPT-4, hay khác) và ai chịu chi phí API theo lượt dùng?
- Hạ tầng lưu trữ file âm thanh dự kiến dùng dịch vụ nào (AWS S3, Google Cloud Storage...)?
- Có cần giới hạn số lượt làm bài/ngày cho mỗi học viên để kiểm soát chi phí API không (vì đang miễn phí)?
- Giao diện ghi âm cần hỗ trợ trên thiết bị nào (máy tính, điện thoại, cả hai)?
