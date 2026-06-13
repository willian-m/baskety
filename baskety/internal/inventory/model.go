package inventory

import (
	"time"

	"github.com/google/uuid"
)

type Inventory struct {
	ID          uuid.UUID
	HouseholdID uuid.UUID
	Name        string
	Description *string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type InventoryItem struct {
	ID             uuid.UUID
	InventoryID    uuid.UUID
	Name           string
	Category       string
	Unit           string
	TargetQuantity float64
	Notes          *string
	DeletedAt      *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
	StoredQuantity float64
	BatchCount     int64
}

type InventoryBatch struct {
	ID        uuid.UUID
	ItemID    uuid.UUID
	Quantity  float64
	ExpiresAt *time.Time
	AddedAt   time.Time
	EmptiedAt *time.Time
	Notes     *string
	CreatedAt time.Time
}
