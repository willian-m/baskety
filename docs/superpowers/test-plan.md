# Baskety Functional Test Plan

**Version:** 1.0 — 2026-06-12  
**Scope:** Backend API (Sprints 1–8), Web Frontend (Sprints 9–12), Mobile Foundation (Sprint 13)  
**Status:** Ready for execution

---

## 1. Overview

This document defines functional test cases for the Baskety system as implemented through Sprint 13. It is intended for execution by a test agent (e.g. the `gan-evaluator` agent) or a human QA engineer. It does not replace the existing automated unit/integration test suite — it supplements it with black-box functional coverage against a running system.

### 1.1 Scope

| Layer | In Scope | Out of Scope |
|-------|----------|--------------|
| Backend API | All 47 endpoints (Sprints 3–8) | Internal job queue mechanics |
| Web Frontend | All 12 routes (Sprints 9–12) | Visual regression / pixel comparison |
| Mobile | Sprint 13 screens only (onboarding, login, register, home) | Sprints 14–16 (not yet implemented) |
| Performance | — | Load testing, latency benchmarks |

### 1.2 Total Test Cases

| Section | Cases |
|---------|-------|
| 3. Backend API | 71 |
| 4. Web E2E Flows | 6 |
| 6. Mobile Manual | 6 |
| **Total** | **83** |

---

## 2. Test Environment Setup

### 2.1 Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- Go ≥ 1.22 (via `mise`: `~/.local/share/mise/installs/go/1.26.4/bin/go`)
- Node.js ≥ 20, pnpm ≥ 9
- Playwright installed: `pnpm exec playwright install --with-deps chromium`

### 2.2 Starting the Stack

```bash
# 1. Start Postgres
docker compose -f compose.dev.yml up -d

# 2. Start Go backend (applies migrations on boot)
export BASKETY_DATABASE_URL="postgres://baskety:baskety@localhost:5432/baskety?sslmode=disable"
cd baskety && go run ./cmd/baskety serve
# Server listens on http://localhost:8080

# 3. Start web dev server (separate terminal)
pnpm --filter @baskety/web dev
# Dev server listens on http://localhost:5173
```

### 2.3 Health Check

```bash
curl http://localhost:8080/healthz
# Expected: 200 OK
```

### 2.4 Reset Between Test Suites

When test suites need a clean database state, restart Postgres with a fresh volume:

```bash
docker compose -f compose.dev.yml down -v
docker compose -f compose.dev.yml up -d
# Wait for healthy, then restart the Go server to re-apply migrations
```

### 2.5 API Base URL

All API test cases below use `BASE = http://localhost:8080/api/v1`.

---

## 3. Backend API Functional Tests

Each test case uses the following format:

```
ID | Name
   Preconditions: ...
   Request: METHOD PATH
             Headers: ...
             Body: ...
   Expected: HTTP STATUS
             Response: ...
```

A `$VAR` token means "capture this value from a previous response for reuse".

---

### 3.1 Authentication

#### A01 — Register new user

```
Preconditions: No account with email test-a01@example.com exists
Request: POST /auth/register
  Body: { "email": "test-a01@example.com", "name": "Alice", "password": "password123" }
Expected: 201
  Response: { "data": { "id": <uuid>, "email": "test-a01@example.com", "name": "Alice", "created_at": <timestamp> } }
  Assert: id is non-empty UUID; no password field in response
```

#### A02 — Register duplicate email

```
Preconditions: A01 completed (email test-a01@example.com exists)
Request: POST /auth/register
  Body: { "email": "test-a01@example.com", "name": "Bob", "password": "other" }
Expected: 409
  Response: { "error": "email already taken" }
```

#### A03 — Register with missing required fields

```
Preconditions: none
Request: POST /auth/register
  Body: { "email": "missing@example.com" }
  (omit name and password)
Expected: 400
  Response: { "error": <non-empty string> }
```

#### A04 — Login with valid credentials

```
Preconditions: A01 completed
Request: POST /auth/login
  Body: { "email": "test-a01@example.com", "password": "password123" }
Expected: 200
  Response: { "data": { "token": $TOKEN_A01, "expires_at": <timestamp> } }
  Assert: token is non-empty string; expires_at is ~30 days from now
```

#### A05 — Login with invalid password

```
Preconditions: A01 completed
Request: POST /auth/login
  Body: { "email": "test-a01@example.com", "password": "wrongpassword" }
Expected: 401
  Response: { "error": <non-empty string> }
```

#### A06 — Logout revokes token

```
Preconditions: A04 completed; $TOKEN_A01 captured
Request: DELETE /auth/session
  Headers: Authorization: Bearer $TOKEN_A01
Expected: 204
  Response: (empty body)
```

#### A07 — Revoked token rejected on protected route

```
Preconditions: A06 completed (token revoked)
Request: GET /households
  Headers: Authorization: Bearer $TOKEN_A01
Expected: 401
  Response: { "error": <non-empty string> }
```

---

### 3.2 Household Management

*Setup for this section: register a fresh user (user-h@example.com / password123), login, capture $TOKEN_H.*

#### H01 — Create household

```
Request: POST /households
  Headers: Authorization: Bearer $TOKEN_H
  Body: { "name": "Test Household" }
Expected: 201
  Response: { "data": { "id": $HOUSEHOLD_ID, "name": "Test Household", "created_at": <timestamp> } }
```

#### H02 — List households

```
Request: GET /households
  Headers: Authorization: Bearer $TOKEN_H
Expected: 200
  Response: { "data": [ { "id": $HOUSEHOLD_ID, "name": "Test Household", ... } ] }
  Assert: array contains exactly the household created in H01
```

#### H03 — Get household by ID

```
Request: GET /households/$HOUSEHOLD_ID
  Headers: Authorization: Bearer $TOKEN_H
Expected: 200
  Response: { "data": { "id": $HOUSEHOLD_ID, "name": "Test Household", ... } }
```

#### H04 — Get household not belonging to user

```
Preconditions: Another household exists (created by a different user); capture $OTHER_HH_ID
Request: GET /households/$OTHER_HH_ID
  Headers: Authorization: Bearer $TOKEN_H
Expected: 404
  Response: { "error": <non-empty string> }
```

#### H05 — Add member to household

```
Preconditions: Second user registered (user-h2@example.com); $USER_H2_ID captured
Request: POST /households/$HOUSEHOLD_ID/members
  Headers: Authorization: Bearer $TOKEN_H
  Body: { "user_id": "$USER_H2_ID", "role": "member" }
Expected: 201
  Response: { "data": { "user_id": "$USER_H2_ID", "role": "member", "joined_at": <timestamp> } }
```

#### H06 — Remove member from household

```
Preconditions: H05 completed
Request: DELETE /households/$HOUSEHOLD_ID/members/$USER_H2_ID
  Headers: Authorization: Bearer $TOKEN_H
Expected: 204
  Response: (empty body)
```

#### H07 — Create share link without password

```
Preconditions: An inventory $INV_ID exists in $HOUSEHOLD_ID
Request: POST /households/$HOUSEHOLD_ID/share-links
  Headers: Authorization: Bearer $TOKEN_H
  Body: { "inventory_id": "$INV_ID" }
Expected: 201
  Response: { "data": { "id": <uuid>, "token": $SHARE_TOKEN, "expires_at": null, "created_at": <timestamp> } }
```

#### H08 — Create share link with password and expiry

```
Preconditions: same as H07
Request: POST /households/$HOUSEHOLD_ID/share-links
  Headers: Authorization: Bearer $TOKEN_H
  Body: { "inventory_id": "$INV_ID", "password": "secret123", "expires_at": "<30 days from now>" }
Expected: 201
  Response: { "data": { "id": <uuid>, "token": $SHARE_TOKEN_PW, "expires_at": <timestamp>, ... } }
  Assert: password not present in response
```

#### H09 — Access share link (no password)

```
Preconditions: H07 completed; $SHARE_TOKEN captured
Request: GET /share/$SHARE_TOKEN/inventory
  (No Authorization header)
Expected: 200
  Response: { "data": { "inventory_id": "$INV_ID", "items": [ ... ] } }
```

#### H10 — Access expired share link returns 410

```
Preconditions: A share link with expires_at in the past was created (direct DB insert or a link past expiry)
Request: GET /share/$EXPIRED_TOKEN/inventory
  (No Authorization header)
Expected: 410
  Response: { "error": <non-empty string> }
```

---

### 3.3 Inventory Management

*Setup: use $TOKEN_H and $HOUSEHOLD_ID from section 3.2.*

#### I01 — Create inventory

```
Request: POST /inventories
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Kitchen Pantry", "description": "Main pantry items" }
Expected: 201
  Response: { "data": { "id": $INV_ID, "household_id": "$HOUSEHOLD_ID", "name": "Kitchen Pantry", ... } }
```

#### I02 — List inventories (household-scoped)

```
Request: GET /inventories
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ { "id": "$INV_ID", ... } ] }
  Assert: only inventories belonging to $HOUSEHOLD_ID returned
```

#### I03 — Update inventory

```
Request: PUT /inventories/$INV_ID
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Updated Pantry" }
Expected: 200
  Response: { "data": { "id": "$INV_ID", "name": "Updated Pantry", ... } }
```

#### I04 — Delete inventory

```
Preconditions: A separate inventory $INV_DEL_ID created for deletion
Request: DELETE /inventories/$INV_DEL_ID
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 204
  Response: (empty body)
Follow-up: GET /inventories/$INV_DEL_ID → 404
```

#### I05 — Create item with all fields

```
Request: POST /inventories/$INV_ID/items
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Rice", "category": "Grains", "unit": "kg", "target_quantity": 5.0, "notes": "Jasmine rice" }
Expected: 201
  Response: { "data": { "id": $ITEM_ID, "inventory_id": "$INV_ID", "name": "Rice", "target_quantity": 5, ... } }
```

#### I06 — Create item with missing name

```
Request: POST /inventories/$INV_ID/items
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "category": "Grains", "unit": "kg", "target_quantity": 5.0 }
Expected: 400
  Response: { "error": <non-empty string> }
```

#### I07 — List items excludes soft-deleted

```
Preconditions: $ITEM_ID exists; a second item $ITEM_DEL_ID was created and then deleted (I09 pattern)
Request: GET /inventories/$INV_ID/items
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Assert: $ITEM_DEL_ID NOT present in the array
```

#### I08 — Update item

```
Request: PUT /inventories/$INV_ID/items/$ITEM_ID
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Basmati Rice", "category": "Grains", "unit": "kg", "target_quantity": 3.0 }
Expected: 200
  Response: { "data": { "name": "Basmati Rice", "target_quantity": 3, ... } }
```

#### I09 — Delete item (soft delete)

```
Request: DELETE /inventories/$INV_ID/items/$ITEM_ID
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 204
  Response: (empty body)
Follow-up: GET /inventories/$INV_ID/items/$ITEM_ID → 404
```

*Restore: create a new item $ITEM_ID2 for subsequent tests.*

#### I10 — Add batch with positive quantity

```
Request: POST /inventories/$INV_ID/items/$ITEM_ID2/batches
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "quantity": 2.0, "notes": "bought at Costco" }
Expected: 201
  Response: { "data": { "id": $BATCH_ID1, "item_id": "$ITEM_ID2", "quantity": 2, "emptied_at": null, ... } }
```

#### I11 — Add batch with quantity ≤ 0

```
Request: POST /inventories/$INV_ID/items/$ITEM_ID2/batches
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "quantity": 0 }
Expected: 400
  Response: { "error": <non-empty string> }
```

#### I12 — List active batches

```
Preconditions: $BATCH_ID1 exists and is not emptied
Request: GET /inventories/$INV_ID/items/$ITEM_ID2/batches
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ { "id": "$BATCH_ID1", "quantity": 2, "emptied_at": null, ... } ] }
```

#### I13 — Mark batch emptied

```
Request: POST /inventories/$INV_ID/items/$ITEM_ID2/batches/$BATCH_ID1/empty
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": { "status": "emptied" } } (or similar)
Follow-up: GET /inventories/$INV_ID/items/$ITEM_ID2/batches
  Assert: $BATCH_ID1 NOT present in the active list
```

#### I14 — Get effective quantity

```
Preconditions: Item has two non-emptied batches: qty=2.0 ($BATCH_A) and qty=1.5 ($BATCH_B); a third emptied batch ($BATCH_C qty=5.0)
Request: GET /inventories/$INV_ID/items/$ITEM_MULTI_ID/quantity
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": { "quantity": 3.5 } }
  Assert: emptied batch ($BATCH_C) not counted
```

---

### 3.4 Grocery Lists

*Setup: reuse $TOKEN_H, $HOUSEHOLD_ID, $INV_ID; create item $ITEM_G with target_quantity=5; add batch with qty=2 (shortfall of 3).*

#### G01 — Create grocery list

```
Request: POST /inventories/$INV_ID/lists
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Weekly Shopping" }
Expected: 201
  Response: { "data": { "id": $LIST_ID, "inventory_id": "$INV_ID", "name": "Weekly Shopping", "status": "active", ... } }
```

#### G02 — List grocery lists

```
Request: GET /inventories/$INV_ID/lists
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ { "id": "$LIST_ID", "name": "Weekly Shopping", ... } ] }
```

#### G03 — Add item with inventory link

```
Request: POST /inventories/$INV_ID/lists/$LIST_ID/items
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "inventory_item_id": "$ITEM_G", "name": "Rice", "quantity": 3.0, "unit": "kg", "sort_order": 1 }
Expected: 201
  Response: { "data": { "id": $GITEM_ID, "inventory_item_id": "$ITEM_G", "name": "Rice", "quantity": 3, "status": "pending", ... } }
```

#### G04 — Add manual item (no inventory link)

```
Request: POST /inventories/$INV_ID/lists/$LIST_ID/items
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Olive Oil", "quantity": 1.0, "unit": "bottle", "sort_order": 2 }
Expected: 201
  Response: { "data": { "inventory_item_id": null, "name": "Olive Oil", "quantity": 1, "status": "pending", ... } }
```

#### G05 — Update item status to bought

```
Request: PUT /inventories/$INV_ID/lists/$LIST_ID/items/$GITEM_ID/status
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "status": "bought" }
Expected: 200
  Response: { "data": { "status": "bought", ... } }
```

#### G06 — Update item status with invalid value

```
Request: PUT /inventories/$INV_ID/lists/$LIST_ID/items/$GITEM_ID/status
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "status": "consumed" }
Expected: 400
  Response: { "error": <non-empty string> }
```

#### G07 — Reorder item

```
Request: PUT /inventories/$INV_ID/lists/$LIST_ID/items/$GITEM_ID/order
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "sort_order": 10 }
Expected: 200
  Response: { "data": { "sort_order": 10 } }
```

#### G08 — Delete item from list

```
Preconditions: A disposable grocery list item $GITEM_DEL_ID exists
Request: DELETE /inventories/$INV_ID/lists/$LIST_ID/items/$GITEM_DEL_ID
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 204
  Response: (empty body)
```

#### G09 — Auto-generate list from inventory shortfalls

```
Preconditions: $ITEM_G has target_quantity=5, one active batch with qty=2 (shortfall=3)
Request: POST /inventories/$INV_ID/lists/auto-generate
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: {}
Expected: 201
  Response: { "data": { "id": $AUTO_LIST_ID, "name": "Auto-generated <YYYY-MM-DD>", "status": "active", ... } }
Follow-up: GET /inventories/$INV_ID/lists/$AUTO_LIST_ID/items
  Assert: one item with name matching $ITEM_G's name and quantity=3
```

#### G10 — Auto-generate with no shortfalls

```
Preconditions: All items in $INV_ID have effective_quantity >= target_quantity
Request: POST /inventories/$INV_ID/lists/auto-generate
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: {}
Expected: 201
Follow-up: GET /inventories/$INV_ID/lists/$EMPTY_AUTO_ID/items
  Assert: empty array returned (no shortfall items)
```

#### G11 — Complete list

```
Request: POST /inventories/$INV_ID/lists/$LIST_ID/complete
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": { "status": "completed", "completed_at": <timestamp>, ... } }
```

#### G12 — Archive list

```
Preconditions: A list $LIST_ARCH_ID with status=active
Request: POST /inventories/$INV_ID/lists/$LIST_ARCH_ID/archive
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": { "status": "archived" } }
```

---

### 3.5 Receipt Scanning

*Note: Receipt scanning requires the OCR and LLM adapters to be running. In a local dev setup these are stub adapters; R04 and R05 may return pending or minimal parsed data depending on stub behavior. Focus on HTTP status codes and state transitions.*

*Fixture: a valid JPEG < 10 MB at `docs/fixtures/sample_receipt.jpg`.*

#### R01 — Upload valid receipt image

```
Request: POST /receipts
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: multipart/form-data
    image: <file: sample_receipt.jpg>
Expected: 201
  Response: { "data": { "id": $SCAN_ID, "status": "pending_processing", ... } }
```

#### R02 — Upload file exceeding 10 MB

```
Request: POST /receipts
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: multipart/form-data
    image: <file: large_file_11mb.jpg>
Expected: 400
  Response: { "error": <non-empty string> }
```

#### R03 — List receipt scans

```
Request: GET /receipts
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ { "id": "$SCAN_ID", "status": "pending_processing" or "pending_review", ... } ] }
```

#### R04 — Scan status transitions to pending_review

```
Preconditions: R01 completed; background OCR/LLM job has run
Request: GET /receipts/$SCAN_ID
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": { "status": "pending_review", ... } }
  (Poll up to 30 seconds if background job is async)
```

#### R05 — Get scan items

```
Preconditions: R04 completed (scan in pending_review)
Request: GET /receipts/$SCAN_ID/items
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ { "id": $SITEM_ACCEPT, "raw_text": <str>, "status": "pending", ... },
                        { "id": $SITEM_REJECT, ... },
                        { "id": $SITEM_CORRECT, ... } ] }
  Assert: at least one item returned; all items have status "pending"
```

#### R06 — Accept scan item

```
Request: PUT /receipts/$SCAN_ID/items/$SITEM_ACCEPT
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "status": "accepted" }
Expected: 200
  Response: { "data": { "id": "$SITEM_ACCEPT", "status": "accepted", ... } }
```

#### R07 — Reject scan item

```
Request: PUT /receipts/$SCAN_ID/items/$SITEM_REJECT
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "status": "rejected" }
Expected: 200
  Response: { "data": { "status": "rejected", ... } }
```

#### R08 — Correct scan item

```
Request: PUT /receipts/$SCAN_ID/items/$SITEM_CORRECT
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: {
    "status": "corrected",
    "corrected_name": "Organic Milk",
    "corrected_quantity": 2.0,
    "corrected_price_minor": 499,
    "corrected_currency": "USD"
  }
Expected: 200
  Response: { "data": { "status": "corrected", "corrected_name": "Organic Milk", "corrected_quantity": 2, ... } }
```

#### R09 — Commit scan

```
Preconditions: R06–R08 completed; $SITEM_ACCEPT accepted, $SITEM_REJECT rejected, $SITEM_CORRECT corrected
Request: POST /receipts/$SCAN_ID/commit
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "purchased_at": "<current UTC timestamp>" }
Expected: 200
  Response: { "data": { "status": "committed", ... } }
Follow-up: GET /catalog/transactions
  Assert: transactions exist for $SITEM_ACCEPT and $SITEM_CORRECT
  Assert: NO transaction for $SITEM_REJECT
```

---

### 3.6 Catalog

#### C01 — Create store

```
Request: POST /catalog/stores
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Whole Foods Market", "chain_name": "Whole Foods", "address": "123 Main St" }
Expected: 201
  Response: { "data": { "id": $STORE_ID, "name": "Whole Foods Market", ... } }
```

#### C02 — List stores

```
Request: GET /catalog/stores
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ { "id": "$STORE_ID", ... } ] }
```

#### C03 — Create private catalog entry

```
Request: POST /catalog/entries
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Jasmine Rice 5lb", "brand": "Golden Star", "unit": "bag", "category": "Grains", "scope": "private" }
Expected: 201
  Response: { "data": { "id": $ENTRY_PRIV, "scope": "private", "household_id": "$HOUSEHOLD_ID", ... } }
```

#### C04 — Create public catalog entry

```
Request: POST /catalog/entries
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "name": "Table Salt 1kg", "unit": "kg", "scope": "public" }
Expected: 201
  Response: { "data": { "id": $ENTRY_PUB, "scope": "public", "household_id": null, ... } }
```

#### C05 — List catalog entries

```
Request: GET /catalog/entries
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Assert: $ENTRY_PRIV present (household private)
  Assert: $ENTRY_PUB present (public)
```

#### C06 — List transactions and filter by catalog entry

```
Preconditions: R09 completed (at least one transaction exists)
Request: GET /catalog/transactions
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ ... ] }
  Assert: array length ≥ 2 (from R09 commit)

Filter: GET /catalog/transactions?catalog_entry_id=$ENTRY_PRIV
Expected: 200
  Assert: all returned transactions have catalog_entry_id = $ENTRY_PRIV (or empty array if none linked)
```

---

### 3.7 Settings

#### S01 — Upsert household setting

```
Request: PUT /settings/household/theme
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "value": "dark" }
Expected: 200
  Response: { "data": { "key": "theme", "value": "dark", "updated_at": <timestamp> } }
```

#### S02 — Get household setting

```
Request: GET /settings/household/theme
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": { "key": "theme", "value": "dark", ... } }
```

#### S03 — Get non-existent household setting

```
Request: GET /settings/household/nonexistent_key
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 404
  Response: { "error": <non-empty string> }
```

#### S04 — Upsert user setting

```
Request: PUT /settings/user/language
  Headers: Authorization: Bearer $TOKEN_H
  Body: { "value": "pt-BR" }
Expected: 200
  Response: { "data": { "key": "language", "value": "pt-BR", ... } }
```

#### S05 — Get user setting

```
Request: GET /settings/user/language
  Headers: Authorization: Bearer $TOKEN_H
Expected: 200
  Response: { "data": { "key": "language", "value": "pt-BR", ... } }
```

#### S06 — Create LLM provider

```
Request: POST /settings/providers/llm
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "provider": "ollama", "model": "llama3", "endpoint_url": "http://localhost:11434", "is_default": true }
Expected: 201
  Response: { "data": { "id": $LLM_ID, "provider": "ollama", "model": "llama3", "has_api_key": false, "is_default": true, ... } }
  Assert: no api_key field in response
```

#### S07 — List LLM providers

```
Request: GET /settings/providers/llm
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
Expected: 200
  Response: { "data": [ { "id": "$LLM_ID", "provider": "ollama", ... } ] }
```

#### S08 — Create and list OCR provider

```
Request: POST /settings/providers/ocr
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  Body: { "provider": "tesseract", "is_default": true }
Expected: 201
  Response: { "data": { "id": $OCR_ID, "provider": "tesseract", "is_default": true, ... } }

Follow-up: GET /settings/providers/ocr
  Assert: $OCR_ID present in array
```

---

### 3.8 Authorization & Scoping

#### Z01 — Cross-household inventory access is forbidden

```
Preconditions: Second user (user-z@example.com) logged in with $TOKEN_Z; owns $HH_Z with inventory $INV_Z
Request: GET /inventories/$INV_Z
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HOUSEHOLD_ID
  (TOKEN_H belongs to a different household than INV_Z)
Expected: 403 or 404
  Response: { "error": <non-empty string> }
```

#### Z02 — Missing X-Household-ID falls back to user's first household

```
Preconditions: $TOKEN_H; user has only $HOUSEHOLD_ID as their household
Request: GET /inventories
  Headers: Authorization: Bearer $TOKEN_H
  (No X-Household-ID header)
Expected: 200
  Assert: same result as with X-Household-ID: $HOUSEHOLD_ID
```

#### Z03 — X-Household-ID for non-member household returns 403

```
Preconditions: $HH_Z from Z01 (user-h is not a member)
Request: GET /inventories
  Headers: Authorization: Bearer $TOKEN_H, X-Household-ID: $HH_Z
Expected: 403
  Response: { "error": "forbidden" }
```

#### Z04 — Unauthenticated access to protected route

```
Request: GET /inventories
  (No Authorization header)
Expected: 401
  Response: { "error": <non-empty string> }
```

#### Z05 — Share link password enforcement

```
Preconditions: $SHARE_TOKEN_PW created in H08 with password "secret123"
Request: GET /share/$SHARE_TOKEN_PW/inventory
  Headers: X-Share-Password: wrongpassword
Expected: 401

Request: GET /share/$SHARE_TOKEN_PW/inventory
  Headers: X-Share-Password: secret123
Expected: 200
  Response: { "data": { "inventory_id": "$INV_ID", "items": [ ... ] } }
```

---

## 4. Web E2E Flows (Playwright)

All flows run in a Chromium browser against `http://localhost:5173` backed by the live Go server at `http://localhost:8080`.

**Global setup** (`playwright.config.ts` globalSetup):
1. Register a test user via API: email `e2e-user@baskety.test`, password `E2eP@ss123`
2. Login; capture token
3. Create a household; capture household ID
4. Store credentials in a shared fixture file for tests to consume

---

### F01 — New User Registration & Login

```
Steps:
  1. Navigate to http://localhost:5173/register
  2. Fill "Name": "E2E Tester"
  3. Fill "Email": "e2e-register@baskety.test"
  4. Fill "Password": "TestPass123!"
  5. Click "Register"

Assert:
  - URL changes to /inventory or / (dashboard)
  - No error toast visible

  6. Click "Logout" (or navigate to logout action)

Assert:
  - URL changes to /login or /

  7. Navigate to /login
  8. Fill email + password from step 3–4
  9. Click "Login"

Assert:
  - URL changes to authenticated area
  - No error messages visible
```

### F02 — Household + Inventory Setup

```
Preconditions: Logged in as e2e-user@baskety.test

Steps:
  1. If no household exists, navigate to household creation UI and create "Test Home"
  2. Navigate to /inventory
  3. Click "New Inventory" (or equivalent CTA)
  4. Fill name: "F02 Pantry"; submit
  5. Click into the new inventory
  6. Add item: name="Rice", category="Grains", unit="kg", target_quantity=5
  7. Add item: name="Pasta", category="Grains", unit="pack", target_quantity=3
  8. Add item: name="Olive Oil", category="Condiments", unit="bottle", target_quantity=2
  9. For "Rice": click "Add Batch"; fill quantity=2; save
  10. For "Pasta": click "Add Batch"; fill quantity=3; save
  11. For "Olive Oil": click "Add Batch"; fill quantity=2; save

Assert:
  - All 3 items visible in inventory list
  - "Rice" shows effective quantity 2 (< target 5)
  - "Pasta" shows effective quantity 3 (= target 3, no shortfall)
  - "Olive Oil" shows effective quantity 2 (= target 2, no shortfall)
```

### F03 — Auto-Generate Grocery List

```
Preconditions: F02 completed; "Rice" has qty=2 vs target=5 (shortfall=3)

Steps:
  1. Navigate to /grocery
  2. Click "Auto-generate" (select the F02 Pantry inventory)

Assert:
  - New list created with name matching "Auto-generated YYYY-MM-DD"
  - List contains item "Rice" with quantity 3
  - List does NOT contain "Pasta" or "Olive Oil" (no shortfall)

  3. Click into the generated list
  4. Click "Add item"; fill name="Butter", quantity=1, unit="block"
  5. Save

Assert:
  - "Butter" appears in the list alongside "Rice"
  - Both items have status "pending"
```

### F04 — Shopping Trip Simulation

```
Preconditions: F03 completed; generated list with "Rice" (qty 3) and "Butter" (qty 1)

Steps:
  1. Navigate to /grocery and open the auto-generated list
  2. Check off "Rice" → mark as "bought"
  3. Check off "Butter" → mark as "bought"

Assert:
  - Both items show "bought" status (checked off / strikethrough)

  4. Click "Complete List"

Assert:
  - List status shows "completed"
  - Completed timestamp visible
  - List appears in completed state on /grocery listing
```

### F05 — Receipt Review Workflow

```
Preconditions: Logged in; household exists; an inventory exists; OCR/LLM adapter running (or stub returns parseable items)

Steps:
  1. Navigate to /receipt
  2. Click "Upload Receipt" or equivalent
  3. Select file: docs/fixtures/sample_receipt.jpg
  4. Submit upload

Assert:
  - New scan appears in list with status "pending_processing" or "pending_review"

  5. Navigate to the scan detail / review page
  6. Wait for status to become "pending_review" (poll up to 30 seconds)

Assert:
  - At least one parsed item shown with confidence score

  7. Click "Accept" on the first item
  8. Click "Reject" on the second item (if present)
  9. Click "Edit" on the third item (if present); change name to "Corrected Item"; save

Assert:
  - First item shows status "accepted"
  - Second item shows status "rejected"
  - Third item shows status "corrected" and updated name

  10. Click "Commit Receipt"; confirm purchased date

Assert:
  - Scan status changes to "committed"
  - Navigate to /catalog (or reports page with transactions)
  - At least one transaction visible corresponding to accepted/corrected items
```

### F06 — Shared Inventory View

```
Preconditions: F02 completed; "F02 Pantry" inventory populated

Steps:
  1. Navigate to /settings or household management UI
  2. Create a share link for "F02 Pantry" (no password)
  3. Capture the share URL or token

Assert:
  - Share link token displayed or copyable

  4. Open a new incognito browser context (no auth cookies)
  5. Navigate to /share/<token>

Assert:
  - Inventory items visible (Rice, Pasta, Olive Oil)
  - No "Add", "Edit", or "Delete" controls visible
  - No login prompt required

  6. Return to authenticated context
  7. Create a second share link with password "sharepass"
  8. In incognito: navigate to /share/<token2>

Assert:
  - Password prompt displayed

  9. Enter wrong password

Assert:
  - Access denied message

  10. Enter correct password "sharepass"

Assert:
  - Inventory visible
```

---

## 5. Current Coverage Matrix

| Domain | Go unit tests | Go handler tests | Go integration tests | Web component tests | API tests (this doc) | E2E flows (this doc) |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Auth | ✅ | ✅ | ✅ | ✅ | A01–A07 | F01 |
| Household | ✅ | ✅ | ✅ | — | H01–H10 | F02, F06 |
| Inventory | ✅ | ✅ | ✅ | ✅ | I01–I14 | F02, F03 |
| Grocery | ✅ | ✅ | ✅ | ✅ | G01–G12 | F03, F04 |
| Receipt | ✅ | ❌ gap | ✅ | ✅ | R01–R09 | F05 |
| Catalog | ✅ | ❌ gap | ✅ | — | C01–C06 | F05 |
| Settings | ✅ | ❌ gap | ❌ gap | — | S01–S08 | — |
| Share (public) | — | — | — | — | H09, H10, Z05 | F06 |
| Auth/Scoping | — | — | — | — | Z01–Z05 | — |

**Backend gaps identified (not covered by existing automated tests):**
- Receipt handler tests missing (`baskety/internal/receipt/handler_test.go`)
- Catalog handler tests missing (`baskety/internal/catalog/handler_test.go`)
- Settings handler tests missing (`baskety/internal/settings/handler_test.go`)
- Settings integration tests missing (`baskety/internal/settings/repository_integration_test.go`)

**Web frontend gaps (not covered by existing component tests):**
- `/reports` page
- `/settings` page
- `/share/:token` page

---

## 6. Mobile Functional Tests (Sprint 13 — Manual Checklist)

Sprint 16 (automated mobile testing + EAS build) is not yet implemented. These are manual tests to run on a device or Expo Go simulator.

**Setup:** Start Expo dev server: `pnpm --filter @baskety/mobile start`. Open Expo Go on device/simulator.

| ID | Test | Steps | Pass Criteria |
|----|------|-------|---------------|
| M01 | First launch shows onboarding | Fresh install (or clear AsyncStorage); open app | Onboarding screen shown, not login screen |
| M02 | Server URL connectivity check | Enter `http://localhost:8080` in server URL field; tap "Check" | Green status / "Connected" indicator |
| M03 | Connectivity check failure | Enter `http://localhost:9999` (no service); tap "Check" | Error indicator (cannot connect) |
| M04 | Home network profile switching | Configure home SSID; toggle WiFi on/off | Server URL auto-switches between home and external URL |
| M05 | Register new user | Tap through to register screen; fill name/email/password; submit | Success state; navigated to home screen; token persisted in AsyncStorage |
| M06 | Login with valid credentials | On login screen; enter valid credentials; submit | Navigated to home screen |
| M07 | Login with invalid credentials | On login screen; enter wrong password; submit | Error message displayed; remains on login screen |

---

## 7. Test Fixtures & Data

### 7.1 Receipt Image Fixture

Place a small (< 5 MB) JPEG of a grocery receipt at:

```
docs/fixtures/sample_receipt.jpg
```

A generated placeholder or a real store receipt photo both work. The file is used by R01, R02 (need a separate >10 MB file), and F05.

For the >10 MB test (R02), generate a large file:

```bash
dd if=/dev/urandom of=docs/fixtures/large_file_11mb.jpg bs=1M count=11
```

### 7.2 E2E Global Setup (Playwright)

`apps/web/e2e/global-setup.ts` (to be created):

```typescript
import { request } from '@playwright/test';

export default async function globalSetup() {
  const api = await request.newContext({ baseURL: 'http://localhost:8080/api/v1' });
  await api.post('/auth/register', {
    data: { email: 'e2e-user@baskety.test', name: 'E2E User', password: 'E2eP@ss123' },
  });
  const loginRes = await api.post('/auth/login', {
    data: { email: 'e2e-user@baskety.test', password: 'E2eP@ss123' },
  });
  const { token } = (await loginRes.json()).data;
  const hhRes = await api.post('/households', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'E2E Household' },
  });
  const { id: householdId } = (await hhRes.json()).data;
  process.env.E2E_TOKEN = token;
  process.env.E2E_HOUSEHOLD_ID = householdId;
  await api.dispose();
}
```

### 7.3 Seed API Calls for API Tests (curl)

A shell script `docs/fixtures/seed.sh` creates the minimal test state:

```bash
#!/usr/bin/env bash
BASE="http://localhost:8080/api/v1"

# Register
curl -sf -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"seed@baskety.test","name":"Seed User","password":"seed1234"}'

# Login
TOKEN=$(curl -sf -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"seed@baskety.test","password":"seed1234"}' | jq -r '.data.token')

echo "TOKEN=$TOKEN"

# Create household
HH=$(curl -sf -X POST $BASE/households \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Seed Household"}' | jq -r '.data.id')
echo "HOUSEHOLD_ID=$HH"
```

---

## 8. CI Integration Notes

### 8.1 Backend Unit + Integration Tests (existing)

```bash
cd baskety && go test ./...
```

Testcontainers-go spins up PostgreSQL automatically. No external services required. Runs in ~60 seconds.

### 8.2 Web Unit Tests (existing)

```bash
pnpm --filter @baskety/web test --run
```

Runs with Vitest + MSW. No backend required. Runs in ~10 seconds.

### 8.3 API Functional Tests (new — this plan)

Requires: Docker Compose Postgres + Go server running.

Recommended CI step (GitHub Actions):

```yaml
- name: Start test stack
  run: |
    docker compose -f compose.dev.yml up -d
    cd baskety && go run ./cmd/baskety serve &
    sleep 5 && curl --retry 5 --retry-delay 1 http://localhost:8080/healthz

- name: Run API tests (Playwright request-only)
  run: pnpm exec playwright test --project=api
```

API tests are Playwright tests with `use: { baseURL: 'http://localhost:8080' }` and no browser launch (`request` fixture only).

### 8.4 Web E2E Tests (new — this plan)

Requires: full stack (Compose + backend + Vite dev server).

```yaml
- name: Start Vite dev server
  run: pnpm --filter @baskety/web dev &

- name: Run E2E tests
  run: pnpm exec playwright test --project=chromium
```

### 8.5 Suggested `playwright.config.ts` Projects

```typescript
export default defineConfig({
  projects: [
    { name: 'api', testMatch: '**/api/**/*.spec.ts', use: { baseURL: 'http://localhost:8080' } },
    { name: 'chromium', testMatch: '**/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: { command: 'pnpm --filter @baskety/web dev', url: 'http://localhost:5173', reuseExistingServer: true },
  globalSetup: './apps/web/e2e/global-setup.ts',
});
```

---

*End of test plan. Total: 71 API test cases · 6 E2E flows · 7 mobile manual checks = 84 functional test cases.*
