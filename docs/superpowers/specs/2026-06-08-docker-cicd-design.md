# Docker Compose & CI/CD — Baskety

**Date:** 2026-06-08
**Scope:** Docker Compose service definitions and GitHub Actions CI/CD pipeline

---

## Design Principles

- **Minimal service footprint:** Only PostgreSQL and the Baskety binary are required. Background jobs run inside the binary (River), scheduled maintenance runs inside PostgreSQL (pg_cron). No Redis, no separate worker process.
- **Opt-in extras:** MinIO is available as a Docker Compose profile for operators who want local S3-compatible storage. Not required for the default local-filesystem configuration.
- **Fast PR feedback:** Tests and linters run on every PR. Docker builds run only on `main`. Releases are triggered by git tags.
- **Release reliability:** The critical release path (Docker image) is fully automated. The Android APK is built and attached manually — decoupling the release from Expo's cloud infrastructure.

---

## Section 1: Docker Compose

### Services

#### `postgres`

Custom image extending `postgres:16` with the `postgresql-16-cron` package installed. pg_cron requires `shared_preload_libraries` to be set at server start, passed as a command override — no postgresql.conf mount required.

```
Dockerfile: docker/postgres/Dockerfile
Base image: postgres:16
Added: postgresql-16-cron package
```

Compose configuration:
- `command: postgres -c shared_preload_libraries=pg_cron -c cron.database_name=baskety`
- `POSTGRES_DB`, `POSTGRES_USER` set via environment
- `POSTGRES_PASSWORD` read from `.env` (not checked in; `.env.example` documents it)
- Named volume: `postgres_data:/var/lib/postgresql/data`
- Health check: `pg_isready -U baskety`
- `restart: unless-stopped`

The `pg_cron` extension itself and all cron job registrations are handled by goose migrations at baskety startup — nothing extra in the Docker layer.

#### `baskety`

Pulls `ghcr.io/yourorg/baskety:latest` (or a pinned tag).

- Port: `8080:8080`
- Bind mount: `./config.yaml:/etc/baskety/config.yaml:ro` — operator provides their own config file
- Named volume: `baskety_uploads:/data/uploads` — persists local file uploads
- Docker secret: `baskety_key` mounted at `/run/secrets/baskety_key`
- `depends_on: postgres: condition: service_healthy` — waits for postgres health check before starting
- `restart: unless-stopped`

Goose migrations run automatically at startup. Operators upgrade by pulling the new image and restarting:

```bash
docker compose pull && docker compose up -d
```

#### `minio` (optional profile)

Active only with `docker compose --profile minio up`. Uses the official `minio/minio` image.

- Ports: `9000:9000` (S3 API), `9001:9001` (web console)
- Named volume: `minio_data:/data`
- Credentials via environment (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`) — documented in `.env.example`
- Health check on the MinIO health endpoint
- `restart: unless-stopped`

When MinIO is active, operators set `storage.backend: s3` in `config.yaml` with `s3.endpoint: http://minio:9000`.

### Volumes

```
postgres_data     — PostgreSQL data directory
baskety_uploads   — local file uploads (receipts, images)
minio_data        — MinIO object store (profile: minio)
```

### Secrets

```
baskety_key       — AES encryption key; file: ./secrets/baskety_key
```

The DB password is not a Docker secret — it lives in `config.yaml` as part of the `database.url` connection string, consistent with the pattern established in the backend architecture spec.

### File layout

```
docker/
  postgres/
    Dockerfile        ← extends postgres:16, installs postgresql-16-cron
docker-compose.yml
.env.example          ← documents POSTGRES_PASSWORD, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
secrets/
  .gitignore          ← ignores baskety_key
  baskety_key.example ← placeholder explaining how to generate the key
config.yaml           ← operator config (not checked in; config.yaml.example is)
```

---

## Section 2: CI/CD — GitHub Actions

Image registry: `ghcr.io` (GitHub Container Registry). Authentication uses the automatic `GITHUB_TOKEN` — no extra secrets required for CI or image publishing.

### Workflow files

```
.github/workflows/
  ci.yml        ← tests + linters (PR + main)
  docker.yml    ← Docker build + push (main only, after ci passes)
  release.yml   ← Docker build + push versioned tag + draft GitHub Release (on tag)
```

---

### `ci.yml`

**Trigger:** `pull_request` and `push` to `main`.

Two jobs run in parallel:

**`test-go`**
- Runner: `ubuntu-latest` (Docker available natively — testcontainers-go works without Docker-in-Docker)
- Restores Go module cache and Go build cache
- `go vet ./...`
- `golangci-lint run`
- `go test -race ./...` (includes integration tests via testcontainers-go)

**`test-frontend`**
- Runner: `ubuntu-latest`
- Installs Node + pnpm, restores pnpm store cache
- `pnpm install --frozen-lockfile`
- `pnpm -r typecheck` — tsc across all packages and apps
- `pnpm -r lint` — ESLint across all packages and apps
- `pnpm -r test` — Vitest (`apps/web`, `packages/ui` web side) + Jest (`packages/core`, `packages/ui` native side, `apps/mobile`)

Both jobs must pass. No Docker build in this workflow.

---

### `docker.yml`

**Trigger:** `workflow_run` scoped to `ci.yml`, filtered to `branches: [main]` — fires only after `ci.yml` completes successfully on `main`. The branch filter is required; without it the trigger would also fire on PR branches where `ci.yml` runs.

- Builds the multi-stage Docker image (Node → Go → alpine)
- Pushes two tags to GHCR:
  - `:latest`
  - `:<short-sha>` (e.g. `:abc1234`) — stable reference for operators who want to pin to a specific commit
- Uses `GITHUB_TOKEN` for GHCR authentication

---

### `release.yml`

**Trigger:** Push of tags matching `v*.*.*`.

- Builds the same multi-stage Docker image
- Pushes to GHCR:
  - `:v1.2.3` (the exact version)
  - `:latest`
- Creates a **draft** GitHub Release using `gh release create --draft --generate-notes`
  - Auto-generated release notes from PR titles since the previous tag
  - Draft state signals the developer to attach the Android APK before publishing

---

## Section 3: Release Process

### Full lifecycle

1. Developer pushes a version tag:
   ```bash
   git tag v1.2.3 && git push origin v1.2.3
   ```

2. `release.yml` fires automatically:
   - Builds and pushes `:v1.2.3` + `:latest` to GHCR
   - Creates a draft GitHub Release with auto-generated notes

3. Developer builds the Android APK manually:
   ```bash
   eas build -p android --profile release
   ```
   (~15–30 min on Expo's infrastructure)

4. Developer opens the draft GitHub Release, uploads the signed APK, reviews the release notes, and clicks **Publish**.

### Self-hoster upgrade

```bash
docker compose pull
docker compose up -d
```

Goose migrations run automatically at startup. No manual migration step.

### Android CI scope

The Android APK is intentionally outside the automated pipeline. Rationale: the core release artifact is the Docker image. Coupling the release job to Expo's cloud infrastructure (queue times, outages, token expiry) would make the critical path dependent on a third party. JS/TS quality for the mobile app is still gated in `ci.yml` (`test-frontend` job covers `apps/mobile` typecheck, lint, and Jest).

When mobile becomes a first-class release surface or the team grows, revisit triggering `eas build --non-interactive` from `release.yml` using an `EXPO_TOKEN` secret.

---

## Section 4: Dependency Table

| Concern | Decision |
|---|---|
| Docker services | postgres (pg_cron), baskety, minio (optional profile) |
| PostgreSQL image | `postgres:16` + `postgresql-16-cron` (custom Dockerfile) |
| pg_cron config | `command` override in compose; extension + jobs registered by goose migrations |
| Secrets | Encryption key via Docker secret; DB password in config.yaml; postgres password via `.env` |
| CI on PR | Go tests + lint + frontend checks (two parallel jobs) |
| CI on main | Docker build + push `:latest` + `:<sha>` (after CI passes) |
| CI on tag | Docker build + push `:v1.2.3` + create draft GitHub Release |
| Android | JS/TS + Jest in CI; APK built manually, attached to draft release before publish |
| Image registry | GHCR (`ghcr.io/yourorg/baskety`) |
| CI auth | `GITHUB_TOKEN` (automatic) — no extra secrets |
