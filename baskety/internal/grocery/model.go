package grocery

import (
	"time"

	"github.com/google/uuid"
)

type GroceryList struct {
	ID              uuid.UUID
	InventoryID     uuid.UUID
	Name            string
	Status          string // "active" | "completed" | "archived"
	CreatedByUserID uuid.UUID
	CompletedAt     *time.Time
	PinnedAt        *time.Time
	ExpiresAt       *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type GroceryListItem struct {
	ID              uuid.UUID
	GroceryListID   uuid.UUID
	InventoryItemID *uuid.UUID // nullable
	Name            string
	Quantity        float64
	Unit            string
	Notes           *string
	Status          string // "pending" | "bought" | "skipped"
	SortOrder       int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
