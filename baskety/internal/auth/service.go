package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12
const sessionDurationDays = 30

var ErrEmailTaken = errors.New("email already taken")
var ErrInvalidCredentials = errors.New("invalid credentials")

type ServiceIface interface {
	Register(ctx context.Context, req RegisterRequest) (*UserResponse, error)
	Login(ctx context.Context, req LoginRequest) (*AuthResponse, error)
	Logout(ctx context.Context, sessionID uuid.UUID) error
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

var _ ServiceIface = (*Service)(nil)

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*UserResponse, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}
	user, err := s.repo.CreateUser(ctx, req.Email, req.Name, string(hash))
	if err != nil {
		if errors.Is(err, ErrDuplicate) {
			return nil, ErrEmailTaken
		}
		return nil, fmt.Errorf("creating user: %w", err)
	}
	return &UserResponse{
		ID:        user.ID.String(),
		Email:     user.Email,
		Name:      user.Name,
		CreatedAt: user.CreatedAt,
	}, nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	user, err := s.repo.FindUserByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("finding user: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}
	rawToken := base64.RawURLEncoding.EncodeToString(rawBytes)
	hashBytes := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hashBytes[:])
	expiresAt := time.Now().UTC().Add(sessionDurationDays * 24 * time.Hour)
	_, err = s.repo.CreateSession(ctx, user.ID, tokenHash, &expiresAt)
	if err != nil {
		return nil, fmt.Errorf("creating session: %w", err)
	}
	return &AuthResponse{Token: rawToken, ExpiresAt: &expiresAt}, nil
}

func (s *Service) Logout(ctx context.Context, sessionID uuid.UUID) error {
	if err := s.repo.RevokeSession(ctx, sessionID); err != nil {
		return fmt.Errorf("revoking session: %w", err)
	}
	return nil
}
