package grocery

import "time"

// --- Requests ---

type CreateListRequest struct {
	Name string `json:"name"`
}

type UpdateListStatusRequest struct {
	Status string `json:"status"` // active | completed | archived
}

type AddItemRequest struct {
	InventoryItemID *string `json:"inventory_item_id"`
	Name            string  `json:"name"`
	Quantity        float64 `json:"quantity"`
	Unit            string  `json:"unit"`
	Notes           *string `json:"notes"`
	SortOrder       int     `json:"sort_order"`
}

type UpdateItemStatusRequest struct {
	Status string `json:"status"` // pending | bought | skipped
}

type ReorderItemRequest struct {
	SortOrder int `json:"sort_order"`
}

type AutoGenerateRequest struct {
	ExpiryThresholdDays int `json:"expiry_threshold_days"` // default 7 if 0
}

type RenameListRequest struct {
	Name string `json:"name"`
}

// --- Responses ---

type ListResponse struct {
	ID              string     `json:"id"`
	InventoryID     string     `json:"inventory_id"`
	Name            string     `json:"name"`
	Status          string     `json:"status"`
	CreatedByUserID string     `json:"created_by_user_id"`
	CompletedAt     *time.Time `json:"completed_at"`
	PinnedAt        *time.Time `json:"pinned_at"`
	ExpiresAt       *time.Time `json:"expires_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type ItemResponse struct {
	ID              string    `json:"id"`
	GroceryListID   string    `json:"grocery_list_id"`
	InventoryItemID *string   `json:"inventory_item_id"`
	Name            string    `json:"name"`
	Quantity        float64   `json:"quantity"`
	Unit            string    `json:"unit"`
	Notes           *string   `json:"notes"`
	Status          string    `json:"status"`
	SortOrder       int       `json:"sort_order"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func toListResponse(m *GroceryList) *ListResponse {
	return &ListResponse{
		ID:              m.ID.String(),
		InventoryID:     m.InventoryID.String(),
		Name:            m.Name,
		Status:          m.Status,
		CreatedByUserID: m.CreatedByUserID.String(),
		CompletedAt:     m.CompletedAt,
		PinnedAt:        m.PinnedAt,
		ExpiresAt:       m.ExpiresAt,
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}

func toItemResponse(m *GroceryListItem) *ItemResponse {
	var invItemID *string
	if m.InventoryItemID != nil {
		s := m.InventoryItemID.String()
		invItemID = &s
	}
	return &ItemResponse{
		ID:              m.ID.String(),
		GroceryListID:   m.GroceryListID.String(),
		InventoryItemID: invItemID,
		Name:            m.Name,
		Quantity:        m.Quantity,
		Unit:            m.Unit,
		Notes:           m.Notes,
		Status:          m.Status,
		SortOrder:       m.SortOrder,
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}
