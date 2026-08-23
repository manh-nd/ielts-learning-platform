# syntax=docker/dockerfile:1

# ==============================================================================
# Base Stage: Official Bun 1 Alpine for ARM64 / x86_64
# ==============================================================================
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ==============================================================================
# Dependencies Stage: Install dependencies using Bun
# ==============================================================================
FROM base AS deps
WORKDIR /app

# Copy package manifests & bun lockfile
COPY package.json bun.lock* ./

# Install exact dependencies with frozen lockfile
RUN bun install --frozen-lockfile

# ==============================================================================
# Builder Stage: Build Next.js in standalone mode
# ==============================================================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Run Next.js production build
RUN bun run build

# ==============================================================================
# Runner Stage: Ultra-lean Bun production runtime container
# ==============================================================================
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-privileged system user for security (Alpine syntax)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nextjs

# Copy static assets & public directory
COPY --from=builder /app/public ./public

# Setup prerender cache directory permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Copy standalone output from Next.js build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Start Next.js standalone server using Bun runtime
CMD ["bun", "server.js"]
