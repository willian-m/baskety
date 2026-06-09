-- +goose Up
-- +goose StatementBegin
CREATE TABLE grocery_lists (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id        uuid        NOT NULL REFERENCES inventories (id) ON DELETE CASCADE,
    name                text        NOT NULL,
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_by_user_id  uuid        NOT NULL REFERENCES users (id),
    completed_at        timestamptz,
    pinned_at           timestamptz,
    expires_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    updated_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grocery_lists_inventory_id ON grocery_lists (inventory_id);
CREATE INDEX idx_grocery_lists_status       ON grocery_lists (status);

CREATE TABLE grocery_list_items (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    grocery_list_id   uuid          NOT NULL REFERENCES grocery_lists (id) ON DELETE CASCADE,
    inventory_item_id uuid          REFERENCES inventory_items (id) ON DELETE SET NULL,
    name              text          NOT NULL,
    quantity          numeric(10,3) NOT NULL DEFAULT 1,
    unit              text,
    notes             text,
    status            text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'bought', 'skipped')),
    sort_order        integer       NOT NULL DEFAULT 0,
    created_at        timestamptz   NOT NULL DEFAULT NOW(),
    updated_at        timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grocery_list_items_grocery_list_id   ON grocery_list_items (grocery_list_id);
CREATE INDEX idx_grocery_list_items_inventory_item_id ON grocery_list_items (inventory_item_id);
CREATE INDEX idx_grocery_list_items_status            ON grocery_list_items (status);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS grocery_list_items;
DROP TABLE IF EXISTS grocery_lists;
-- +goose StatementEnd
