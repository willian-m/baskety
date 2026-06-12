# Sprint 8 — Go Backend: Integration Tests + OpenAPI

**Goal:** All repository-layer integration tests passing. OpenAPI 3.1 document served at `GET /api/v1/openapi.json`. Backend is shippable.

**Dependencies:** Sprints 3–7.

| # | Task | Est. |
|---|------|------|
| 8.1 | Repository integration tests — auth: register, login, session lifecycle | 0.5d |
| 8.2 | Repository integration tests — household: create, members, permissions, share link | 0.5d |
| 8.3 | Repository integration tests — inventory: soft-delete, batch aggregation | 0.5d |
| 8.4 | Repository integration tests — grocery: auto-generation query correctness | 0.5d |
| 8.5 | Repository integration tests — receipt: state machine transitions, commit flow | 0.5d |
| 8.6 | Repository integration tests — catalog: upsert idempotency, price history ordering | 0.5d |
| 8.7 | Implement `GET /api/v1/share/:token/inventory`: unauthenticated endpoint validates token, checks expiry/revocation, returns read-only inventory view | 0.5d |
| 8.8 | Generate and serve OpenAPI 3.1 spec at `GET /api/v1/openapi.json` (swaggo or hand-authored YAML embedded in binary) | 0.5d |

**Sprint total: 4d**
