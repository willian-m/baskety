package settings_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/settings"
	"github.com/willian-m/baskety/internal/testutil"
)

func seedHousehold(ctx context.Context, t *testing.T, pool *pgxpool.Pool) (userID, householdID uuid.UUID) {
	t.Helper()
	err := pool.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
		uuid.NewString()+"@example.com", "Test User", "hash",
	).Scan(&userID)
	require.NoError(t, err)
	err = pool.QueryRow(ctx,
		`INSERT INTO households (name, created_by) VALUES ($1, $2) RETURNING id`,
		"Test Household", userID,
	).Scan(&householdID)
	require.NoError(t, err)
	return
}

func TestIntegration_Settings_HouseholdSetting(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	_, householdID := seedHousehold(ctx, t, pool)

	repo := settings.NewPgRepository(pool)

	// Upsert and read back
	require.NoError(t, repo.UpsertHouseholdSetting(ctx, householdID, "theme", "dark"))
	got, err := repo.GetHouseholdSetting(ctx, householdID, "theme")
	require.NoError(t, err)
	assert.Equal(t, "theme", got.Key)
	assert.Equal(t, "dark", got.Value)
	assert.Equal(t, householdID, got.HouseholdID)

	// Upsert again (update)
	require.NoError(t, repo.UpsertHouseholdSetting(ctx, householdID, "theme", "light"))
	got, err = repo.GetHouseholdSetting(ctx, householdID, "theme")
	require.NoError(t, err)
	assert.Equal(t, "light", got.Value)

	// Non-existent key returns ErrNotFound
	_, err = repo.GetHouseholdSetting(ctx, householdID, "nonexistent")
	require.Error(t, err)
	assert.True(t, errors.Is(err, settings.ErrNotFound))
}

func TestIntegration_Settings_UserSetting(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	userID, _ := seedHousehold(ctx, t, pool)

	repo := settings.NewPgRepository(pool)

	// Upsert and read back
	require.NoError(t, repo.UpsertUserSetting(ctx, userID, "language", "pt-BR"))
	got, err := repo.GetUserSetting(ctx, userID, "language")
	require.NoError(t, err)
	assert.Equal(t, "language", got.Key)
	assert.Equal(t, "pt-BR", got.Value)
	assert.Equal(t, userID, got.UserID)

	// Upsert again (update)
	require.NoError(t, repo.UpsertUserSetting(ctx, userID, "language", "en-US"))
	got, err = repo.GetUserSetting(ctx, userID, "language")
	require.NoError(t, err)
	assert.Equal(t, "en-US", got.Value)

	// Non-existent key returns ErrNotFound
	_, err = repo.GetUserSetting(ctx, userID, "nonexistent")
	require.Error(t, err)
	assert.True(t, errors.Is(err, settings.ErrNotFound))
}

func TestIntegration_Settings_LLMProvider(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	_, householdID := seedHousehold(ctx, t, pool)

	repo := settings.NewPgRepository(pool)
	h := householdID

	// Create provider
	p, err := repo.CreateLLMProvider(ctx, &h, "ollama", "llama3", nil, nil, true)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, p.ID)
	assert.Equal(t, "ollama", p.Provider)
	assert.Equal(t, "llama3", p.Model)
	assert.True(t, p.IsDefault)
	assert.Equal(t, &householdID, p.HouseholdID)

	// List providers
	list, err := repo.ListLLMProviders(ctx, householdID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, p.ID, list[0].ID)
	assert.Equal(t, "ollama", list[0].Provider)
}

func TestIntegration_Settings_OCRProvider(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	_, householdID := seedHousehold(ctx, t, pool)

	repo := settings.NewPgRepository(pool)
	h := householdID

	// Create provider
	p, err := repo.CreateOCRProvider(ctx, &h, "tesseract", nil, nil, nil, false)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, p.ID)
	assert.Equal(t, "tesseract", p.Provider)
	assert.False(t, p.IsDefault)
	assert.Equal(t, &householdID, p.HouseholdID)

	// List providers
	list, err := repo.ListOCRProviders(ctx, householdID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, p.ID, list[0].ID)
	assert.Equal(t, "tesseract", list[0].Provider)
}
