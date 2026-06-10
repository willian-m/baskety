package settings

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

type mockRepo struct {
	householdSettings map[string]string
	userSettings      map[string]string
	llm               []*LLMProviderConfig
	ocr               []*OCRProviderConfig
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		householdSettings: map[string]string{},
		userSettings:      map[string]string{},
	}
}

func (m *mockRepo) GetSystemSetting(ctx context.Context, key string) (*SystemSetting, error) {
	return nil, ErrNotFound
}
func (m *mockRepo) UpsertSystemSetting(ctx context.Context, key, value string) error { return nil }
func (m *mockRepo) GetHouseholdSetting(ctx context.Context, householdID uuid.UUID, key string) (*HouseholdSetting, error) {
	v, ok := m.householdSettings[key]
	if !ok {
		return nil, ErrNotFound
	}
	return &HouseholdSetting{HouseholdID: householdID, Key: key, Value: v}, nil
}
func (m *mockRepo) UpsertHouseholdSetting(ctx context.Context, householdID uuid.UUID, key, value string) error {
	m.householdSettings[key] = value
	return nil
}
func (m *mockRepo) GetUserSetting(ctx context.Context, userID uuid.UUID, key string) (*UserSetting, error) {
	v, ok := m.userSettings[key]
	if !ok {
		return nil, ErrNotFound
	}
	return &UserSetting{UserID: userID, Key: key, Value: v}, nil
}
func (m *mockRepo) UpsertUserSetting(ctx context.Context, userID uuid.UUID, key, value string) error {
	m.userSettings[key] = value
	return nil
}
func (m *mockRepo) CreateLLMProvider(ctx context.Context, householdID *uuid.UUID, provider, model string, endpointURL, apiKeyEncrypted *string, isDefault bool) (*LLMProviderConfig, error) {
	p := &LLMProviderConfig{ID: uuid.New(), HouseholdID: householdID, Provider: provider, Model: model, IsDefault: isDefault}
	m.llm = append(m.llm, p)
	return p, nil
}
func (m *mockRepo) GetDefaultLLMProvider(ctx context.Context, householdID uuid.UUID) (*LLMProviderConfig, error) {
	return nil, ErrNotFound
}
func (m *mockRepo) ListLLMProviders(ctx context.Context, householdID uuid.UUID) ([]*LLMProviderConfig, error) {
	return m.llm, nil
}
func (m *mockRepo) CreateOCRProvider(ctx context.Context, householdID *uuid.UUID, provider string, endpointURL, apiKeyEncrypted *string, extraConfig *string, isDefault bool) (*OCRProviderConfig, error) {
	p := &OCRProviderConfig{ID: uuid.New(), HouseholdID: householdID, Provider: provider, IsDefault: isDefault}
	m.ocr = append(m.ocr, p)
	return p, nil
}
func (m *mockRepo) GetDefaultOCRProvider(ctx context.Context, householdID uuid.UUID) (*OCRProviderConfig, error) {
	return nil, ErrNotFound
}
func (m *mockRepo) ListOCRProviders(ctx context.Context, householdID uuid.UUID) ([]*OCRProviderConfig, error) {
	return m.ocr, nil
}

func TestUpsertAndGetHouseholdSetting(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	hid := uuid.New()
	if err := svc.UpsertHouseholdSetting(context.Background(), hid, "currency", "EUR"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, err := svc.GetHouseholdSetting(context.Background(), hid, "currency")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Value != "EUR" {
		t.Fatalf("expected EUR, got %q", got.Value)
	}
}

func TestGetUserSettingNotFound(t *testing.T) {
	svc := NewService(newMockRepo())
	if _, err := svc.GetUserSetting(context.Background(), uuid.New(), "missing"); err == nil {
		t.Fatal("expected not found error")
	}
}

func TestEmptyKeyRejected(t *testing.T) {
	svc := NewService(newMockRepo())
	if err := svc.UpsertUserSetting(context.Background(), uuid.New(), "", "v"); err == nil {
		t.Fatal("expected error for empty key")
	}
}

func TestCreateLLMProviderValidation(t *testing.T) {
	svc := NewService(newMockRepo())
	if _, err := svc.CreateLLMProvider(context.Background(), uuid.New(), CreateLLMProviderRequest{Model: "x"}); err == nil {
		t.Fatal("expected error for missing provider")
	}
	if _, err := svc.CreateLLMProvider(context.Background(), uuid.New(), CreateLLMProviderRequest{Provider: "ollama"}); err == nil {
		t.Fatal("expected error for missing model")
	}
}

func TestCreateLLMProviderScopesToHousehold(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	hid := uuid.New()
	p, err := svc.CreateLLMProvider(context.Background(), hid, CreateLLMProviderRequest{Provider: "ollama", Model: "llama3"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.HouseholdID == nil || *p.HouseholdID != hid {
		t.Fatalf("expected provider scoped to household")
	}
}

func TestCreateOCRProvider(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	if _, err := svc.CreateOCRProvider(context.Background(), uuid.New(), CreateOCRProviderRequest{Provider: "tesseract"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.ocr) != 1 {
		t.Fatalf("expected 1 ocr provider created")
	}
}
