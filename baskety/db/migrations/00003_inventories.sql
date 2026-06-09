-- +goose Up
-- +goose StatementBegin
CREATE TABLE inventories (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid        NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    description  text,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventories_household_id ON inventories (household_id);

CREATE TABLE inventory_permissions (
    inventory_id uuid NOT NULL REFERENCES inventories (id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    permission   text NOT NULL CHECK (permission IN ('full', 'read_only', 'deny')),
    PRIMARY KEY (inventory_id, user_id)
);

CREATE INDEX idx_inventory_permissions_inventory_id ON inventory_permissions (inventory_id);
CREATE INDEX idx_inventory_permissions_user_id      ON inventory_permissions (user_id);

CREATE TABLE inventory_items (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id    uuid          NOT NULL REFERENCES inventories (id) ON DELETE CASCADE,
    name            text          NOT NULL,
    category        text,
    unit            text,
    target_quantity numeric(10,3) NOT NULL DEFAULT 0,
    notes           text,
    deleted_at      timestamptz,
    created_at      timestamptz   NOT NULL DEFAULT NOW(),
    updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_items_inventory_id ON inventory_items (inventory_id);
CREATE INDEX idx_inventory_items_category     ON inventory_items (category);

CREATE TABLE inventory_batches (
    id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id    uuid          NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
    quantity   numeric(10,3) NOT NULL,
    expires_at timestamptz,
    added_at   timestamptz   NOT NULL DEFAULT NOW(),
    emptied_at timestamptz,
    notes      text,
    created_at timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_batches_item_id    ON inventory_batches (item_id);
CREATE INDEX idx_inventory_batches_expires_at ON inventory_batches (expires_at);
CREATE INDEX idx_inventory_batches_item_active ON inventory_batches (item_id) WHERE emptied_at IS NULL;

CREATE TABLE inventory_share_links (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id       uuid        NOT NULL REFERENCES inventories (id) ON DELETE CASCADE,
    token              text        NOT NULL UNIQUE,
    created_by_user_id uuid        NOT NULL REFERENCES users (id),
    password_hash      text,
    expires_at         timestamptz,
    revoked_at         timestamptz,
    created_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_share_links_inventory_id ON inventory_share_links (inventory_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS inventory_share_links;
DROP TABLE IF EXISTS inventory_batches;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS inventory_permissions;
DROP TABLE IF EXISTS inventories;
-- +goose StatementEnd
