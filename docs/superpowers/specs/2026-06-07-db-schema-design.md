# DB Schema Design — Baskety

**Date:** 2026-06-07
**Scope:** PostgreSQL schema for all core subsystems

---

## Design Principles

Two distinct subsystems with different philosophies:

- **Inventory subsystem (item-centric):** source of truth is the item record. Transactions automate updates but do not define state. Consumption is never logged — quantities are edited directly.
- **Price tracking subsystem (transaction-centric):** purchase records focused on price, store, brand, and date. Not used to compute inventory state.

---

## Section 1: Identity & Households

```
users
  — id, email, name, password_hash, created_at, updated_at

sessions
  — id, user_id,
    token_hash (unique),
    created_at,
    expires_at (nullable, null = never),
    revoked_at (nullable, null = active)

households
  — id, name, created_at, updated_at

household_members
  — household_id, user_id,           (PK: household_id + user_id)
    role (owner|member|guest),
    joined_at, invited_by_user_id,
    expires_at (nullable, null = never),
    revoked_at (nullable, null = active)

inventory_share_links
  — id, inventory_id, token (unique),
    created_by_user_id,
    password_hash (nullable),
    expires_at (nullable),
    revoked_at (nullable),
    created_at
```

### Session rules

- `token_hash` stores `sha256(raw_token)`. The raw token is returned to the client at login and never stored server-side.
- Raw tokens are 32 cryptographically random bytes, base64url-encoded.
- Clients send `Authorization: Bearer <raw_token>` on every request. The server hashes it and looks up `token_hash`.
- A session is invalid if `revoked_at IS NOT NULL` or `expires_at < now()`.
- Logout stamps `revoked_at` on the current session — instant invalidation.
- Expired sessions are purged by pg_cron. Session duration is configurable via `user_settings` (`session_duration_days`, default 30).
- The public user (link-based access) does not get a `sessions` row — its context is scoped entirely within the request via the share link token.

### Rules

- Every standard user must have at least one `household_members` row. Enforced at app layer during onboarding (user either creates or joins a household before proceeding).
- A household must always have at least one `household_members` row where `role = owner`, `revoked_at IS NULL`, and `expires_at IS NULL`.
- `expires_at` and `revoked_at` apply to any role — a membership of any kind can be time-limited or revoked.

### Guest access model

Two distinct patterns:

1. **Link-based access (public user):** A system-seeded singleton user (well-known UUID, seeded at deploy time) represents anonymous link access. When someone visits a valid `inventory_share_links` token, the server creates a session for the public user scoped to that inventory. No `household_members` row is created. Password on the link is optional.

2. **Invited guest (existing user):** An existing user receives a `household_members` row with `role = guest` plus an explicit `inventory_permissions` row (see Section 2). They log in with their own account and switch household context in the UI.

---

## Section 2: Inventories & Permissions

```
inventories
  — id, household_id, name, description, created_at, updated_at

inventory_permissions
  — inventory_id, user_id,           (PK: inventory_id + user_id)
    permission (full|read_only|deny)

inventory_items
  — id, inventory_id, name, unit, target_quantity, category,
    notes, deleted_at (nullable), created_at, updated_at

inventory_batches
  — id, inventory_item_id, quantity,
    expires_at (nullable),
    added_at,
    emptied_at (nullable),
    notes
```

### Rules

- **Owner:** implicit `full` access to all inventories in the household. No row in `inventory_permissions` is created or queried for owners.
- **Member (no row):** defaults to `full` access. Owner opts members *out* explicitly.
- **Guest (no row):** defaults to `deny`. An explicit `read_only` row must be created to grant access.
- `deny` permission means the inventory does not appear in the user's view at all.
- `deleted_at` on `inventory_items` is a soft delete, preserving transaction history integrity.
- **Batch lifecycle:** quantity is decremented as items are consumed. When it reaches 0, `emptied_at` is stamped. A background cruncher periodically purges zero-quantity batches.
- A user who does not want batch tracking simply maintains one batch per item with `expires_at = NULL`.
- Total quantity on hand = `SUM(quantity)` across batches where `emptied_at IS NULL`.

---

## Section 3: Grocery Lists

```
grocery_lists
  — id, inventory_id, name,
    status (active|completed|archived),
    created_by_user_id,
    created_at, completed_at,
    pinned_at (nullable),
    expires_at (nullable)

grocery_list_items
  — id, grocery_list_id,
    inventory_item_id (nullable),
    name, quantity, unit, notes,
    status (pending|bought|skipped),
    sort_order,
    created_at, updated_at
```

### Rules

- `inventory_item_id = NULL` means a one-off purchase — not linked to inventory, but still generates a `purchase_transactions` row and a `catalog_entries` entry when marked bought.
- List status lifecycle: `active` → `completed` (user marks shopping trip done) → `archived` (retained per policy) → purged by cruncher.
- `expires_at` is set at creation time from household/user retention settings. `NULL` = never expire.
- Pinned lists (`pinned_at IS NOT NULL`) are immune to the cruncher regardless of `expires_at`.
- System owner settings cap maximum retention and maximum pinned lists per household; enforced at the app layer.
- Continuous sync (live list updates across household members during a shopping trip) is a stretch goal and not in scope for the initial implementation.

---

## Section 4: Receipt Scanning

```
receipt_scans
  — id, household_id,
    grocery_list_id (nullable),
    raw_image_path,
    ocr_text (nullable),
    llm_raw_response (nullable),
    status (uploading|ocr_processing|llm_processing|
            pending_review|committed|failed),
    error_message (nullable),
    created_by_user_id,
    created_at, updated_at

receipt_scan_items
  — id, receipt_scan_id,
    raw_text,
    parsed_name (nullable),
    parsed_brand (nullable),
    parsed_quantity (nullable),
    parsed_unit (nullable),
    parsed_price_per_unit (nullable),
    parsed_currency (nullable),
    parsed_store_name (nullable),
    confidence_score (nullable),
    status (pending|accepted|rejected|corrected),
    inventory_item_id (nullable),
    corrected_name (nullable),
    corrected_brand (nullable),
    corrected_quantity (nullable),
    corrected_price_per_unit (nullable),
    corrected_currency (nullable),
    corrected_store_name (nullable),
    created_at, updated_at
```

### Rules

- `grocery_list_id` links the scan to the shopping trip that prompted it. Nullable because a user may scan a receipt independently of an active list.
- `raw_image_path` is a reference to file storage (local filesystem for self-hosted; S3-compatible for cloud deployments).
- Each `receipt_scan_items` row is one line from the receipt. `parsed_*` fields hold LLM extraction output; `corrected_*` fields hold user overrides during the review step.
- If `status = accepted`, parsed values are used as-is. If `status = corrected`, corrected values win.
- The review step is mandatory. Parsed data is never auto-applied to inventory without user confirmation.
- On commit: accepted/corrected items create `purchase_transactions` rows and optionally update `inventory_batches`.

---

## Section 5: Price Tracking & Catalog

```
stores
  — id, name, chain_name (nullable), address (nullable),
    canonical_store_id (nullable, self-referential FK for merges),
    created_at, updated_at

catalog_entries
  — id, name, brand (nullable), unit (nullable), category (nullable),
    scope (public|private),
    household_id (nullable, null = public entry),
    canonical_entry_id (nullable, self-referential FK for merges),
    created_at, updated_at

purchase_transactions
  — id, household_id,
    grocery_list_item_id (nullable),
    receipt_scan_item_id (nullable),
    catalog_entry_id (nullable),
    store_id (nullable),
    price_per_unit, currency,
    quantity (nullable),
    purchased_at, created_at
```

### Rules

- **Stores:** user-defined initially. The same chain may appear as multiple rows until a user or LLM-assisted deduplication step merges them (same pattern as catalog entries).
- **Catalog deduplication:** `canonical_entry_id` points to the canonical entry when two are merged. The non-canonical entry becomes an alias. On merge, all `purchase_transactions` referencing the alias are re-pointed to the canonical entry. App-layer queries always follow the canonical chain.
- `scope = public, household_id = NULL`: public catalog built from aggregated user transactions.
- `scope = private`: household-only catalog for brand/product preferences.
- `purchase_transactions.quantity` is nullable — useful context but not required for price tracking.
- A transaction is created for every bought item: receipt scan commit, manual grocery list completion, or direct inventory update.

---

## Section 6: Settings

```
system_settings
  — key (PK), value, updated_at

household_settings
  — household_id, key, value, updated_at
  (PK: household_id + key)

user_settings
  — user_id, key, value, updated_at
  (PK: user_id + key)

llm_provider_configs
  — id,
    household_id (nullable, null = system default),
    provider (anthropic|openai|ollama|litellm|custom),
    endpoint_url (nullable),
    api_key_encrypted (nullable),
    model,
    is_default (bool),
    created_at, updated_at

ocr_provider_configs
  — id,
    household_id (nullable, null = system default),
    provider (tesseract|google_vision|aws_textract|azure|custom),
    endpoint_url (nullable),
    api_key_encrypted (nullable),
    extra_config (jsonb, nullable),
    is_default (bool),
    created_at, updated_at
```

### Key settings

| Scope | Key | Purpose |
|---|---|---|
| System | `max_list_retention_days` | Caps maximum list retention across all households |
| System | `max_pinned_lists_per_household` | Caps pinned list count per household |
| Household | `default_list_retention_days` | Default retention for new lists (default: 30) |
| User | `list_retention_days` | User-level override |

**Retention precedence:** `MIN(system max, user preference ?? household default ?? 30 days)`

### Provider config rules

- `household_id = NULL` = system-level default configured by the self-hoster at deploy time. Households inherit it unless they add their own row.
- `endpoint_url` enables routing through a LiteLLM proxy, a local Ollama instance, or any OpenAI-compatible API. `provider` tells the app which API client format to use.
- `model` is required for LLM configs — same provider, significantly different behavior and cost.
- `extra_config (jsonb)` on OCR configs handles provider-specific parameters without schema changes per provider.
- `api_key_encrypted` — keys are stored encrypted at rest. Encryption/decryption handled by the app layer.