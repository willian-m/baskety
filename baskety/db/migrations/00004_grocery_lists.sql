-- +goose Up
-- +goose StatementBegin
CREATE TABLE grocery_lists (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid        NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    status       text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by   uuid        NOT NULL REFERENCES users (id),
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grocery_lists_household_id ON grocery_lists (household_id);
CREATE INDEX idx_grocery_lists_status       ON grocery_lists (status);

CREATE TABLE grocery_list_items (
    id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id           uuid           NOT NULL REFERENCES grocery_lists (id) ON DELETE CASCADE,
    item_name         text           NOT NULL,
    quantity          numeric(10,3)  NOT NULL DEFAULT 1,
    unit              text,
    inventory_item_id uuid           REFERENCES inventory_items (id) ON DELETE SET NULL,
    notes             text,
    checked           boolean        NOT NULL DEFAULT false,
    created_at        timestamptz    NOT NULL DEFAULT NOW(),
    updated_at        timestamptz    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grocery_list_items_list_id           ON grocery_list_items (list_id);
CREATE INDEX idx_grocery_list_items_inventory_item_id ON grocery_list_items (inventory_item_id);
CREATE INDEX idx_grocery_list_items_checked           ON grocery_list_items (checked);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS grocery_list_items;
DROP TABLE IF EXISTS grocery_lists;
-- +goose StatementEnd
