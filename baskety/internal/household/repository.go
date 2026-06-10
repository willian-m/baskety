package household

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	CreateHousehold(ctx context.Context, name string, createdBy uuid.UUID) (*Household, error)
	FindHouseholdByID(ctx context.Context, id uuid.UUID) (*Household, error)
	ListHouseholdsForUser(ctx context.Context, userID uuid.UUID) ([]Household, error)
	AddMember(ctx context.Context, householdID, userID, invitedByUserID uuid.UUID, role string) (*Member, error)
	RemoveMember(ctx context.Context, householdID, userID uuid.UUID) error
	FindMember(ctx context.Context, householdID, userID uuid.UUID) (*Member, error)
	CreateShareLink(ctx context.Context, inventoryID, createdByUserID uuid.UUID, token string, passwordHash *string, expiresAt *time.Time) (*ShareLink, error)
	FindShareLinkByToken(ctx context.Context, token string) (*ShareLink, error)
}
