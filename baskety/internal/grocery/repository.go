package grocery

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	// lists
	CreateList(ctx context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*GroceryList, error)
	GetList(ctx context.Context, id uuid.UUID) (*GroceryList, error)
	ListByInventory(ctx context.Context, inventoryID uuid.UUID) ([]*GroceryList, error)
	UpdateListStatus(ctx context.Context, id uuid.UUID, status string, completedAt *time.Time) (*GroceryList, error)
	ArchiveList(ctx context.Context, id uuid.UUID) error
	RenameList(ctx context.Context, id uuid.UUID, name string) (*GroceryList, error)
	DeleteList(ctx context.Context, id uuid.UUID) error

	// items
	AddItem(ctx context.Context, listID uuid.UUID, inventoryItemID *uuid.UUID, name string, quantity float64, unit string, notes *string, sortOrder int) (*GroceryListItem, error)
	GetItem(ctx context.Context, id uuid.UUID) (*GroceryListItem, error)
	ListItems(ctx context.Context, listID uuid.UUID) ([]*GroceryListItem, error)
	UpdateItemStatus(ctx context.Context, id uuid.UUID, status string) (*GroceryListItem, error)
	ReorderItem(ctx context.Context, id uuid.UUID, sortOrder int) error
	DeleteItem(ctx context.Context, id uuid.UUID) error
}
