package household

import (
	"time"

	"github.com/google/uuid"
)

type Household struct {
	ID        uuid.UUID
	Name      string
	CreatedBy uuid.UUID
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Member struct {
	HouseholdID     uuid.UUID
	UserID          uuid.UUID
	Role            string
	JoinedAt        time.Time
	InvitedByUserID uuid.UUID
	ExpiresAt       *time.Time
	RevokedAt       *time.Time
}

type ShareLink struct {
	ID              uuid.UUID
	InventoryID     uuid.UUID
	Token           string
	CreatedByUserID uuid.UUID
	PasswordHash    *string
	ExpiresAt       *time.Time
	RevokedAt       *time.Time
	CreatedAt       time.Time
}
