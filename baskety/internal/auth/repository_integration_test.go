package auth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/auth"
	"github.com/willian-m/baskety/internal/testutil"
)

func TestIntegration_Auth_CreateUser(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := auth.NewPgRepository(pool)

	user, err := repo.CreateUser(ctx, "alice@example.com", "Alice", "hashedpassword")
	require.NoError(t, err)
	require.NotNil(t, user)

	assert.NotEqual(t, uuid.Nil, user.ID)
	assert.Equal(t, "alice@example.com", user.Email)
	assert.Equal(t, "Alice", user.Name)
	assert.Equal(t, "hashedpassword", user.PasswordHash)
	assert.False(t, user.CreatedAt.IsZero())
	assert.False(t, user.UpdatedAt.IsZero())
}

func TestIntegration_Auth_FindUserByEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := auth.NewPgRepository(pool)

	created, err := repo.CreateUser(ctx, "bob@example.com", "Bob", "somehash")
	require.NoError(t, err)

	found, err := repo.FindUserByEmail(ctx, "bob@example.com")
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, created.ID, found.ID)
	assert.Equal(t, "bob@example.com", found.Email)
	assert.Equal(t, "Bob", found.Name)

	_, err = repo.FindUserByEmail(ctx, "unknown@example.com")
	require.Error(t, err)
	assert.True(t, errors.Is(err, auth.ErrNotFound))
}

func TestIntegration_Auth_SessionLifecycle(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := auth.NewPgRepository(pool)

	user, err := repo.CreateUser(ctx, "carol@example.com", "Carol", "pw")
	require.NoError(t, err)

	expiry := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Microsecond)
	tokenHash := "testhash-" + uuid.NewString()

	sess, err := repo.CreateSession(ctx, user.ID, tokenHash, &expiry)
	require.NoError(t, err)
	require.NotNil(t, sess)
	assert.NotEqual(t, uuid.Nil, sess.ID)
	assert.Equal(t, user.ID, sess.UserID)
	assert.Equal(t, tokenHash, sess.TokenHash)
	require.NotNil(t, sess.ExpiresAt)
	assert.WithinDuration(t, expiry, *sess.ExpiresAt, time.Second)
	assert.Nil(t, sess.RevokedAt)
	assert.False(t, sess.CreatedAt.IsZero())

	fetched, err := repo.FindSessionByTokenHash(ctx, tokenHash)
	require.NoError(t, err)
	assert.Equal(t, sess.ID, fetched.ID)
	assert.Equal(t, user.ID, fetched.UserID)
	assert.Equal(t, tokenHash, fetched.TokenHash)
	assert.Nil(t, fetched.RevokedAt)

	err = repo.RevokeSession(ctx, sess.ID)
	require.NoError(t, err)

	revoked, err := repo.FindSessionByTokenHash(ctx, tokenHash)
	require.NoError(t, err, "finding a revoked session should still succeed (soft revocation)")
	require.NotNil(t, revoked.RevokedAt, "revoked_at must be set after RevokeSession")
}

func TestIntegration_Auth_DuplicateEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := auth.NewPgRepository(pool)

	_, err := repo.CreateUser(ctx, "dave@example.com", "Dave", "hash1")
	require.NoError(t, err)

	_, err = repo.CreateUser(ctx, "dave@example.com", "Dave Again", "hash2")
	require.Error(t, err)
	assert.True(t, errors.Is(err, auth.ErrDuplicate))
}
