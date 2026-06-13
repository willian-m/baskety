// Auth
export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface AuthResponse {
  token: string;
  expires_at: string | null;
}

// Users
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

// Households
export interface HouseholdResponse {
  id: string;
  name: string;
  created_at: string;
}
export interface MemberResponse {
  user_id: string;
  role: string;
  joined_at: string;
}
export interface CreateHouseholdRequest {
  name: string;
}
export interface ShareLinkResponse {
  id: string;
  token: string;
  expires_at: string | null;
  created_at: string;
}

// Inventory
export interface InventoryResponse {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export interface InventoryItemResponse {
  id: string;
  inventory_id: string;
  name: string;
  category: string;
  unit: string;
  target_quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stored_quantity: number;
  batch_count: number;
}
export interface BatchResponse {
  id: string;
  item_id: string;
  quantity: number;
  expires_at: string | null;
  added_at: string;
  emptied_at: string | null;
  notes: string | null;
  created_at: string;
}

// Grocery list
export interface GroceryListResponse {
  id: string;
  inventory_id: string;
  name: string;
  status: string;
  created_by_user_id: string;
  completed_at: string | null;
  pinned_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface GroceryItemResponse {
  id: string;
  grocery_list_id: string;
  inventory_item_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  notes: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Receipt
export interface ScanResponse {
  id: string;
  household_id: string;
  grocery_list_id: string | null;
  raw_image_path: string;
  ocr_text: string | null;
  llm_raw_response: string | null;
  status: string;
  error_message: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}
export interface ScanItemResponse {
  id: string;
  receipt_scan_id: string;
  raw_text: string;
  parsed_name: string | null;
  parsed_brand: string | null;
  parsed_quantity: number | null;
  parsed_unit: string | null;
  parsed_price_minor: number | null;
  parsed_currency: string | null;
  parsed_store_name: string | null;
  confidence_score: number | null;
  status: string;
  inventory_item_id: string | null;
  corrected_name: string | null;
  corrected_brand: string | null;
  corrected_quantity: number | null;
  corrected_price_minor: number | null;
  corrected_currency: string | null;
  corrected_store_name: string | null;
  created_at: string;
  updated_at: string;
}

// Catalog
export interface StoreResponse {
  id: string;
  name: string;
  chain_name: string | null;
  address: string | null;
  canonical_store_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface CatalogEntryResponse {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  category: string | null;
  scope: string;
  household_id: string | null;
  canonical_entry_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface TransactionResponse {
  id: string;
  household_id: string;
  store_id: string | null;
  grocery_list_item_id: string | null;
  receipt_scan_item_id: string | null;
  catalog_entry_id: string | null;
  price_per_unit_minor: number | null;
  currency: string;
  quantity: number | null;
  purchased_at: string;
  created_at: string;
}

// Settings
export interface SettingResponse {
  key: string;
  value: string;
  updated_at: string;
}
export interface LLMProviderResponse {
  id: string;
  household_id: string | null;
  provider: string;
  model: string;
  endpoint_url: string | null;
  has_api_key: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
export interface OCRProviderResponse {
  id: string;
  household_id: string | null;
  provider: string;
  endpoint_url: string | null;
  has_api_key: boolean;
  extra_config: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Share
export interface ShareInventoryResponse {
  inventory_id: string;
  items: InventoryItemResponse[];
}

// Error
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // forward-looking: backend currently returns only {error: string}
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
