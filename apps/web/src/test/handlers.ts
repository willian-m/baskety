import { http, HttpResponse } from "msw";

import {
  authFixture,
  batchFixture,
  catalogEntryFixture,
  groceryItemFixture,
  groceryListFixture,
  householdFixture,
  inventoryFixture,
  inventoryItemFixture,
  llmProviderFixture,
  memberFixture,
  ocrProviderFixture,
  scanFixture,
  scanItemFixture,
  shareLinkFixture,
  storeFixture,
  transactionFixture,
} from "./fixtures.js";

const BASE = "/api/v1";
const ok = (data: unknown) => HttpResponse.json({ data });

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/register`, () => ok(authFixture())),
  http.post(`${BASE}/auth/login`, () => ok(authFixture())),
  http.delete(`${BASE}/auth/session`, () => new HttpResponse(null, { status: 204 })),

  // Households
  http.get(`${BASE}/households`, () => ok([householdFixture()])),
  http.post(`${BASE}/households`, () => ok(householdFixture())),
  http.get(`${BASE}/households/:id`, ({ params }) => ok(householdFixture({ id: params.id }))),
  http.post(`${BASE}/households/:id/members`, () => ok(memberFixture())),
  http.delete(
    `${BASE}/households/:id/members/:userId`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(`${BASE}/households/:id/share-links`, () => ok(shareLinkFixture())),

  // Inventories
  http.get(`${BASE}/inventories`, () => ok([inventoryFixture({ id: "inv-1" })])),
  http.post(`${BASE}/inventories`, () => ok(inventoryFixture())),
  http.get(`${BASE}/inventories/:id`, ({ params }) => ok(inventoryFixture({ id: params.id }))),
  http.put(`${BASE}/inventories/:id`, ({ params }) => ok(inventoryFixture({ id: params.id }))),
  http.delete(`${BASE}/inventories/:id`, () => new HttpResponse(null, { status: 204 })),

  // Inventory items
  http.get(`${BASE}/inventories/:id/items`, () => ok([inventoryItemFixture()])),
  http.post(`${BASE}/inventories/:id/items`, () => ok(inventoryItemFixture())),
  http.get(`${BASE}/inventories/:invId/items/:itemId`, ({ params }) =>
    ok(inventoryItemFixture({ id: params.itemId })),
  ),
  http.put(`${BASE}/inventories/:invId/items/:itemId`, ({ params }) =>
    ok(inventoryItemFixture({ id: params.itemId })),
  ),
  http.delete(
    `${BASE}/inventories/:invId/items/:itemId`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get(`${BASE}/inventories/:invId/items/:itemId/quantity`, () =>
    HttpResponse.json({ quantity: 0 }),
  ),

  // Batches
  http.get(`${BASE}/inventories/:invId/items/:itemId/batches`, () => ok([])),
  http.post(`${BASE}/inventories/:invId/items/:itemId/batches`, () => ok(batchFixture())),
  http.post(
    `${BASE}/inventories/:invId/items/:itemId/batches/:batchId/empty`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Grocery lists
  http.get(`${BASE}/inventories/:id/lists`, () => ok([groceryListFixture()])),
  http.post(`${BASE}/inventories/:id/lists`, () => ok(groceryListFixture())),
  http.post(`${BASE}/inventories/:id/lists/auto-generate`, () => ok(groceryListFixture())),
  http.get(`${BASE}/inventories/:invId/lists/:listId`, ({ params }) =>
    ok(groceryListFixture({ id: params.listId })),
  ),
  http.post(
    `${BASE}/inventories/:invId/lists/:listId/complete`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(
    `${BASE}/inventories/:invId/lists/:listId/archive`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get(`${BASE}/inventories/:invId/lists/:listId/items`, () => ok([groceryItemFixture()])),
  http.post(`${BASE}/inventories/:invId/lists/:listId/items`, () => ok(groceryItemFixture())),
  http.put(`${BASE}/inventories/:invId/lists/:listId/items/:itemId/status`, ({ params }) =>
    ok(groceryItemFixture({ id: params.itemId })),
  ),
  http.put(`${BASE}/inventories/:invId/lists/:listId/items/:itemId/order`, ({ params }) =>
    ok(groceryItemFixture({ id: params.itemId })),
  ),
  http.delete(
    `${BASE}/inventories/:invId/lists/:listId/items/:itemId`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Receipts
  http.get(`${BASE}/receipts`, () => ok([scanFixture()])),
  http.post(`${BASE}/receipts`, () => ok(scanFixture())),
  http.get(`${BASE}/receipts/:id`, ({ params }) => ok(scanFixture({ id: params.id }))),
  http.get(`${BASE}/receipts/:id/items`, () => ok([scanItemFixture()])),
  http.put(`${BASE}/receipts/:scanId/items/:itemId`, ({ params }) =>
    ok(scanItemFixture({ id: params.itemId })),
  ),
  http.post(`${BASE}/receipts/:id/commit`, () => new HttpResponse(null, { status: 204 })),

  // Settings
  http.get(`${BASE}/settings/providers/llm`, () => ok([llmProviderFixture()])),
  http.post(`${BASE}/settings/providers/llm`, () => ok(llmProviderFixture())),
  http.get(`${BASE}/settings/providers/ocr`, () => ok([ocrProviderFixture()])),
  http.post(`${BASE}/settings/providers/ocr`, () => ok(ocrProviderFixture())),
  http.get(`${BASE}/settings/household/:key`, ({ params }) =>
    ok({ key: params.key, value: "value", updated_at: new Date().toISOString() }),
  ),
  http.put(`${BASE}/settings/household/:key`, ({ params }) =>
    ok({ key: params.key, value: "value", updated_at: new Date().toISOString() }),
  ),
  http.get(`${BASE}/settings/user/:key`, ({ params }) =>
    ok({ key: params.key, value: "value", updated_at: new Date().toISOString() }),
  ),
  http.put(`${BASE}/settings/user/:key`, ({ params }) =>
    ok({ key: params.key, value: "value", updated_at: new Date().toISOString() }),
  ),

  // Catalog
  http.get(`${BASE}/catalog/stores`, () => ok([storeFixture()])),
  http.post(`${BASE}/catalog/stores`, () => ok(storeFixture())),
  http.get(`${BASE}/catalog/entries`, () => ok([catalogEntryFixture()])),
  http.post(`${BASE}/catalog/entries`, () => ok(catalogEntryFixture())),
  http.get(`${BASE}/catalog/transactions`, () => ok([transactionFixture()])),

  // Share
  http.get(`/api/v1/share/:token/inventory`, () =>
    ok({ inventory_id: "inv-1", items: [inventoryItemFixture()] }),
  ),
];
