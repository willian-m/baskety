package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/willian-m/baskety/gen/sqlc"
)

var ErrNotFound = errors.New("not found")
var ErrDuplicate = errors.New("duplicate")

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

func pgToTime(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func (r *pgRepository) CreateUser(ctx context.Context, email, name, passwordHash string) (*User, error) {
	row, err := r.q.CreateUser(ctx, sqlc.CreateUserParams{
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
	})
	if err != nil {
		if isDuplicateError(err) {
			return nil, fmt.Errorf("create user: %w", ErrDuplicate)
		}
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &User{
		ID:           pgToUUID(row.ID),
		Email:        row.Email,
		Name:         row.Name,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt.Time,
		UpdatedAt:    row.UpdatedAt.Time,
	}, nil
}

func (r *pgRepository) FindUserByEmail(ctx context.Context, email string) (*User, error) {
	row, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("find user: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("find user: %w", err)
	}
	return &User{
		ID:           pgToUUID(row.ID),
		Email:        row.Email,
		Name:         row.Name,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt.Time,
		UpdatedAt:    row.UpdatedAt.Time,
	}, nil
}

func (r *pgRepository) CreateSession(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt *time.Time) (*Session, error) {
	row, err := r.q.CreateSession(ctx, sqlc.CreateSessionParams{
		UserID:    uuidToPg(userID),
		TokenHash: tokenHash,
		ExpiresAt: timeToPg(expiresAt),
	})
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	return &Session{
		ID:        pgToUUID(row.ID),
		UserID:    pgToUUID(row.UserID),
		TokenHash: row.TokenHash,
		ExpiresAt: pgToTime(row.ExpiresAt),
		RevokedAt: pgToTime(row.RevokedAt),
		CreatedAt: row.CreatedAt.Time,
	}, nil
}

func (r *pgRepository) FindSessionByTokenHash(ctx context.Context, tokenHash string) (*Session, error) {
	row, err := r.q.GetSessionByTokenHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("find session: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("find session: %w", err)
	}
	return &Session{
		ID:        pgToUUID(row.ID),
		UserID:    pgToUUID(row.UserID),
		TokenHash: row.TokenHash,
		ExpiresAt: pgToTime(row.ExpiresAt),
		RevokedAt: pgToTime(row.RevokedAt),
		CreatedAt: row.CreatedAt.Time,
	}, nil
}

func (r *pgRepository) RevokeSession(ctx context.Context, sessionID uuid.UUID) error {
	if err := r.q.RevokeSession(ctx, uuidToPg(sessionID)); err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func isDuplicateError(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
