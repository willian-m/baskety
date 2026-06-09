-- +goose Up
-- +goose StatementBegin
CREATE TABLE stores (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name               text        NOT NULL,
    chain_name         text,
    address            text,
    canonical_store_id uuid        REFERENCES stores (id) ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT NOW(),
    updated_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE catalog_entries (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name               text        NOT NULL,
    brand              text,
    unit               text,
    category           text,
    scope              text        NOT NULL DEFAULT 'private' CHECK (scope IN ('public', 'private')),
    household_id       uuid        REFERENCES households (id) ON DELETE CASCADE,
    canonical_entry_id uuid        REFERENCES catalog_entries (id) ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT NOW(),
    updated_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalog_entries_household_id ON catalog_entries (household_id);
CREATE INDEX idx_catalog_entries_scope        ON catalog_entries (scope);

CREATE TABLE purchase_transactions (
    id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id         uuid          NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    store_id             uuid          REFERENCES stores (id) ON DELETE SET NULL,
    grocery_list_item_id uuid          REFERENCES grocery_list_items (id) ON DELETE SET NULL,
    receipt_scan_item_id uuid          REFERENCES receipt_scan_items (id) ON DELETE SET NULL,
    catalog_entry_id     uuid          REFERENCES catalog_entries (id) ON DELETE SET NULL,
    price_per_unit_minor bigint,
    currency             char(3)       NOT NULL DEFAULT 'USD',
    quantity             numeric(10,3),
    purchased_at         timestamptz   NOT NULL,
    created_at           timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_transactions_household_id         ON purchase_transactions (household_id);
CREATE INDEX idx_purchase_transactions_store_id             ON purchase_transactions (store_id);
CREATE INDEX idx_purchase_transactions_grocery_list_item_id ON purchase_transactions (grocery_list_item_id);
CREATE INDEX idx_purchase_transactions_receipt_scan_item_id ON purchase_transactions (receipt_scan_item_id);
CREATE INDEX idx_purchase_transactions_catalog_entry_id     ON purchase_transactions (catalog_entry_id);
CREATE INDEX idx_purchase_transactions_purchased_at         ON purchase_transactions (purchased_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS purchase_transactions;
DROP TABLE IF EXISTS catalog_entries;
DROP TABLE IF EXISTS stores;
-- +goose StatementEnd
