package household_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/household"
)

type mockRepo struct {
	createHouseholdFn       func(ctx context.Context, name string, createdBy uuid.UUID) (*household.Household, error)
	findHouseholdByIDFn     func(ctx context.Context, id uuid.UUID) (*household.Household, error)
	listHouseholdsForUserFn func(ctx context.Context, userID uuid.UUID) ([]household.Household, error)
	addMemberFn             func(ctx context.Context, householdID, userID, invitedByUserID uuid.UUID, role string) (*household.Member, error)
	removeMemberFn          func(ctx context.Context, householdID, userID uuid.UUID) error
	findMemberFn            func(ctx context.Context, householdID, userID uuid.UUID) (*household.Member, error)
	createShareLinkFn       func(ctx context.Context, inventoryID, createdByUserID uuid.UUID, token string, passwordHash *string, expiresAt *time.Time) (*household.ShareLink, error)
}

func (m *mockRepo) CreateHousehold(ctx context.Context, name string, createdBy uuid.UUID) (*household.Household, error) {
	return m.createHouseholdFn(ctx, name, createdBy)
}
func (m *mockRepo) FindHouseholdByID(ctx context.Context, id uuid.UUID) (*household.Household, error) {
	return m.findHouseholdByIDFn(ctx, id)
}
func (m *mockRepo) ListHouseholdsForUser(ctx context.Context, userID uuid.UUID) ([]household.Household, error) {
	return m.listHouseholdsForUserFn(ctx, userID)
}
func (m *mockRepo) AddMember(ctx context.Context, householdID, userID, invitedByUserID uuid.UUID, role string) (*household.Member, error) {
	return m.addMemberFn(ctx, householdID, userID, invitedByUserID, role)
}
func (m *mockRepo) RemoveMember(ctx context.Context, householdID, userID uuid.UUID) error {
	return m.removeMemberFn(ctx, householdID, userID)
}
func (m *mockRepo) FindMember(ctx context.Context, householdID, userID uuid.UUID) (*household.Member, error) {
	return m.findMemberFn(ctx, householdID, userID)
}
func (m *mockRepo) CreateShareLink(ctx context.Context, inventoryID, createdByUserID uuid.UUID, token string, passwordHash *string, expiresAt *time.Time) (*household.ShareLink, error) {
	return m.createShareLinkFn(ctx, inventoryID, createdByUserID, token, passwordHash, expiresAt)
}

func TestCreateHousehold_Success(t *testing.T) {
	hID := uuid.New()
	userID := uuid.New()
	repo := &mockRepo{
		createHouseholdFn: func(_ context.Context, name string, createdBy uuid.UUID) (*household.Household, error) {
			return &household.Household{ID: hID, Name: name, CreatedBy: createdBy, CreatedAt: time.Now()}, nil
		},
		addMemberFn: func(_ context.Context, householdID, userID2, invitedBy uuid.UUID, role string) (*household.Member, error) {
			assert.Equal(t, hID, householdID)
			assert.Equal(t, userID, userID2)
			assert.Equal(t, "owner", role)
			return &household.Member{HouseholdID: householdID, UserID: userID2, Role: role, JoinedAt: time.Now()}, nil
		},
	}
	svc := household.NewService(repo)
	resp, err := svc.CreateHousehold(context.Background(), "My House", userID)
	require.NoError(t, err)
	assert.Equal(t, "My House", resp.Name)
}

func TestGetHousehold_NotFound(t *testing.T) {
	repo := &mockRepo{
		findHouseholdByIDFn: func(_ context.Context, id uuid.UUID) (*household.Household, error) {
			return nil, fmt.Errorf("wrap: %w", household.ErrNotFound)
		},
	}
	svc := household.NewService(repo)
	_, err := svc.GetHousehold(context.Background(), uuid.New())
	assert.Error(t, err)
}

func TestListHouseholds_Success(t *testing.T) {
	userID := uuid.New()
	repo := &mockRepo{
		listHouseholdsForUserFn: func(_ context.Context, _ uuid.UUID) ([]household.Household, error) {
			return []household.Household{
				{ID: uuid.New(), Name: "A", CreatedAt: time.Now()},
				{ID: uuid.New(), Name: "B", CreatedAt: time.Now()},
			}, nil
		},
	}
	svc := household.NewService(repo)
	list, err := svc.ListHouseholds(context.Background(), userID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestAddMember_Success(t *testing.T) {
	hID := uuid.New()
	memberID := uuid.New()
	inviterID := uuid.New()
	repo := &mockRepo{
		addMemberFn: func(_ context.Context, hid, uid, invBy uuid.UUID, role string) (*household.Member, error) {
			return &household.Member{HouseholdID: hid, UserID: uid, Role: role, JoinedAt: time.Now()}, nil
		},
	}
	svc := household.NewService(repo)
	resp, err := svc.AddMember(context.Background(), hID, inviterID, household.AddMemberRequest{UserID: memberID.String(), Role: "member"})
	require.NoError(t, err)
	assert.Equal(t, "member", resp.Role)
}

func TestRemoveMember_Success(t *testing.T) {
	hID := uuid.New()
	userID := uuid.New()
	called := false
	repo := &mockRepo{
		removeMemberFn: func(_ context.Context, hid, uid uuid.UUID) error {
			assert.Equal(t, hID, hid)
			assert.Equal(t, userID, uid)
			called = true
			return nil
		},
	}
	svc := household.NewService(repo)
	err := svc.RemoveMember(context.Background(), hID, userID)
	require.NoError(t, err)
	assert.True(t, called)
}

func TestCreateShareLink_Success(t *testing.T) {
	inventoryID := uuid.New()
	userID := uuid.New()
	repo := &mockRepo{
		createShareLinkFn: func(_ context.Context, invID, createdBy uuid.UUID, token string, passwordHash *string, expiresAt *time.Time) (*household.ShareLink, error) {
			return &household.ShareLink{
				ID:              uuid.New(),
				InventoryID:     invID,
				Token:           token,
				CreatedByUserID: createdBy,
				CreatedAt:       time.Now(),
			}, nil
		},
	}
	svc := household.NewService(repo)
	resp, err := svc.CreateShareLink(context.Background(), household.CreateShareLinkRequest{InventoryID: inventoryID.String()}, userID)
	require.NoError(t, err)
	assert.NotEmpty(t, resp.Token)
}
