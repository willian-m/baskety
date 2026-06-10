package household

import "time"

type CreateHouseholdRequest struct {
	Name string `json:"name"`
}

type HouseholdResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type MemberResponse struct {
	UserID   string    `json:"user_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

type AddMemberRequest struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type CreateShareLinkRequest struct {
	InventoryID string     `json:"inventory_id"`
	Password    *string    `json:"password,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

type ShareLinkResponse struct {
	ID        string     `json:"id"`
	Token     string     `json:"token"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
}
