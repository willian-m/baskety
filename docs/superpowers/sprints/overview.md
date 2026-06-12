# Baskety — Implementation Sprint Plan Overview

> Produced: 2026-06-08.
> Architecture is fully locked. This document covers only implementation work.
> Assumes one full-time developer. Sprint = 1 calendar week (5 working days).

## Summary Table

| Sprint | Theme | Est. Days | Calendar Week |
|--------|-------|-----------|---------------|
| 1 | Monorepo Scaffold + Shared Packages Bootstrap | 5d | Week 1 |
| 2 | Database: Migrations, sqlc, Test Harness | 5d | Week 2 |
| 3 | Go Backend — Auth + Household Domains | 4.5d | Week 3 |
| 4 | Go Backend — Inventory Domain | 5d | Week 4 |
| 5 | Go Backend — Grocery Lists Domain | 4.5d | Week 5 |
| 6 | Go Backend — Receipt Scanning Domain | 6.5d | Weeks 6–7 |
| 7 | Go Backend — Catalog, Settings, pg_cron, Wire-up | 4.5d | Week 8 |
| 8 | Go Backend — Integration Tests + OpenAPI | 4d | Week 9 |
| 9 | Web Frontend — Foundation + Auth Pages | 4.5d | Week 10 |
| 10 | Web Frontend — Inventory + Grocery Pages | 5d | Week 11 |
| 11 | Web Frontend — Receipt Review + Reports + Settings | 5.5d | Week 12 |
| 12 | Web Frontend — Share Page + Test Coverage | 4d | Week 13 |
| 13 | Mobile — Foundation + Auth + Navigation | 4.5d | Week 14 |
| 14 | Mobile — Inventory + Grocery Screens | 5d | Week 15 |
| 15 | Mobile — Receipt Scanning + Offline + Network Switching | 5d | Week 16 |
| 16 | Mobile — Testing + EAS Build Pipeline | 3.5d | Week 17 |
| 17 | Docker, CI/CD, Release Pipeline | 4d | Week 18 |
| 18 | End-to-End Hardening + Launch Readiness | 4.5d | Week 19 |
| **Total** | | **83.5d** | **19 weeks** |

## Effort Summary

| Category | Sprints | Est. Days |
|----------|---------|-----------|
| Monorepo + Shared Packages | 1 | 5d |
| Database (migrations, sqlc, test harness) | 2 | 5d |
| Go Backend (all domains + integration tests + OpenAPI) | 3–8 | ~30d |
| Web Frontend (all pages + tests) | 9–12 | ~19d |
| Mobile App (all screens + tests + EAS build) | 13–16 | ~18d |
| Docker + CI/CD + Release Pipeline | 17 | 4d |
| Hardening + Launch Readiness | 18 | 4.5d |
| **Total** | **18 sprints** | **~83.5d** |

**Calendar duration:** ~19 weeks (~4.5 months) with one full-time developer.

## Risk Flags

- **Sprint 6 (Receipt Scanning)** runs 6.5 days — the heaviest sprint. Run as a 1.5-week sprint or defer the Anthropic LLM adapter to Sprint 7.
- **Sprint 11 (Web: Receipt + Reports + Settings)** runs 5.5 days — `/reports` (task 11.5) is the most deferrable if running behind.
- **Receipt review UI** (both web Sprint 11.3 and mobile Sprint 15.5) is estimated at 2d each — these are the most UX-complex screens and may run over.
- Estimates assume fluency in Go, TypeScript, React, and React Native. Ramp-up on unfamiliar tools (River, Turborepo, Expo EAS) is baked in at ~0.5d per tool.
- CI integration tests (testcontainers-go) require Docker available on the GitHub Actions runner — `ubuntu-latest` supports this natively without Docker-in-Docker.
