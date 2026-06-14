package settings

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/willian-m/baskety/gen/sqlc"
)

var ErrNotFound = errors.New("not found")

type pgRepository struct {
	pool *pgxpool.Pool
	q    *sqlc.Queries
}

func NewPgRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool, q: sqlc.New(pool)}
}

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func uuidPtrToPg(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

func pgToUUIDPtr(id pgtype.UUID) *uuid.UUID {
	if !id.Valid {
		return nil
	}
	u := uuid.UUID(id.Bytes)
	return &u
}

func bytesToStrPtr(b []byte) *string {
	if b == nil {
		return nil
	}
	s := string(b)
	return &s
}

func strPtrToBytes(s *string) []byte {
	if s == nil {
		return nil
	}
	return []byte(*s)
}

// --- mappers ---

func toLLMProvider(row sqlc.LlmProviderConfig) *LLMProviderConfig {
	return &LLMProviderConfig{
		ID:              uuid.UUID(row.ID.Bytes),
		HouseholdID:     pgToUUIDPtr(row.HouseholdID),
		Provider:        row.Provider,
		Model:           row.Model,
		EndpointURL:     row.EndpointUrl,
		APIKeyEncrypted: row.ApiKeyEncrypted,
		IsDefault:       row.IsDefault,
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

func toOCRProvider(row sqlc.OcrProviderConfig) *OCRProviderConfig {
	return &OCRProviderConfig{
		ID:              uuid.UUID(row.ID.Bytes),
		HouseholdID:     pgToUUIDPtr(row.HouseholdID),
		Provider:        row.Provider,
		EndpointURL:     row.EndpointUrl,
		APIKeyEncrypted: row.ApiKeyEncrypted,
		ExtraConfig:     bytesToStrPtr(row.ExtraConfig),
		IsDefault:       row.IsDefault,
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

// --- settings ---

func (r *pgRepository) GetSystemSetting(ctx context.Context, key string) (*SystemSetting, error) {
	row, err := r.q.GetSystemSetting(ctx, key)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get system setting: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get system setting: %w", err)
	}
	return &SystemSetting{Key: row.Key, Value: row.Value, UpdatedAt: row.UpdatedAt.Time}, nil
}

func (r *pgRepository) UpsertSystemSetting(ctx context.Context, key, value string) error {
	if err := r.q.UpsertSystemSetting(ctx, sqlc.UpsertSystemSettingParams{Key: key, Value: value}); err != nil {
		return fmt.Errorf("upsert system setting: %w", err)
	}
	return nil
}

func (r *pgRepository) GetHouseholdSetting(ctx context.Context, householdID uuid.UUID, key string) (*HouseholdSetting, error) {
	row, err := r.q.GetHouseholdSetting(ctx, sqlc.GetHouseholdSettingParams{HouseholdID: uuidToPg(householdID), Key: key})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get household setting: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get household setting: %w", err)
	}
	return &HouseholdSetting{
		HouseholdID: uuid.UUID(row.HouseholdID.Bytes),
		Key:         row.Key,
		Value:       row.Value,
		UpdatedAt:   row.UpdatedAt.Time,
	}, nil
}

func (r *pgRepository) UpsertHouseholdSetting(ctx context.Context, householdID uuid.UUID, key, value string) error {
	if err := r.q.UpsertHouseholdSetting(ctx, sqlc.UpsertHouseholdSettingParams{
		HouseholdID: uuidToPg(householdID),
		Key:         key,
		Value:       value,
	}); err != nil {
		return fmt.Errorf("upsert household setting: %w", err)
	}
	return nil
}

func (r *pgRepository) GetUserSetting(ctx context.Context, userID uuid.UUID, key string) (*UserSetting, error) {
	row, err := r.q.GetUserSetting(ctx, sqlc.GetUserSettingParams{UserID: uuidToPg(userID), Key: key})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get user setting: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get user setting: %w", err)
	}
	return &UserSetting{
		UserID:    uuid.UUID(row.UserID.Bytes),
		Key:       row.Key,
		Value:     row.Value,
		UpdatedAt: row.UpdatedAt.Time,
	}, nil
}

func (r *pgRepository) UpsertUserSetting(ctx context.Context, userID uuid.UUID, key, value string) error {
	if err := r.q.UpsertUserSetting(ctx, sqlc.UpsertUserSettingParams{
		UserID: uuidToPg(userID),
		Key:    key,
		Value:  value,
	}); err != nil {
		return fmt.Errorf("upsert user setting: %w", err)
	}
	return nil
}

// --- provider configs ---

func (r *pgRepository) CreateLLMProvider(ctx context.Context, householdID *uuid.UUID, provider, model string, endpointURL, apiKeyEncrypted *string, isDefault bool) (*LLMProviderConfig, error) {
	row, err := r.q.CreateLLMProviderConfig(ctx, sqlc.CreateLLMProviderConfigParams{
		HouseholdID:     uuidPtrToPg(householdID),
		Provider:        provider,
		Model:           model,
		EndpointUrl:     endpointURL,
		ApiKeyEncrypted: apiKeyEncrypted,
		IsDefault:       isDefault,
	})
	if err != nil {
		return nil, fmt.Errorf("create llm provider: %w", err)
	}
	return toLLMProvider(row), nil
}

func (r *pgRepository) GetDefaultLLMProvider(ctx context.Context, householdID uuid.UUID) (*LLMProviderConfig, error) {
	row, err := r.q.GetDefaultLLMProvider(ctx, uuidToPg(householdID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get default llm provider: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get default llm provider: %w", err)
	}
	return toLLMProvider(row), nil
}

func (r *pgRepository) ListLLMProviders(ctx context.Context, householdID uuid.UUID) ([]*LLMProviderConfig, error) {
	rows, err := r.q.ListLLMProviders(ctx, uuidToPg(householdID))
	if err != nil {
		return nil, fmt.Errorf("list llm providers: %w", err)
	}
	out := make([]*LLMProviderConfig, len(rows))
	for i, row := range rows {
		out[i] = toLLMProvider(row)
	}
	return out, nil
}

func (r *pgRepository) CreateOCRProvider(ctx context.Context, householdID *uuid.UUID, provider string, endpointURL, apiKeyEncrypted *string, extraConfig *string, isDefault bool) (*OCRProviderConfig, error) {
	row, err := r.q.CreateOCRProviderConfig(ctx, sqlc.CreateOCRProviderConfigParams{
		HouseholdID:     uuidPtrToPg(householdID),
		Provider:        provider,
		EndpointUrl:     endpointURL,
		ApiKeyEncrypted: apiKeyEncrypted,
		ExtraConfig:     strPtrToBytes(extraConfig),
		IsDefault:       isDefault,
	})
	if err != nil {
		return nil, fmt.Errorf("create ocr provider: %w", err)
	}
	return toOCRProvider(row), nil
}

func (r *pgRepository) GetDefaultOCRProvider(ctx context.Context, householdID uuid.UUID) (*OCRProviderConfig, error) {
	row, err := r.q.GetDefaultOCRProvider(ctx, uuidToPg(householdID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get default ocr provider: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get default ocr provider: %w", err)
	}
	return toOCRProvider(row), nil
}

func (r *pgRepository) ListOCRProviders(ctx context.Context, householdID uuid.UUID) ([]*OCRProviderConfig, error) {
	rows, err := r.q.ListOCRProviders(ctx, uuidToPg(householdID))
	if err != nil {
		return nil, fmt.Errorf("list ocr providers: %w", err)
	}
	out := make([]*OCRProviderConfig, len(rows))
	for i, row := range rows {
		out[i] = toOCRProvider(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateLLMProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID, req UpdateLLMProviderRequest) (*LLMProviderConfig, error) {
	params := sqlc.UpdateLLMProviderParams{
		ID:              uuidToPg(id),
		HouseholdID:     uuidPtrToPg(householdID),
		Provider:        req.Provider,
		Model:           req.Model,
		EndpointUrl:     req.EndpointURL,
		ApiKeyEncrypted: req.APIKey,
		IsDefault:       req.IsDefault,
	}

	if !req.IsDefault {
		row, err := r.q.UpdateLLMProvider(ctx, params)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("update llm provider: %w", ErrNotFound)
			}
			return nil, fmt.Errorf("update llm provider: %w", err)
		}
		return toLLMProvider(row), nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("update llm provider: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := r.q.WithTx(tx)
	if err := qtx.UnsetDefaultLLMProviders(ctx, uuidPtrToPg(householdID)); err != nil {
		return nil, fmt.Errorf("update llm provider: unset defaults: %w", err)
	}
	row, err := qtx.UpdateLLMProvider(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update llm provider: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update llm provider: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("update llm provider: commit tx: %w", err)
	}
	return toLLMProvider(row), nil
}

func (r *pgRepository) DeleteLLMProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID) error {
	if err := r.q.DeleteLLMProvider(ctx, sqlc.DeleteLLMProviderParams{
		ID:          uuidToPg(id),
		HouseholdID: uuidPtrToPg(householdID),
	}); err != nil {
		return fmt.Errorf("delete llm provider: %w", err)
	}
	return nil
}

func (r *pgRepository) UpdateOCRProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID, req UpdateOCRProviderRequest) (*OCRProviderConfig, error) {
	params := sqlc.UpdateOCRProviderParams{
		ID:              uuidToPg(id),
		HouseholdID:     uuidPtrToPg(householdID),
		Provider:        req.Provider,
		EndpointUrl:     req.EndpointURL,
		ApiKeyEncrypted: req.APIKey,
		ExtraConfig:     strPtrToBytes(req.ExtraConfig),
		IsDefault:       req.IsDefault,
	}

	if !req.IsDefault {
		row, err := r.q.UpdateOCRProvider(ctx, params)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("update ocr provider: %w", ErrNotFound)
			}
			return nil, fmt.Errorf("update ocr provider: %w", err)
		}
		return toOCRProvider(row), nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("update ocr provider: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := r.q.WithTx(tx)
	if err := qtx.UnsetDefaultOCRProviders(ctx, uuidPtrToPg(householdID)); err != nil {
		return nil, fmt.Errorf("update ocr provider: unset defaults: %w", err)
	}
	row, err := qtx.UpdateOCRProvider(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update ocr provider: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update ocr provider: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("update ocr provider: commit tx: %w", err)
	}
	return toOCRProvider(row), nil
}

func (r *pgRepository) DeleteOCRProvider(ctx context.Context, id uuid.UUID, householdID *uuid.UUID) error {
	if err := r.q.DeleteOCRProvider(ctx, sqlc.DeleteOCRProviderParams{
		ID:          uuidToPg(id),
		HouseholdID: uuidPtrToPg(householdID),
	}); err != nil {
		return fmt.Errorf("delete ocr provider: %w", err)
	}
	return nil
}
