-- +goose Up
-- +goose StatementBegin
CREATE TABLE households (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text        NOT NULL,
    created_by uuid        NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_households_created_by ON households (created_by);

CREATE TABLE household_members (
    household_id        uuid        NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    user_id             uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role                text        NOT NULL CHECK (role IN ('owner', 'member', 'guest')),
    joined_at           timestamptz NOT NULL DEFAULT NOW(),
    invited_by_user_id  uuid        REFERENCES users (id) ON DELETE SET NULL,
    expires_at          timestamptz,
    revoked_at          timestamptz,
    PRIMARY KEY (household_id, user_id)
);

CREATE INDEX idx_household_members_household_id ON household_members (household_id);
CREATE INDEX idx_household_members_user_id      ON household_members (user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS household_members;
DROP TABLE IF EXISTS households;
-- +goose StatementEnd
