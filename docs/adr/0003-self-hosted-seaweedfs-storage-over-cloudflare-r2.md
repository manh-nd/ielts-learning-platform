# Self-hosted SeaweedFS on VM Storage over Cloudflare R2 / MinIO for MVP

The initial research explored Cloudflare R2 and MinIO for audio file storage. We chose **SeaweedFS** (`chrislusf/seaweedfs`) running directly on the Oracle Cloud VM's local block storage (persisted via Docker volume `seaweedfs_data`) for the MVP stage.

## Context & Rationale

1. **MinIO Ecosystem Shift (Late 2025)**: MinIO transitioned to source-only distribution for Community Edition and ceased publishing official pre-built multi-arch Docker Hub images. MinIO also uses the AGPLv3 copyleft license and consumes ~500MB–1.5GB RAM.
2. **SeaweedFS Strengths**:
   - **Permissive License**: Apache 2.0 (commercial-friendly, zero copyleft risk).
   - **Official Multi-Arch Images**: Maintained `chrislusf/seaweedfs` with native `linux/arm64` support for Oracle Cloud Ampere A1 and `linux/amd64` for x86_64.
   - **Ultra-Lightweight**: Requires only ~100MB–200MB RAM in all-in-one mode (`weed server -s3`).
   - **Optimized for Small Files**: High-throughput storage architecture specifically designed for millions of small files (IELTS audio recordings ~200KB–2MB).
3. **Standard S3 Protocol Abstraction**: SeaweedFS provides full S3 API compatibility (`-s3` gateway on port 8333). The application interfaces exclusively through `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
4. **Seamless Cloud Migration**: Upgrading to Cloudflare R2 or AWS S3 in Phase 2 requires zero application code changes — only updating environment variables (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_FORCE_PATH_STYLE`).
5. **Zero External Dependencies**: Enables fully isolated offline local development (`localhost:8333`) and self-contained VM production deployment with zero egress bandwidth charges.

## Considered Options

- **Cloudflare R2**: Free egress, but requires external account setup, API token provisioning, and network connectivity during development.
- **MinIO**: S3-compatible, but stopped official Docker Hub builds, carries AGPLv3 copyleft risks, and has a heavier memory footprint (~500MB–1.5GB RAM).
- **Garage S3**: Lightweight Rust-based S3, but uses AGPLv3 and requires manual TOML configuration.
- **SeaweedFS (chosen)**: Apache 2.0 license, official multi-arch Docker image, ultra-lightweight (~150MB RAM), native S3 API gateway, and seamless zero-code upgrade path to Cloudflare R2/AWS S3.
