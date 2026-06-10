package auth_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/auth"
	"golang.org/x/crypto/bcrypt"
)

type mockRepo struct {
	createUserFn             func(ctx context.Context, email, name, passwordHash string) (*auth.User, error)
	findUserByEmailFn        func(ctx context.Context, email string) (*auth.User, error)
	createSessionFn          func(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt *time.Time) (*auth.Session, error)
	findSessionByTokenHashFn func(ctx context.Context, tokenHash string) (*auth.Session, error)
	revokeSessionFn          func(ctx context.Context, sessionID uuid.UUID) error
}

func (m *mockRepo) CreateUser(ctx context.Context, email, name, passwordHash string) (*auth.User, error) {
	return m.createUserFn(ctx, email, name, passwordHash)
}
func (m *mockRepo) FindUserByEmail(ctx context.Context, email string) (*auth.User, error) {
	return m.findUserByEmailFn(ctx, email)
}
func (m *mockRepo) CreateSession(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt *time.Time) (*auth.Session, error) {
	return m.createSessionFn(ctx, userID, tokenHash, expiresAt)
}
func (m *mockRepo) FindSessionByTokenHash(ctx context.Context, tokenHash string) (*auth.Session, error) {
	return m.findSessionByTokenHashFn(ctx, tokenHash)
}
func (m *mockRepo) RevokeSession(ctx context.Context, sessionID uuid.UUID) error {
	return m.revokeSessionFn(ctx, sessionID)
}

func TestRegister_Success(t *testing.T) {
	userID := uuid.New()
	repo := &mockRepo{
		createUserFn: func(_ context.Context, email, name, _ string) (*auth.User, error) {
			return &auth.User{ID: userID, Email: email, Name: name, CreatedAt: time.Now()}, nil
		},
	}
	svc := auth.NewService(repo)
	resp, err := svc.Register(context.Background(), auth.RegisterRequest{Email: "a@b.com", Name: "Alice", Password: "secret"})
	require.NoError(t, err)
	assert.Equal(t, "a@b.com", resp.Email)
	assert.Equal(t, userID.String(), resp.ID)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	repo := &mockRepo{
		createUserFn: func(_ context.Context, _, _, _ string) (*auth.User, error) {
			return nil, fmt.Errorf("wrap: %w", auth.ErrEmailTaken)
		},
	}
	svc := auth.NewService(repo)
	_, err := svc.Register(context.Background(), auth.RegisterRequest{Email: "a@b.com", Name: "Alice", Password: "secret"})
	assert.ErrorIs(t, err, auth.ErrEmailTaken)
}

func TestLogin_Success(t *testing.T) {
	userID := uuid.New()
	sessionID := uuid.New()
	hash, _ := bcrypt.GenerateFromPassword([]byte("secret"), 12)
	repo := &mockRepo{
		findUserByEmailFn: func(_ context.Context, email string) (*auth.User, error) {
			return &auth.User{ID: userID, Email: email, PasswordHash: string(hash)}, nil
		},
		createSessionFn: func(_ context.Context, _ uuid.UUID, tokenHash string, expiresAt *time.Time) (*auth.Session, error) {
			return &auth.Session{ID: sessionID, UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt}, nil
		},
	}
	svc := auth.NewService(repo)
	resp, err := svc.Login(context.Background(), auth.LoginRequest{Email: "a@b.com", Password: "secret"})
	require.NoError(t, err)
	assert.NotEmpty(t, resp.Token)
	assert.NotNil(t, resp.ExpiresAt)
}

func TestLogin_WrongPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correct"), 12)
	repo := &mockRepo{
		findUserByEmailFn: func(_ context.Context, email string) (*auth.User, error) {
			return &auth.User{ID: uuid.New(), Email: email, PasswordHash: string(hash)}, nil
		},
	}
	svc := auth.NewService(repo)
	_, err := svc.Login(context.Background(), auth.LoginRequest{Email: "a@b.com", Password: "wrong"})
	assert.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestLogin_UserNotFound(t *testing.T) {
	repo := &mockRepo{
		findUserByEmailFn: func(_ context.Context, email string) (*auth.User, error) {
			return nil, fmt.Errorf("wrap: %w", auth.ErrNotFound)
		},
	}
	svc := auth.NewService(repo)
	_, err := svc.Login(context.Background(), auth.LoginRequest{Email: "a@b.com", Password: "secret"})
	assert.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestLogout_Success(t *testing.T) {
	sessionID := uuid.New()
	called := false
	repo := &mockRepo{
		revokeSessionFn: func(_ context.Context, id uuid.UUID) error {
			assert.Equal(t, sessionID, id)
			called = true
			return nil
		},
	}
	svc := auth.NewService(repo)
	err := svc.Logout(context.Background(), sessionID)
	require.NoError(t, err)
	assert.True(t, called)
}
