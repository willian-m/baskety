package inventory

import "time"

// --- Requests ---

type CreateInventoryRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

type UpdateInventoryRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

type CreateItemRequest struct {
	Name           string  `json:"name"`
	Category       string  `json:"category"`
	Unit           string  `json:"unit"`
	TargetQuantity float64 `json:"target_quantity"`
	Notes          *string `json:"notes"`
}

type UpdateItemRequest struct {
	Name           string  `json:"name"`
	Category       string  `json:"category"`
	Unit           string  `json:"unit"`
	TargetQuantity float64 `json:"target_quantity"`
	Notes          *string `json:"notes"`
}

type AddBatchRequest struct {
	Quantity  float64    `json:"quantity"`
	ExpiresAt *time.Time `json:"expires_at"`
	Notes     *string    `json:"notes"`
}

// --- Responses ---

type InventoryResponse struct {
	ID          string    `json:"id"`
	HouseholdID string    `json:"household_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ItemResponse struct {
	ID             string    `json:"id"`
	InventoryID    string    `json:"inventory_id"`
	Name           string    `json:"name"`
	Category       string    `json:"category"`
	Unit           string    `json:"unit"`
	TargetQuantity float64   `json:"target_quantity"`
	Notes          *string   `json:"notes"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	StoredQuantity float64   `json:"stored_quantity"`
	BatchCount     int64     `json:"batch_count"`
}

type BatchResponse struct {
	ID        string     `json:"id"`
	ItemID    string     `json:"item_id"`
	Quantity  float64    `json:"quantity"`
	ExpiresAt *time.Time `json:"expires_at"`
	AddedAt   time.Time  `json:"added_at"`
	EmptiedAt *time.Time `json:"emptied_at"`
	Notes     *string    `json:"notes"`
	CreatedAt time.Time  `json:"created_at"`
}

func toInventoryResponse(m *Inventory) *InventoryResponse {
	return &InventoryResponse{
		ID:          m.ID.String(),
		HouseholdID: m.HouseholdID.String(),
		Name:        m.Name,
		Description: m.Description,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

func toItemResponse(m *InventoryItem) *ItemResponse {
	return &ItemResponse{
		ID:             m.ID.String(),
		InventoryID:    m.InventoryID.String(),
		Name:           m.Name,
		Category:       m.Category,
		Unit:           m.Unit,
		TargetQuantity: m.TargetQuantity,
		Notes:          m.Notes,
		CreatedAt:      m.CreatedAt,
		UpdatedAt:      m.UpdatedAt,
		StoredQuantity: m.StoredQuantity,
		BatchCount:     m.BatchCount,
	}
}

func toBatchResponse(m *InventoryBatch) *BatchResponse {
	return &BatchResponse{
		ID:        m.ID.String(),
		ItemID:    m.ItemID.String(),
		Quantity:  m.Quantity,
		ExpiresAt: m.ExpiresAt,
		AddedAt:   m.AddedAt,
		EmptiedAt: m.EmptiedAt,
		Notes:     m.Notes,
		CreatedAt: m.CreatedAt,
	}
}
