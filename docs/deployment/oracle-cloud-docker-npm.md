# Hướng dẫn Triển khai Oracle Cloud VM (ARM64) với Docker Compose & Nginx Proxy Manager

Tài liệu này hướng dẫn chi tiết quy trình thiết lập, cấu hình và vận hành Nền tảng IELTS Learning Platform trên máy chủ đám mây **Oracle Cloud Infrastructure (OCI) Ampere A1 (ARM64 - 4 OCPU, 24GB RAM)**, kết nối qua mạng Docker `npm_network` do **Nginx Proxy Manager (NPM)** điều phối reverse proxy, SSL Let's Encrypt và WebSocket.

---

## 1. Tổng quan Kiến trúc Hạ tầng

```mermaid
graph TD
    subgraph Internet_Layer["Người dùng / Internet"]
        Client(("Users / Client")) -->|"HTTPS (Port 443)"| NPM["Nginx Proxy Manager (NPM)<br/>• Let's Encrypt SSL (Auto-renew)<br/>• Reverse Proxy & Load Balancer<br/>• WebSocket Upgrade Support"]
    end

    subgraph OCI_Host["Oracle Cloud VM (ARM64 Ampere A1: 4 OCPU, 24GB RAM)"]
        subgraph NPM_Network["npm_network (External Bridge)"]
            NPM -->|"Proxy Pass (Port 3000)"| App["ielts-app (Next.js on Bun Standalone)<br/>• Port 3000 (Non-root user nextjs)<br/>• Healthcheck: /api/health<br/>• Resource Limit: 3.5 OCPU / 16GB RAM"]
            NPM -->|"Proxy Pass (Port 8333)<br/>s3.yourdomain.com"| SeaweedFS["ielts-seaweedfs (SeaweedFS S3 Storage)<br/>• Port 8333 (S3 API Presigned URLs)<br/>• Port 8888 (Filer UI)<br/>• Resource Limit: 1.0 OCPU / 1GB RAM"]
        end

        subgraph Internal_Network["internal_network (Internal Bridge)"]
            App -->|"DATABASE_URL (Port 5432)"| DB[("ielts-postgres (PostgreSQL 18)<br/>• Port 5432 (Internal only)<br/>• Healthcheck: pg_isready<br/>• Resource Limit: 2.0 OCPU / 4GB RAM")]
            App -->|"S3 API (Port 8333)"| SeaweedFS
        end

        PGVol[("Persistent Volume:<br/>postgres_data")]
        SeaweedVol[("Persistent Volume:<br/>seaweedfs_data")]
        DB --- PGVol
        SeaweedFS --- SeaweedVol
    end
```

---

## 2. Chuẩn bị Môi trường Máy chủ (Oracle Cloud VM)

### 2.1. Cấu hình Mạng & Firewall (VCN Security Lists & iptables)

Trên Oracle Cloud Console, mở Ingress Rules cho VCN / Subnet:

- **Port 80** (HTTP - Let's Encrypt ACME Challenge)
- **Port 443** (HTTPS - Traffic chính)
- **Port 81** (NPM Admin Web UI - khuyến nghị giới hạn IP quản trị viên)

Trên máy chủ Ubuntu/Debian (ARM64), mở firewall nội bộ:

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cấu hình iptables mở các port cần thiết nếu có firewall mặc định của Oracle Linux/Ubuntu
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 81 -j ACCEPT
sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

### 2.2. Cài đặt Docker & Docker Compose Plugin (Hỗ trợ ARM64)

```bash
# Cài đặt Docker Engine chính thức
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Phân quyền cho user hiện tại
sudo usermod -aG docker $USER
newgrp docker

# Kiểm tra kiến trúc và phiên bản
docker version
docker compose version
uname -m # Output: aarch64
```

---

## 3. Thiết lập Mạng Chung `npm_network` & Nginx Proxy Manager

### 3.1. Tạo External Docker Network

Tạo một mạng bridge độc lập để Nginx Proxy Manager kết nối tới tất cả các container dịch vụ:

```bash
docker network create npm_network
```

### 3.2. Cài đặt Nginx Proxy Manager (nếu chưa có)

Tạo thư mục `~/nginx-proxy-manager` với file `docker-compose.yml`:

```yaml
services:
  npm:
    image: "jc21/nginx-proxy-manager:latest"
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - npm_network

networks:
  npm_network:
    external: true
```

Khởi chạy NPM:

```bash
cd ~/nginx-proxy-manager
docker compose up -d
```

Truy cập `http://<IP_ORACLE_VM>:81` để cấu hình tài khoản ban đầu (Mặc định: `admin@example.com` / `changeme`).

---

## 4. Triển khai IELTS Learning Platform

### 4.1. Clone Code & Thiết lập Biến Môi trường

```bash
# Clone repository
git clone <REPO_URL> /opt/ielts-learning-platform
cd /opt/ielts-learning-platform

# Tạo file biến môi trường production
cp .env.example .env.production
nano .env.production
```

Cập nhật các giá trị bí mật:

- `POSTGRES_PASSWORD`: Mật khẩu bảo mật cho database.
- `BETTER_AUTH_SECRET`: Sinh chuỗi 32 ký tự ngẫu nhiên bằng `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: Domain chính thức, ví dụ `https://ielts.yourdomain.com`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Khóa Google OAuth (Authorized Redirect URI: `https://ielts.yourdomain.com/api/auth/callback/google`).
- `GEMINI_API_KEY` / `GEMINI_API_KEYS`: Khóa Google Gemini API.
- `S3_ENDPOINT`: URL nội bộ của SeaweedFS trong Docker network (`http://seaweedfs:8333`).
- `S3_PUBLIC_ENDPOINT`: URL công khai của SeaweedFS S3 API qua NPM, ví dụ `https://s3.yourdomain.com`.
- `S3_BUCKET_NAME`: Tên bucket lưu audio (mặc định `ielts-audio-submissions`).

### 4.2. Build & Khởi chạy Containers

```bash
# Build và chạy ngầm
docker compose up -d --build

# Kiểm tra trạng thái containers và healthcheck
docker compose ps
```

Kiểm tra log:

```bash
# Log ứng dụng Next.js
docker compose logs -f app

# Log database PostgreSQL
docker compose logs -f postgres

# Log SeaweedFS S3 Object Storage
docker compose logs -f seaweedfs
```

### 4.3. Chạy Migration Database

Khi container `app` đã sẵn sàng và `postgres` đã healthy:

```bash
# Chạy migration Drizzle ORM
docker compose exec app bun run db:migrate # (hoặc lệnh migration tương ứng)
```

---

## 5. Cấu hình Reverse Proxy & SSL trên Nginx Proxy Manager

Đăng nhập vào giao diện Web NPM (`http://<IP_ORACLE_VM>:81`) và tạo 2 Proxy Hosts:

### 5.1. Proxy Host 1: Ứng dụng Chính Next.js (`ielts.yourdomain.com`)

**Tab "Details":**

- **Domain Names**: `ielts.yourdomain.com` (và `www.ielts.yourdomain.com` nếu có)
- **Scheme**: `http`
- **Forward Hostname / IP**: `ielts-app` (Tên container dịch vụ trong mạng `npm_network`)
- **Forward Port**: `3000`
- **Cache Assets**: Bật
- **Block Common Exploits**: Bật
- **Websockets Support**: **BẬT (ON)** (Bắt buộc cho Gemini Live API, streaming audio và Server-Sent Events)

**Tab "SSL":**

- **SSL Certificate**: `Request a new SSL Certificate`
- **Force SSL**: Bật
- **HTTP/2 Support**: Bật
- **HSTS Enabled**: Bật
- **I Agree to the Let's Encrypt Terms of Service**: Bật

**Tab "Advanced":**

```nginx
# Cho phép upload file ghi âm Speaking dung lượng lớn
client_max_body_size 50M;

# Tăng timeout cho các tác vụ xử lý AI và Live WebSocket streaming
proxy_read_timeout 300s;
proxy_send_timeout 300s;
proxy_connect_timeout 60s;

# WebSocket Headers (đảm bảo tương thích đầy đủ với Gemini Live Audio stream)
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

### 5.2. Proxy Host 2: SeaweedFS S3 API (`s3.yourdomain.com` - ADR-0003)

Dùng cho thí sinh upload trực tiếp bài Speaking qua S3 Presigned PUT URL và nghe lại qua Presigned GET URL:

**Tab "Details":**

- **Domain Names**: `s3.yourdomain.com`
- **Scheme**: `http`
- **Forward Hostname / IP**: `ielts-seaweedfs`
- **Forward Port**: `8333`
- **Websockets Support**: Tắt
- **Block Common Exploits**: Bật

**Tab "SSL":**

- **SSL Certificate**: `Request a new SSL Certificate`
- **Force SSL**: Bật
- **HTTP/2 Support**: Bật

**Tab "Advanced":**

```nginx
# Cho phép upload file S3 lớn và giữ nguyên host header cho S3 signature v4
client_max_body_size 100M;
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_connect_timeout 300;
proxy_http_version 1.1;
proxy_set_header Connection "";
chunked_transfer_encoding off;
```

---

## 6. Vận hành, Giám sát & Sao lưu

### 6.1. Kiểm tra Health Check

Endpoint kiểm tra sức khỏe của Next.js:

```bash
curl -I https://ielts.yourdomain.com/api/health
# HTTP/2 200 OK
```

### 6.2. Sao lưu Cơ sở Dữ liệu & Audio Storage Định kỳ (Automated Backup)

Tạo cron job sao lưu PostgreSQL và SeaweedFS volume tự động mỗi ngày vào 02:00 sáng:

```bash
# Tạo script backup ~/backup-ielts-platform.sh
cat << 'EOF' > ~/backup-ielts-platform.sh
#!/bin/bash
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR/postgres $BACKUP_DIR/seaweedfs
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# 1. Backup PostgreSQL Database
docker exec -t ielts-postgres pg_dump -U postgres ielts_platform | gzip > "$BACKUP_DIR/postgres/ielts_db_$TIMESTAMP.sql.gz"

# 2. Backup SeaweedFS Audio Data
docker run --rm --volumes-from ielts-seaweedfs -v $BACKUP_DIR/seaweedfs:/backup alpine tar czf /backup/seaweedfs_data_$TIMESTAMP.tar.gz /data

# Giữ bản sao lưu trong vòng 30 ngày
find $BACKUP_DIR/postgres -type f -name "*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR/seaweedfs -type f -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x ~/backup-ielts-platform.sh

# Thêm vào crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/backup-ielts-platform.sh") | crontab -
```

### 6.3. Cập nhật Phiên bản Ứng dụng (Zero-downtime Rollout)

```bash
cd /opt/ielts-learning-platform
git pull origin main
docker compose build app
docker compose up -d --no-deps app
```
