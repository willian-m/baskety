-- +goose Up
-- +goose StatementBegin
CREATE TABLE receipt_scans (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid        NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    uploaded_by  uuid        NOT NULL REFERENCES users (id),
    status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'review', 'committed', 'failed')),
    raw_text     text,
    store_name   text,
    scanned_at   date,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    updated_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipt_scans_household_id ON receipt_scans (household_id);
CREATE INDEX idx_receipt_scans_uploaded_by  ON receipt_scans (uploaded_by);
CREATE INDEX idx_receipt_scans_status       ON receipt_scans (status);

CREATE TABLE receipt_scan_items (
    id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id           uuid           NOT NULL REFERENCES receipt_scans (id) ON DELETE CASCADE,
    raw_name          text           NOT NULL,
    resolved_name     text,
    quantity          numeric(10,3),
    unit              text,
    unit_price        numeric(12,2),
    total_price       numeric(12,2),
    brand             text,
    inventory_item_id uuid           REFERENCES inventory_items (id) ON DELETE SET NULL,
    accepted          boolean,
    created_at        timestamptz    NOT NULL DEFAULT NOW(),
    updated_at        timestamptz    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipt_scan_items_scan_id           ON receipt_scan_items (scan_id);
CREATE INDEX idx_receipt_scan_items_inventory_item_id ON receipt_scan_items (inventory_item_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS receipt_scan_items;
DROP TABLE IF EXISTS receipt_scans;
-- +goose StatementEnd
