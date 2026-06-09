-- +goose Up
-- +goose StatementBegin
CREATE TABLE stores (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid        REFERENCES households (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    address      text,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_household_id ON stores (household_id);

CREATE TABLE catalog_entries (
    id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id      uuid           NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    inventory_item_id uuid           NOT NULL REFERENCES inventory_items (id) ON DELETE CASCADE,
    store_id          uuid           REFERENCES stores (id) ON DELETE SET NULL,
    brand             text,
    unit_price        numeric(12,2),
    currency          char(3)        NOT NULL DEFAULT 'USD',
    observed_at       timestamptz    NOT NULL,
    created_at        timestamptz    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_catalog_entries_household_id      ON catalog_entries (household_id);
CREATE INDEX idx_catalog_entries_inventory_item_id ON catalog_entries (inventory_item_id);
CREATE INDEX idx_catalog_entries_store_id          ON catalog_entries (store_id);
CREATE INDEX idx_catalog_entries_observed_at       ON catalog_entries (observed_at);

CREATE TABLE purchase_transactions (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    uuid           NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    store_id        uuid           REFERENCES stores (id) ON DELETE SET NULL,
    receipt_scan_id uuid           REFERENCES receipt_scans (id) ON DELETE SET NULL,
    purchased_at    date           NOT NULL,
    total_amount    numeric(12,2),
    currency        char(3)        NOT NULL DEFAULT 'USD',
    created_at      timestamptz    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_transactions_household_id    ON purchase_transactions (household_id);
CREATE INDEX idx_purchase_transactions_store_id        ON purchase_transactions (store_id);
CREATE INDEX idx_purchase_transactions_receipt_scan_id ON purchase_transactions (receipt_scan_id);
CREATE INDEX idx_purchase_transactions_purchased_at    ON purchase_transactions (purchased_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS purchase_transactions;
DROP TABLE IF EXISTS catalog_entries;
DROP TABLE IF EXISTS stores;
-- +goose StatementEnd
