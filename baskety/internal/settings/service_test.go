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
func (m *mockRepo) UpdateLLMProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID, req UpdateLLMProviderRequest) (*LLMProviderConfig, error) {
	for _, p := range m.llm {
		if p.ID == id {
			if req.IsDefault {
				for _, other := range m.llm {
					other.IsDefault = false
				}
			}
			p.Provider = req.Provider
			p.Model = req.Model
			p.EndpointURL = req.EndpointURL
			if req.APIKey != nil {
				p.APIKeyEncrypted = req.APIKey
			}
			p.IsDefault = req.IsDefault
			return p, nil
		}
	}
	return nil, ErrNotFound
}
func (m *mockRepo) DeleteLLMProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID) error {
	for i, p := range m.llm {
		if p.ID == id {
			m.llm = append(m.llm[:i], m.llm[i+1:]...)
			return nil
		}
	}
	return nil
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
func (m *mockRepo) UpdateOCRProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID, req UpdateOCRProviderRequest) (*OCRProviderConfig, error) {
	for _, p := range m.ocr {
		if p.ID == id {
			if req.IsDefault {
				for _, other := range m.ocr {
					other.IsDefault = false
				}
			}
			p.Provider = req.Provider
			p.EndpointURL = req.EndpointURL
			if req.APIKey != nil {
				p.APIKeyEncrypted = req.APIKey
			}
			p.ExtraConfig = req.ExtraConfig
			p.IsDefault = req.IsDefault
			return p, nil
		}
	}
	return nil, ErrNotFound
}
func (m *mockRepo) DeleteOCRProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID) error {
	for i, p := range m.ocr {
		if p.ID == id {
			m.ocr = append(m.ocr[:i], m.ocr[i+1:]...)
			return nil
		}
	}
	return nil
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

func TestUpdateLLMProviderValidation(t *testing.T) {
	svc := NewService(newMockRepo())
	hid := uuid.New()
	if _, err := svc.UpdateLLMProvider(context.Background(), hid, uuid.New(), UpdateLLMProviderRequest{Model: "x"}); err == nil {
		t.Fatal("expected error for missing provider")
	}
	if _, err := svc.UpdateLLMProvider(context.Background(), hid, uuid.New(), UpdateLLMProviderRequest{Provider: "ollama"}); err == nil {
		t.Fatal("expected error for missing model")
	}
}

func TestUpdateLLMProviderUnsetsOtherDefaults(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	hid := uuid.New()
	first, _ := svc.CreateLLMProvider(context.Background(), hid, CreateLLMProviderRequest{Provider: "ollama", Model: "a", IsDefault: true})
	second, _ := svc.CreateLLMProvider(context.Background(), hid, CreateLLMProviderRequest{Provider: "openai", Model: "b"})

	updated, err := svc.UpdateLLMProvider(context.Background(), hid, second.ID, UpdateLLMProviderRequest{Provider: "openai", Model: "b", IsDefault: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updated.IsDefault {
		t.Fatal("expected updated provider to be default")
	}
	if first.IsDefault {
		t.Fatal("expected previous default to be unset")
	}
}

func TestUpdateLLMProviderRetainsAPIKeyWhenNil(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	hid := uuid.New()
	existing := "secret"
	p, _ := svc.CreateLLMProvider(context.Background(), hid, CreateLLMProviderRequest{Provider: "openai", Model: "b"})
	p.APIKeyEncrypted = &existing

	updated, err := svc.UpdateLLMProvider(context.Background(), hid, p.ID, UpdateLLMProviderRequest{Provider: "openai", Model: "c", APIKey: nil})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.APIKeyEncrypted == nil || *updated.APIKeyEncrypted != existing {
		t.Fatal("expected api key to be retained when nil")
	}
}

func TestDeleteLLMProvider(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	hid := uuid.New()
	p, _ := svc.CreateLLMProvider(context.Background(), hid, CreateLLMProviderRequest{Provider: "ollama", Model: "a"})
	if err := svc.DeleteLLMProvider(context.Background(), hid, p.ID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.llm) != 0 {
		t.Fatalf("expected provider deleted")
	}
}

func TestUpdateOCRProviderValidation(t *testing.T) {
	svc := NewService(newMockRepo())
	if _, err := svc.UpdateOCRProvider(context.Background(), uuid.New(), uuid.New(), UpdateOCRProviderRequest{}); err == nil {
		t.Fatal("expected error for missing provider")
	}
}

func TestDeleteOCRProvider(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	hid := uuid.New()
	p, _ := svc.CreateOCRProvider(context.Background(), hid, CreateOCRProviderRequest{Provider: "tesseract"})
	if err := svc.DeleteOCRProvider(context.Background(), hid, p.ID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.ocr) != 0 {
		t.Fatalf("expected ocr provider deleted")
	}
}
