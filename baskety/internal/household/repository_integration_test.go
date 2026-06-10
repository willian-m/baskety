package household_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/household"
	"github.com/willian-m/baskety/internal/testutil"
)

// seedUser inserts a user row and returns its ID.
func seedUser(ctx context.Context, t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var userID uuid.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
		uuid.NewString()+"@example.com", "Test User", "hash",
	).Scan(&userID)
	require.NoError(t, err)
	return userID
}

// seedHousehold inserts a household row and returns its ID.
func seedHousehold(ctx context.Context, t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) uuid.UUID {
	t.Helper()
	var householdID uuid.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO households (name, created_by) VALUES ($1, $2) RETURNING id`,
		"Test Household", userID,
	).Scan(&householdID)
	require.NoError(t, err)
	return householdID
}

// seedInventory inserts an inventory row and returns its ID.
func seedInventory(ctx context.Context, t *testing.T, pool *pgxpool.Pool, householdID uuid.UUID) uuid.UUID {
	t.Helper()
	var inventoryID uuid.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO inventories (household_id, name) VALUES ($1, $2) RETURNING id`,
		householdID, "Test Inventory",
	).Scan(&inventoryID)
	require.NoError(t, err)
	return inventoryID
}

func TestIntegration_Household_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := household.NewPgRepository(pool)

	userID := seedUser(ctx, t, pool)

	h, err := repo.CreateHousehold(ctx, "My Kitchen", userID)
	require.NoError(t, err)

	assert.NotEqual(t, uuid.Nil, h.ID)
	assert.Equal(t, "My Kitchen", h.Name)
	assert.Equal(t, userID, h.CreatedBy)
	assert.False(t, h.CreatedAt.IsZero(), "created_at should be set")
	assert.False(t, h.UpdatedAt.IsZero(), "updated_at should be set")
}

func TestIntegration_Household_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := household.NewPgRepository(pool)

	userID := seedUser(ctx, t, pool)

	created, err := repo.CreateHousehold(ctx, "Pantry", userID)
	require.NoError(t, err)

	// Found
	found, err := repo.FindHouseholdByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
	assert.Equal(t, "Pantry", found.Name)
	assert.Equal(t, userID, found.CreatedBy)

	// Not found
	_, err = repo.FindHouseholdByID(ctx, uuid.New())
	require.Error(t, err)
	assert.True(t, errors.Is(err, household.ErrNotFound), "expected ErrNotFound, got %v", err)
}

func TestIntegration_Household_Members(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := household.NewPgRepository(pool)

	ownerID := seedUser(ctx, t, pool)
	memberID := seedUser(ctx, t, pool)

	h, err := repo.CreateHousehold(ctx, "Family Home", ownerID)
	require.NoError(t, err)

	// Add member
	m, err := repo.AddMember(ctx, h.ID, memberID, ownerID, "member")
	require.NoError(t, err)
	assert.Equal(t, h.ID, m.HouseholdID)
	assert.Equal(t, memberID, m.UserID)
	assert.Equal(t, "member", m.Role)
	assert.Equal(t, ownerID, m.InvitedByUserID)
	assert.False(t, m.JoinedAt.IsZero(), "joined_at should be set")

	// Find member
	found, err := repo.FindMember(ctx, h.ID, memberID)
	require.NoError(t, err)
	assert.Equal(t, m.HouseholdID, found.HouseholdID)
	assert.Equal(t, m.UserID, found.UserID)
	assert.Equal(t, m.Role, found.Role)

	// Remove member
	err = repo.RemoveMember(ctx, h.ID, memberID)
	require.NoError(t, err)

	// FindMember after removal should return ErrNotFound
	_, err = repo.FindMember(ctx, h.ID, memberID)
	require.Error(t, err)
	assert.True(t, errors.Is(err, household.ErrNotFound), "expected ErrNotFound after removal, got %v", err)
}

func TestIntegration_Household_ListForUser(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := household.NewPgRepository(pool)

	userID := seedUser(ctx, t, pool)

	h1, err := repo.CreateHousehold(ctx, "Household Alpha", userID)
	require.NoError(t, err)

	h2, err := repo.CreateHousehold(ctx, "Household Beta", userID)
	require.NoError(t, err)

	// Add userID as explicit member of h2 as well (invited by themselves)
	_, err = repo.AddMember(ctx, h2.ID, userID, userID, "owner")
	require.NoError(t, err)

	list, err := repo.ListHouseholdsForUser(ctx, userID)
	require.NoError(t, err)

	ids := make([]uuid.UUID, len(list))
	for i, hh := range list {
		ids[i] = hh.ID
	}
	assert.Contains(t, ids, h1.ID, "h1 should appear in user's household list")
	assert.Contains(t, ids, h2.ID, "h2 should appear in user's household list")
}

func TestIntegration_Household_ShareLink(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := household.NewPgRepository(pool)

	userID := seedUser(ctx, t, pool)
	householdID := seedHousehold(ctx, t, pool, userID)
	inventoryID := seedInventory(ctx, t, pool, householdID)

	token := uuid.NewString()
	expiresAt := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Microsecond)

	link, err := repo.CreateShareLink(ctx, inventoryID, userID, token, nil, &expiresAt)
	require.NoError(t, err)

	assert.NotEqual(t, uuid.Nil, link.ID)
	assert.Equal(t, inventoryID, link.InventoryID)
	assert.Equal(t, token, link.Token)
	assert.Equal(t, userID, link.CreatedByUserID)
	assert.Nil(t, link.PasswordHash)
	assert.Nil(t, link.RevokedAt)
	require.NotNil(t, link.ExpiresAt)
	assert.WithinDuration(t, expiresAt, *link.ExpiresAt, time.Second)
	assert.False(t, link.CreatedAt.IsZero(), "created_at should be set")
}
