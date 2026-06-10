package catalog

import "time"

// --- Requests ---

type CreateStoreRequest struct {
	Name      string  `json:"name"`
	ChainName *string `json:"chain_name"`
	Address   *string `json:"address"`
}

type CreateCatalogEntryRequest struct {
	Name     string  `json:"name"`
	Brand    *string `json:"brand"`
	Unit     *string `json:"unit"`
	Category *string `json:"category"`
	Scope    string  `json:"scope"`
}

// --- Responses ---

type StoreResponse struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	ChainName        *string   `json:"chain_name"`
	Address          *string   `json:"address"`
	CanonicalStoreID *string   `json:"canonical_store_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type CatalogEntryResponse struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Brand            *string   `json:"brand"`
	Unit             *string   `json:"unit"`
	Category         *string   `json:"category"`
	Scope            string    `json:"scope"`
	HouseholdID      *string   `json:"household_id"`
	CanonicalEntryID *string   `json:"canonical_entry_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type TransactionResponse struct {
	ID                string    `json:"id"`
	HouseholdID       string    `json:"household_id"`
	StoreID           *string   `json:"store_id"`
	GroceryListItemID *string   `json:"grocery_list_item_id"`
	ReceiptScanItemID *string   `json:"receipt_scan_item_id"`
	CatalogEntryID    *string   `json:"catalog_entry_id"`
	PricePerUnitMinor *int64    `json:"price_per_unit_minor"`
	Currency          string    `json:"currency"`
	Quantity          *float64  `json:"quantity"`
	PurchasedAt       time.Time `json:"purchased_at"`
	CreatedAt         time.Time `json:"created_at"`
}

func toStoreResponse(m *Store) *StoreResponse {
	var canonical *string
	if m.CanonicalStoreID != nil {
		s := m.CanonicalStoreID.String()
		canonical = &s
	}
	return &StoreResponse{
		ID:               m.ID.String(),
		Name:             m.Name,
		ChainName:        m.ChainName,
		Address:          m.Address,
		CanonicalStoreID: canonical,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}

func toCatalogEntryResponse(m *CatalogEntry) *CatalogEntryResponse {
	var hid, canonical *string
	if m.HouseholdID != nil {
		s := m.HouseholdID.String()
		hid = &s
	}
	if m.CanonicalEntryID != nil {
		s := m.CanonicalEntryID.String()
		canonical = &s
	}
	return &CatalogEntryResponse{
		ID:               m.ID.String(),
		Name:             m.Name,
		Brand:            m.Brand,
		Unit:             m.Unit,
		Category:         m.Category,
		Scope:            m.Scope,
		HouseholdID:      hid,
		CanonicalEntryID: canonical,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}

func toTransactionResponse(m *PurchaseTransaction) *TransactionResponse {
	var storeID, gliID, rsiID, catID *string
	if m.StoreID != nil {
		s := m.StoreID.String()
		storeID = &s
	}
	if m.GroceryListItemID != nil {
		s := m.GroceryListItemID.String()
		gliID = &s
	}
	if m.ReceiptScanItemID != nil {
		s := m.ReceiptScanItemID.String()
		rsiID = &s
	}
	if m.CatalogEntryID != nil {
		s := m.CatalogEntryID.String()
		catID = &s
	}
	return &TransactionResponse{
		ID:                m.ID.String(),
		HouseholdID:       m.HouseholdID.String(),
		StoreID:           storeID,
		GroceryListItemID: gliID,
		ReceiptScanItemID: rsiID,
		CatalogEntryID:    catID,
		PricePerUnitMinor: m.PricePerUnitMinor,
		Currency:          m.Currency,
		Quantity:          m.Quantity,
		PurchasedAt:       m.PurchasedAt,
		CreatedAt:         m.CreatedAt,
	}
}
