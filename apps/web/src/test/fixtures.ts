let idCounter = 0;
const nextId = () => `00000000-0000-0000-0000-${String(++idCounter).padStart(12, "0")}`;
const now = () => new Date().toISOString();

export const authFixture = (overrides?: Partial<{ token: string; expires_at: string | null }>) => ({
  token: "test-token",
  expires_at: null,
  ...overrides,
});

export const householdFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  name: "Test Household",
  created_at: now(),
  ...overrides,
});

export const memberFixture = (overrides?: Record<string, unknown>) => ({
  user_id: nextId(),
  role: "member",
  joined_at: now(),
  ...overrides,
});

export const shareLinkFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  token: "share-token",
  expires_at: null,
  created_at: now(),
  ...overrides,
});

export const inventoryFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  household_id: nextId(),
  name: "Test Inventory",
  description: null,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const inventoryItemFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  inventory_id: nextId(),
  name: "Test Item",
  category: "Food",
  unit: "kg",
  target_quantity: 2,
  notes: null,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const batchFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  item_id: nextId(),
  quantity: 1,
  expires_at: null,
  added_at: now(),
  emptied_at: null,
  notes: null,
  created_at: now(),
  ...overrides,
});

export const groceryListFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  inventory_id: nextId(),
  name: "Test List",
  status: "active",
  created_by_user_id: nextId(),
  completed_at: null,
  pinned_at: null,
  expires_at: null,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const groceryItemFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  grocery_list_id: nextId(),
  inventory_item_id: null,
  name: "Test Grocery Item",
  quantity: 1,
  unit: "pcs",
  notes: null,
  status: "pending",
  sort_order: 0,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const scanFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  household_id: nextId(),
  grocery_list_id: null,
  raw_image_path: "/tmp/test.jpg",
  ocr_text: null,
  llm_raw_response: null,
  status: "pending",
  error_message: null,
  created_by_user_id: nextId(),
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const scanItemFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  receipt_scan_id: nextId(),
  raw_text: "Milk 2L",
  parsed_name: "Milk",
  parsed_brand: null,
  parsed_quantity: 2,
  parsed_unit: "L",
  parsed_price_minor: 299,
  parsed_currency: "USD",
  parsed_store_name: null,
  confidence_score: 0.9,
  status: "pending",
  inventory_item_id: null,
  corrected_name: null,
  corrected_brand: null,
  corrected_quantity: null,
  corrected_price_minor: null,
  corrected_currency: null,
  corrected_store_name: null,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const llmProviderFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  household_id: null,
  provider: "openai",
  model: "gpt-4o-mini",
  endpoint_url: null,
  has_api_key: false,
  is_default: true,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const ocrProviderFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  household_id: null,
  provider: "tesseract",
  endpoint_url: null,
  has_api_key: false,
  extra_config: null,
  is_default: true,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const storeFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  name: "Test Store",
  chain_name: null,
  address: null,
  canonical_store_id: null,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const catalogEntryFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  name: "Test Product",
  brand: null,
  unit: null,
  category: null,
  scope: "global",
  household_id: null,
  canonical_entry_id: null,
  created_at: now(),
  updated_at: now(),
  ...overrides,
});

export const transactionFixture = (overrides?: Record<string, unknown>) => ({
  id: nextId(),
  household_id: nextId(),
  store_id: null,
  grocery_list_item_id: null,
  receipt_scan_item_id: null,
  catalog_entry_id: null,
  price_per_unit_minor: null,
  currency: "USD",
  quantity: null,
  purchased_at: now(),
  ...overrides,
});
