-- +goose Up
-- +goose StatementBegin
CREATE TABLE inventories (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid        NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventories_household_id ON inventories (household_id);

CREATE TABLE inventory_permissions (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id uuid        NOT NULL REFERENCES inventories (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    permission   text        NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
    granted_at   timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE (inventory_id, user_id)
);

CREATE INDEX idx_inventory_permissions_inventory_id ON inventory_permissions (inventory_id);
CREATE INDEX idx_inventory_permissions_user_id      ON inventory_permissions (user_id);

CREATE TABLE inventory_items (
    id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id     uuid           NOT NULL REFERENCES inventories (id) ON DELETE CASCADE,
    name             text           NOT NULL,
    category         text,
    unit             text,
    target_quantity  numeric(10,3)  NOT NULL DEFAULT 0,
    current_quantity numeric(10,3)  NOT NULL DEFAULT 0,
    min_threshold    numeric(10,3),
    created_at       timestamptz    NOT NULL DEFAULT NOW(),
    updated_at       timestamptz    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_items_inventory_id ON inventory_items (inventory_id);
CREATE INDEX idx_inventory_items_category     ON inventory_items (category);

CREATE TABLE inventory_batches (
    id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id      uuid           NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
    quantity     numeric(10,3)  NOT NULL,
    expires_at   date,
    purchased_at date,
    notes        text,
    created_at   timestamptz    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_batches_item_id    ON inventory_batches (item_id);
CREATE INDEX idx_inventory_batches_expires_at ON inventory_batches (expires_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS inventory_batches;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS inventory_permissions;
DROP TABLE IF EXISTS inventories;
-- +goose StatementEnd
