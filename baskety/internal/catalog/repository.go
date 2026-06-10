package catalog

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	// stores
	CreateStore(ctx context.Context, name string, chainName, address *string) (*Store, error)
	GetStore(ctx context.Context, id uuid.UUID) (*Store, error)
	ListStores(ctx context.Context) ([]*Store, error)
	UpsertStore(ctx context.Context, name string, chainName, address *string) (*Store, error)

	// catalog
	CreateCatalogEntry(ctx context.Context, householdID *uuid.UUID, name string, brand, unit, category *string, scope string) (*CatalogEntry, error)
	GetCatalogEntry(ctx context.Context, id uuid.UUID) (*CatalogEntry, error)
	ListCatalogEntries(ctx context.Context, householdID uuid.UUID) ([]*CatalogEntry, error)
	UpsertCatalogEntry(ctx context.Context, householdID *uuid.UUID, name string, brand, unit, category *string, scope string) (*CatalogEntry, error)

	// transactions
	GetPurchaseTransaction(ctx context.Context, id uuid.UUID) (*PurchaseTransaction, error)
	UpdatePurchaseTransactionRefs(ctx context.Context, id uuid.UUID, storeID, catalogEntryID *uuid.UUID) error
	ListTransactionsByHousehold(ctx context.Context, householdID uuid.UUID) ([]*PurchaseTransaction, error)
	ListTransactionsByCatalogEntry(ctx context.Context, catalogEntryID uuid.UUID) ([]*PurchaseTransaction, error)
}
