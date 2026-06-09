# syntax=docker/dockerfile:1
# Build context: repository root.  Build with: docker build -f Dockerfile .

# Stage 1: build the web app (workspace-aware)
FROM node:22-alpine AS web
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @baskety/web... build

# Stage 2: build the Go binary (embeds the web dist)
FROM golang:1.26-alpine AS go
WORKDIR /app
COPY baskety/ ./
COPY --from=web /repo/apps/web/dist ./internal/shared/dist
RUN CGO_ENABLED=0 go build -o baskety ./cmd/baskety

# Stage 3: minimal runtime image
FROM alpine:3.20
COPY --from=go /app/baskety /usr/local/bin/baskety
ENTRYPOINT ["baskety"]
