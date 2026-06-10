package household

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/willian-m/baskety/gen/sqlc"
)

var ErrNotFound = errors.New("not found")

type pgRepository struct {
	q *sqlc.Queries
}

func NewPgRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{q: sqlc.New(pool)}
}

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgToUUID(id pgtype.UUID) uuid.UUID {
	return uuid.UUID(id.Bytes)
}

func timeToPg(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func pgToTimePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func (r *pgRepository) CreateHousehold(ctx context.Context, name string, createdBy uuid.UUID) (*Household, error) {
	row, err := r.q.CreateHousehold(ctx, sqlc.CreateHouseholdParams{
		Name:      name,
		CreatedBy: uuidToPg(createdBy),
	})
	if err != nil {
		return nil, fmt.Errorf("create household: %w", err)
	}
	return &Household{
		ID:        pgToUUID(row.ID),
		Name:      row.Name,
		CreatedBy: pgToUUID(row.CreatedBy),
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}, nil
}

func (r *pgRepository) FindHouseholdByID(ctx context.Context, id uuid.UUID) (*Household, error) {
	row, err := r.q.GetHouseholdByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("find household: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("find household: %w", err)
	}
	return &Household{
		ID:        pgToUUID(row.ID),
		Name:      row.Name,
		CreatedBy: pgToUUID(row.CreatedBy),
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}, nil
}

func (r *pgRepository) ListHouseholdsForUser(ctx context.Context, userID uuid.UUID) ([]Household, error) {
	rows, err := r.q.ListHouseholdsByUser(ctx, uuidToPg(userID))
	if err != nil {
		return nil, fmt.Errorf("list households: %w", err)
	}
	out := make([]Household, len(rows))
	for i, row := range rows {
		out[i] = Household{
			ID:        pgToUUID(row.ID),
			Name:      row.Name,
			CreatedBy: pgToUUID(row.CreatedBy),
			CreatedAt: row.CreatedAt.Time,
			UpdatedAt: row.UpdatedAt.Time,
		}
	}
	return out, nil
}

func (r *pgRepository) AddMember(ctx context.Context, householdID, userID, invitedByUserID uuid.UUID, role string) (*Member, error) {
	row, err := r.q.AddHouseholdMember(ctx, sqlc.AddHouseholdMemberParams{
		HouseholdID:     uuidToPg(householdID),
		UserID:          uuidToPg(userID),
		Role:            role,
		InvitedByUserID: uuidToPg(invitedByUserID),
	})
	if err != nil {
		return nil, fmt.Errorf("add member: %w", err)
	}
	return &Member{
		HouseholdID:     pgToUUID(row.HouseholdID),
		UserID:          pgToUUID(row.UserID),
		Role:            row.Role,
		JoinedAt:        row.JoinedAt.Time,
		InvitedByUserID: pgToUUID(row.InvitedByUserID),
		ExpiresAt:       pgToTimePtr(row.ExpiresAt),
		RevokedAt:       pgToTimePtr(row.RevokedAt),
	}, nil
}

func (r *pgRepository) RemoveMember(ctx context.Context, householdID, userID uuid.UUID) error {
	if err := r.q.RemoveHouseholdMember(ctx, sqlc.RemoveHouseholdMemberParams{
		HouseholdID: uuidToPg(householdID),
		UserID:      uuidToPg(userID),
	}); err != nil {
		return fmt.Errorf("remove member: %w", err)
	}
	return nil
}

func (r *pgRepository) FindMember(ctx context.Context, householdID, userID uuid.UUID) (*Member, error) {
	row, err := r.q.GetHouseholdMember(ctx, sqlc.GetHouseholdMemberParams{
		HouseholdID: uuidToPg(householdID),
		UserID:      uuidToPg(userID),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("find member: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("find member: %w", err)
	}
	return &Member{
		HouseholdID:     pgToUUID(row.HouseholdID),
		UserID:          pgToUUID(row.UserID),
		Role:            row.Role,
		JoinedAt:        row.JoinedAt.Time,
		InvitedByUserID: pgToUUID(row.InvitedByUserID),
		ExpiresAt:       pgToTimePtr(row.ExpiresAt),
		RevokedAt:       pgToTimePtr(row.RevokedAt),
	}, nil
}

func (r *pgRepository) CreateShareLink(ctx context.Context, inventoryID, createdByUserID uuid.UUID, token string, passwordHash *string, expiresAt *time.Time) (*ShareLink, error) {
	row, err := r.q.CreateShareLink(ctx, sqlc.CreateShareLinkParams{
		InventoryID:     uuidToPg(inventoryID),
		Token:           token,
		CreatedByUserID: uuidToPg(createdByUserID),
		PasswordHash:    passwordHash,
		ExpiresAt:       timeToPg(expiresAt),
	})
	if err != nil {
		return nil, fmt.Errorf("create share link: %w", err)
	}
	return &ShareLink{
		ID:              pgToUUID(row.ID),
		InventoryID:     pgToUUID(row.InventoryID),
		Token:           row.Token,
		CreatedByUserID: pgToUUID(row.CreatedByUserID),
		PasswordHash:    row.PasswordHash,
		ExpiresAt:       pgToTimePtr(row.ExpiresAt),
		RevokedAt:       pgToTimePtr(row.RevokedAt),
		CreatedAt:       row.CreatedAt.Time,
	}, nil
}
