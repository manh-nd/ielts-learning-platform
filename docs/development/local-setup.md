# Hướng dẫn Thiết lập Môi trường Phát triển Local (Development Guide)

Tài liệu này hướng dẫn chi tiết quy trình cài đặt, cấu hình biến môi trường, quản trị cơ sở dữ liệu (Drizzle ORM Migration), nạp dữ liệu mẫu (Seed Data) và chạy ứng dụng ở môi trường Local.

---

## 1. Yêu cầu Cài đặt Tiên quyết (Prerequisites)

| Công cụ                     | Phiên bản tối thiểu | Mục đích                                               |
| :-------------------------- | :------------------ | :----------------------------------------------------- |
| **[Bun](https://bun.sh/)**  | `>= 1.1.0`          | Package manager & JS/TS runtime chính                  |
| **Docker & Docker Compose** | Latest              | Khởi chạy PostgreSQL 18, pgAdmin 4, SeaweedFS S3 local |
| **Git**                     | Latest              | Quản lý mã nguồn                                       |

---

## 2. Quy trình Cài đặt & Khởi chạy 6 Bước Chuẩn

### Bước 1: Cài đặt Dependencies

```bash
bun install
```

### Bước 2: Chuẩn bị Biến môi trường

Sao chép cấu hình mẫu từ `.env.example` sang `.env.local`:

```bash
cp .env.example .env.local
```

File `.env.local` chứa các biến môi trường quan trọng:

```ini
# Better Auth Configuration
BETTER_AUTH_SECRET=dev_better_auth_secret_key_minimum_32_characters_long_12345
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# PostgreSQL Database (Drizzle ORM)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ielts_platform
DB_MAX_CONNECTIONS=10

# Teacher Emails (Danh sách bootstrap tài khoản có quyền Teacher)
TEACHER_EMAILS=teacher@ielts.liuhocngoaingu.com,learnerteacher@ielts.liuhocngoaingu.com,teacher@ielts-prep.vn

# Google OAuth Credentials (Xem hướng dẫn tại docs/development/google-oauth-setup.md)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Object Storage (SeaweedFS S3 Local)
S3_ENDPOINT=http://localhost:8333
S3_PUBLIC_ENDPOINT=http://localhost:8333
S3_ACCESS_KEY_ID=any_access_key
S3_SECRET_ACCESS_KEY=any_secret_key
S3_BUCKET_NAME=ielts-audio-submissions
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

### Bước 3: Khởi động Docker Dev Services

Khởi động cụm dịch vụ development (được cô lập hoàn toàn với file production `docker-compose.yml`):

```bash
docker compose -f docker-compose.dev.yml up -d
```

- **PostgreSQL 18**: `localhost:5432` (`db: ielts_platform`, `user: postgres`, `password: postgres`)
- **pgAdmin 4**: [http://localhost:8080](http://localhost:8080) (`admin@admin.com` / `admin`)
- **SeaweedFS S3**: `http://localhost:8333` (API) & [http://localhost:8888](http://localhost:8888) (Filer UI)

### Bước 4: Chạy Migration Drizzle ORM

Tạo cấu trúc bảng trong PostgreSQL:

```bash
bun run db:migrate
```

_Nếu bạn chỉ muốn đồng bộ schema nhanh mà không tạo file migration SQL:_

```bash
bun run db:push
```

### Bước 5: Seed Dữ liệu Tài khoản Mẫu

Chạy script seed để tạo sẵn các tài khoản Giáo viên và Học viên:

```bash
bun run db:seed
```

#### Bảng Tài khoản Mẫu (Mật khẩu: `Password123!`):

| Email                                     | Vai trò (`role`)         | Trang đích           |
| :---------------------------------------- | :----------------------- | :------------------- |
| `teacher@ielts.liuhocngoaingu.com`        | Giáo viên (`teacher`) 🎓 | `/teacher/review`    |
| `learnerteacher@ielts.liuhocngoaingu.com` | Giáo viên (`teacher`) 🎓 | `/teacher/review`    |
| `teacher@ielts-prep.vn`                   | Giáo viên (`teacher`) 🎓 | `/teacher/review`    |
| `learner@ielts-prep.vn`                   | Học viên (`learner`) 📚  | `/learner/dashboard` |
| `learner@ielts.liuhocngoaingu.com`        | Học viên (`learner`) 📚  | `/learner/dashboard` |

### Bước 6: Khởi chạy Ứng dụng Next.js

```bash
bun run dev
```

Truy cập ứng dụng tại: **[http://localhost:3000](http://localhost:3000)**.

---

## 3. Quản trị Drizzle ORM Schema & Migrations

### Tạo Migration mới khi cập nhật Schema

1. Thay đổi định nghĩa bảng trong `lib/db/schema.ts` hoặc các module tương ứng.
2. Sinh file migration SQL mới:
   ```bash
   bun run db:generate
   ```
3. Áp dụng file migration vào cơ sở dữ liệu:
   ```bash
   bun run db:migrate
   ```

### Reset Database Sạch (Clean DB Reset)

```bash
# 1. Xóa toàn bộ container và volume data dev
docker compose -f docker-compose.dev.yml down -v

# 2. Khởi động lại container PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# 3. Chạy migration và seed lại dữ liệu
bun run db:migrate
bun run db:seed
```

---

## 4. Chạy Kiểm thử Tự động (Testing)

```bash
# Unit & Integration Tests (Bun Test Runner)
bun run test

# End-to-End Tests (Playwright - Cổng 3001)
bun run test:e2e

# Playwright Interactive UI Mode
bun run test:e2e:ui

# Storybook Workshop
bun run storybook
```
