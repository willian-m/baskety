-- +goose Up
-- +goose StatementBegin
CREATE TABLE system_settings (
    key        text        PRIMARY KEY,
    value      text        NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE household_settings (
    household_id uuid        NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    key          text        NOT NULL,
    value        text        NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (household_id, key)
);

CREATE INDEX idx_household_settings_household_id ON household_settings (household_id);

CREATE TABLE user_settings (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key        text        NOT NULL,
    value      text        NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);

CREATE INDEX idx_user_settings_user_id ON user_settings (user_id);

CREATE TABLE llm_provider_configs (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid        REFERENCES households (id) ON DELETE CASCADE,
    provider     text        NOT NULL,
    model        text        NOT NULL,
    endpoint     text,
    api_key_ref  text,
    is_default   boolean     NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_provider_configs_household_id ON llm_provider_configs (household_id);

CREATE TABLE ocr_provider_configs (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid        REFERENCES households (id) ON DELETE CASCADE,
    provider     text        NOT NULL,
    endpoint     text,
    api_key_ref  text,
    is_default   boolean     NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ocr_provider_configs_household_id ON ocr_provider_configs (household_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS ocr_provider_configs;
DROP TABLE IF EXISTS llm_provider_configs;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS household_settings;
DROP TABLE IF EXISTS system_settings;
-- +goose StatementEnd
