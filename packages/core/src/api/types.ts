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
  user: User;
}

// Users
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

// Households
export interface Household {
  id: string;
  name: string;
  createdAt: string;
}
export interface HouseholdMember {
  userId: string;
  role: string;
  joinedAt: string;
}
export interface CreateHouseholdRequest {
  name: string;
}

// Money
export interface Money {
  amount: number;
  currency: string;
}

// Inventory
export interface InventoryItem {
  id: string;
  householdId: string;
  inventoryId: string;
  name: string;
  category: string | null;
  targetQuantity: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryBatch {
  id: string;
  itemId: string;
  quantity: number;
  expiresAt: string | null;
  purchasedAt: string | null;
  pricePerUnit: Money | null;
  createdAt: string;
}

// Grocery list
export interface GroceryList {
  id: string;
  householdId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export interface GroceryListItem {
  id: string;
  listId: string;
  itemName: string;
  quantity: number;
  unit: string;
  checked: boolean;
  createdAt: string;
}

// Receipt
export interface ReceiptScan {
  id: string;
  householdId: string;
  status: string;
  storeName: string | null;
  purchasedAt: string | null;
  createdAt: string;
}
export interface ReceiptScanItem {
  id: string;
  scanId: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: Money | null;
  brand: string | null;
  confirmed: boolean;
}

// Catalog
export interface Store {
  id: string;
  name: string;
  address: string | null;
}
export interface CatalogEntry {
  id: string;
  itemName: string;
  storeId: string;
  lastPrice: Money | null;
  lastPurchasedAt: string | null;
}

// Settings
export interface ProviderSetting {
  key: string;
  value: string;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Share
export interface ShareInventoryResponse {
  items: InventoryItem[];
}

// Error
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
