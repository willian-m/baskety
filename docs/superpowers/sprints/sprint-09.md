# Sprint 9 — Web Frontend: Foundation + Auth Pages

**Goal:** Web app has routing, auth context, API client wired to backend, and working login/register pages.

**Dependencies:** Sprint 3 (auth API live); Sprint 1 (packages/core scaffold).

| # | Task | Est. |
|---|------|------|
| 9.1 | Implement `packages/core/api/types.ts`: all domain TypeScript types (money as number minor units + currency string; quantities and timestamps as strings) | 1d |
| 9.2 | Implement `packages/core/api/client.ts`: typed fetch wrapper, reads uiStore for token/activeHouseholdId/activeServerUrl, unwraps `{ data }` envelope, throws `ApiError` on non-2xx | 0.5d |
| 9.3 | Implement `packages/core/stores/uiStore.ts`: token, activeHouseholdId, activeServerUrl, sidebarCollapsed; setSession, clearSession | 0.5d |
| 9.4 | Implement `packages/core/queries/auth.ts`: useLogin, useRegister, useLogout, useHouseholds | 0.5d |
| 9.5 | Implement `AuthContext` + `HouseholdContext` in `apps/web`; wire into root layout | 0.5d |
| 9.6 | Configure TanStack Router route tree: all routes declared with auth guard on `_app.tsx` parent, redirects | 0.5d |
| 9.7 | Build `/login` page: email/password form with Zod validation, error display, redirect on success | 0.5d |
| 9.8 | Build `/register` page: email/name/password fields, validation, auto-login after registration | 0.5d |

**Sprint total: 4.5d**
