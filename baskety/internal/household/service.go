package household

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var ErrForbidden = errors.New("forbidden")
var ErrInvalidInput = errors.New("invalid input")

// ServiceIface allows handler testing with mocks.
type ServiceIface interface {
	CreateHousehold(ctx context.Context, name string, createdBy uuid.UUID) (*HouseholdResponse, error)
	GetHousehold(ctx context.Context, id uuid.UUID) (*HouseholdResponse, error)
	ListHouseholds(ctx context.Context, userID uuid.UUID) ([]HouseholdResponse, error)
	AddMember(ctx context.Context, householdID, invitedByUserID uuid.UUID, req AddMemberRequest) (*MemberResponse, error)
	RemoveMember(ctx context.Context, householdID, userID uuid.UUID) error
	CreateShareLink(ctx context.Context, req CreateShareLinkRequest, createdByUserID uuid.UUID) (*ShareLinkResponse, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

var _ ServiceIface = (*Service)(nil)

func (s *Service) CreateHousehold(ctx context.Context, name string, createdBy uuid.UUID) (*HouseholdResponse, error) {
	h, err := s.repo.CreateHousehold(ctx, name, createdBy)
	if err != nil {
		return nil, fmt.Errorf("creating household: %w", err)
	}
	// Add creator as owner
	if _, err := s.repo.AddMember(ctx, h.ID, createdBy, createdBy, "owner"); err != nil {
		return nil, fmt.Errorf("adding owner: %w", err)
	}
	return &HouseholdResponse{ID: h.ID.String(), Name: h.Name, CreatedAt: h.CreatedAt}, nil
}

func (s *Service) GetHousehold(ctx context.Context, id uuid.UUID) (*HouseholdResponse, error) {
	h, err := s.repo.FindHouseholdByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &HouseholdResponse{ID: h.ID.String(), Name: h.Name, CreatedAt: h.CreatedAt}, nil
}

func (s *Service) ListHouseholds(ctx context.Context, userID uuid.UUID) ([]HouseholdResponse, error) {
	households, err := s.repo.ListHouseholdsForUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listing households: %w", err)
	}
	out := make([]HouseholdResponse, len(households))
	for i, h := range households {
		out[i] = HouseholdResponse{ID: h.ID.String(), Name: h.Name, CreatedAt: h.CreatedAt}
	}
	return out, nil
}

func (s *Service) AddMember(ctx context.Context, householdID, invitedByUserID uuid.UUID, req AddMemberRequest) (*MemberResponse, error) {
	memberUserID, err := uuid.Parse(req.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", ErrInvalidInput)
	}
	m, err := s.repo.AddMember(ctx, householdID, memberUserID, invitedByUserID, req.Role)
	if err != nil {
		return nil, fmt.Errorf("adding member: %w", err)
	}
	return &MemberResponse{UserID: m.UserID.String(), Role: m.Role, JoinedAt: m.JoinedAt}, nil
}

func (s *Service) RemoveMember(ctx context.Context, householdID, userID uuid.UUID) error {
	return s.repo.RemoveMember(ctx, householdID, userID)
}

func (s *Service) CreateShareLink(ctx context.Context, req CreateShareLinkRequest, createdByUserID uuid.UUID) (*ShareLinkResponse, error) {
	inventoryID, err := uuid.Parse(req.InventoryID)
	if err != nil {
		return nil, fmt.Errorf("invalid inventory_id: %w", ErrInvalidInput)
	}
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		return nil, fmt.Errorf("generating token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(rawBytes)

	var passwordHash *string
	if req.Password != nil {
		h, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("hashing password: %w", err)
		}
		s := string(h)
		passwordHash = &s
	}

	link, err := s.repo.CreateShareLink(ctx, inventoryID, createdByUserID, token, passwordHash, req.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("creating share link: %w", err)
	}
	return &ShareLinkResponse{
		ID:        link.ID.String(),
		Token:     link.Token,
		ExpiresAt: link.ExpiresAt,
		CreatedAt: link.CreatedAt,
	}, nil
}
