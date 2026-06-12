# Sprint 17 — Docker, CI/CD, Release Pipeline

**Goal:** Docker image builds and runs end-to-end. All three GitHub Actions workflows pass.

**Dependencies:** Sprint 8 (backend complete); Sprint 12 (web complete).

| # | Task | Est. |
|---|------|------|
| 17.1 | Write `docker/postgres/Dockerfile`: FROM postgres:16; install postgresql-16-cron; configure shared_preload_libraries | 0.5d |
| 17.2 | Write root `Dockerfile` (canonical multi-stage): Stage 1 node+pnpm web build; Stage 2 golang embeds dist, builds binary; Stage 3 alpine runtime | 1d |
| 17.3 | Write `docker-compose.yml`: postgres (custom image, volume, healthcheck, restart), baskety (depends_on health, config bind-mount, upload volume, Docker secret), minio (optional profile) | 0.5d |
| 17.4 | Write `.env.example`, `config.yaml.example`, `secrets/baskety_key.example` | 0.5d |
| 17.5 | Write `.github/workflows/ci.yml`: `test-go` + `test-frontend` parallel jobs on PR + main push | 0.5d |
| 17.6 | Write `.github/workflows/docker.yml`: triggered after CI on main; push `:latest` + `:<sha>` to GHCR | 0.5d |
| 17.7 | Write `.github/workflows/release.yml`: triggered on `v*.*.*` tag; push versioned image; create draft GitHub Release | 0.5d |

**Sprint total: 4d**
