# Sprint 18 — End-to-End Hardening + Launch Readiness

**Goal:** All loose ends closed. README complete. Project is ready for public `v1.0.0` release.

**Dependencies:** All previous sprints.

| # | Task | Est. |
|---|------|------|
| 18.1 | Smoke test full Docker Compose stack locally end-to-end: register → household → inventory → grocery list → shopping trip → scan receipt → commit | 1d |
| 18.2 | Security audit: verify all endpoints enforce householdID scope; session revocation works; no PII in structured logs | 0.5d |
| 18.3 | DB index pass: add indexes on all FK columns and high-frequency query predicates; run EXPLAIN ANALYZE on auto-generation query | 0.5d |
| 18.4 | Write `README.md`: project description, screenshots (web + mobile), Docker Compose quick-start, configuration reference, self-hosting guide, backup instructions | 1d |
| 18.5 | Update `CLAUDE.md` build/run commands section with all final commands (go run, pnpm dev, docker compose up, eas build) | 0.5d |
| 18.6 | Tag `v1.0.0`; verify `release.yml` fires, GHCR image is pushed, and GitHub Release draft is created; build APK and attach to release | 1d |

**Sprint total: 4.5d**
