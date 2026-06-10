package catalog

import (
	"time"

	"github.com/google/uuid"
)

type Store struct {
	ID               uuid.UUID
	Name             string
	ChainName        *string
	Address          *string
	CanonicalStoreID *uuid.UUID
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type CatalogEntry struct {
	ID               uuid.UUID
	Name             string
	Brand            *string
	Unit             *string
	Category         *string
	Scope            string // "public" | "private"
	HouseholdID      *uuid.UUID
	CanonicalEntryID *uuid.UUID
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type PurchaseTransaction struct {
	ID                uuid.UUID
	HouseholdID       uuid.UUID
	StoreID           *uuid.UUID
	GroceryListItemID *uuid.UUID
	ReceiptScanItemID *uuid.UUID
	CatalogEntryID    *uuid.UUID
	PricePerUnitMinor *int64
	Currency          string
	Quantity          *float64
	PurchasedAt       time.Time
	CreatedAt         time.Time
}
