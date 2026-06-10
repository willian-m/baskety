package inventory

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	// inventories
	CreateInventory(ctx context.Context, householdID uuid.UUID, name string, description *string) (*Inventory, error)
	GetInventory(ctx context.Context, id uuid.UUID) (*Inventory, error)
	ListInventories(ctx context.Context, householdID uuid.UUID) ([]*Inventory, error)
	UpdateInventory(ctx context.Context, id uuid.UUID, name string, description *string) (*Inventory, error)
	DeleteInventory(ctx context.Context, id uuid.UUID) error

	// items
	CreateItem(ctx context.Context, inventoryID uuid.UUID, name, category, unit string, targetQuantity float64, notes *string) (*InventoryItem, error)
	GetItem(ctx context.Context, id uuid.UUID) (*InventoryItem, error)
	ListItems(ctx context.Context, inventoryID uuid.UUID) ([]*InventoryItem, error)
	UpdateItem(ctx context.Context, id uuid.UUID, name, category, unit string, targetQuantity float64, notes *string) (*InventoryItem, error)
	SoftDeleteItem(ctx context.Context, id uuid.UUID) error
	GetItemQuantity(ctx context.Context, itemID uuid.UUID) (float64, error)

	// batches
	AddBatch(ctx context.Context, itemID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*InventoryBatch, error)
	GetBatch(ctx context.Context, id uuid.UUID) (*InventoryBatch, error)
	ListActiveBatches(ctx context.Context, itemID uuid.UUID) ([]*InventoryBatch, error)
	MarkBatchEmptied(ctx context.Context, id uuid.UUID) error
}
