package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	CreateUser(ctx context.Context, email, name, passwordHash string) (*User, error)
	FindUserByEmail(ctx context.Context, email string) (*User, error)
	CreateSession(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt *time.Time) (*Session, error)
	FindSessionByTokenHash(ctx context.Context, tokenHash string) (*Session, error)
	RevokeSession(ctx context.Context, sessionID uuid.UUID) error
}
