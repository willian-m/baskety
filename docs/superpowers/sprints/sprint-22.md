# Sprint 22 — Settings UX: Provider Dropdown, Active Indicator, Edit/Delete

**Goal:** Fix three user-reported issues with the LLM/OCR provider configuration UI: unclear provider field, no "active" indicator, and no way to edit or remove providers.

**Source:** User feedback report, 2026-06-14.

**Dependencies:** Sprint 7 (settings domain — handler, service, repository, `00007_settings_providers.sql`).

| # | Task | Est. |
|---|------|------|
| 22.1 | **Backend — SQL queries:** Add 6 new queries to `baskety/db/queries/settings.sql`: `UpdateLLMProvider` (UPDATE with `COALESCE($6, api_key_encrypted)` to skip re-encryption when no new key), `DeleteLLMProvider`, `UnsetDefaultLLMProviders` (sets all `is_default = false` for a household — used before setting a new default), and the three OCR equivalents. Run `make generate` to regenerate `gen/sqlc/`. | 0.5d |
| 22.2 | **Backend — Repository:** Extend `Repository` interface in `baskety/internal/settings/repository.go` with `UpdateLLMProvider`, `DeleteLLMProvider`, `UpdateOCRProvider`, `DeleteOCRProvider`. Implement all four in `repository_pg.go`. For Update when `req.IsDefault == true`: acquire a transaction from the DB pool, run `UnsetDefault*` then `Update*` within it. For Delete: single sqlc-generated call scoped by `household_id`. | 0.5d |
| 22.3 | **Backend — Service + DTOs:** Add `UpdateLLMProviderRequest` and `UpdateOCRProviderRequest` to `baskety/internal/settings/dto.go` (fields: provider, model/extra_config, endpoint_url, api_key `*string` nil-means-keep, is_default). Extend `ServiceIface` in `service.go` with `UpdateLLMProvider`, `DeleteLLMProvider`, `UpdateOCRProvider`, `DeleteOCRProvider`. Service validates that `provider` is in the allowed list (same as existing create logic). | 0.25d |
| 22.4 | **Backend — Handlers + Routes:** Add `HandleUpdateLLMProvider` (PATCH, returns updated provider), `HandleDeleteLLMProvider` (DELETE, 204 No Content), and their OCR counterparts to `baskety/internal/settings/handler.go`. Extract `id` from `chi.URLParam(r, "id")`. Register in `routes.go`: `r.Patch("/providers/llm/{id}", ...)`, `r.Delete("/providers/llm/{id}", ...)`, same for OCR. Update `baskety/internal/shared/openapi.json` to document the four new operations. | 0.5d |
| 22.5 | **Core — React Query hooks:** Add `useUpdateLLMProvider`, `useDeleteLLMProvider`, `useUpdateOCRProvider`, `useDeleteOCRProvider` mutations to `packages/core/src/queries/settings.ts`. Each calls the corresponding PATCH/DELETE endpoint and invalidates the relevant list query on success. Add `UpdateLLMProviderRequest` and `UpdateOCRProviderRequest` types to `packages/core/src/api/types.ts`. | 0.25d |
| 22.6 | **Web — Issue #1, LLM dropdown:** In `apps/web/src/features/settings/SettingsPage.tsx`, replace the free-text `<input>` for the LLM `provider` field (add form, ~line 81) with a `<select>` listing `['anthropic', 'openai', 'ollama', 'litellm', 'custom']`. Mirror the existing OCR `<select>` pattern (lines 197–209). | 0.25d |
| 22.7 | **Web — Issue #2, "Set as active" + is_default on create:** In `LLMProviderRow` and `OCRProviderRow`, render a "Set as active" button when `!p.is_default`; clicking it calls `useUpdateLLMProvider` with all existing fields + `is_default: true` (no api_key sent, so existing key is retained). In the add forms, replace the hardcoded `is_default: false` with a checkbox ("Set as active provider") that defaults to `true` when `providers.length === 0`. | 0.5d |
| 22.8 | **Web — Issue #3, Edit + Delete:** In `LLMProviderRow` and `OCRProviderRow`, add Edit and Delete action buttons. **Edit:** toggles the row into an inline edit form pre-populated with current values; API key shows `••••••••` placeholder if `has_api_key: true` (leave blank to keep existing); on submit calls `useUpdateLLMProvider`; Cancel restores read-only view. **Delete:** shows inline confirmation ("Delete? Confirm / Cancel") on the row; Confirm calls `useDeleteLLMProvider`. | 1d |

**Sprint total: 3.25d**

## Constraints

- No DB migration needed — `is_default` column and `CHECK` constraints already exist in migration `00007`.
- `UnsetDefault*` + `Update*` must run inside a single transaction to avoid a race where two clients simultaneously set `is_default = true`.
- When the PATCH handler receives `is_default: false`, skip the unset step and just call `Update*` directly (no transaction needed).
- The API key field on the edit form must be optional (`*string` in the DTO); `nil` means keep the existing encrypted key unchanged. The `COALESCE($6, api_key_encrypted)` in the SQL query handles this.
- "Set as active" sends all existing provider fields through the PATCH so no data is accidentally overwritten; it explicitly omits `api_key` (nil) so the encrypted key is preserved.
- No modal library — inline edit/delete patterns use local component state only, consistent with the existing add-form pattern.
