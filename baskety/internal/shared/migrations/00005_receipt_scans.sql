-- +goose Up
-- +goose StatementBegin
CREATE TABLE receipt_scans (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id        uuid        NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    grocery_list_id     uuid        REFERENCES grocery_lists (id) ON DELETE SET NULL,
    raw_image_path      text        NOT NULL,
    ocr_text            text,
    llm_raw_response    text,
    status              text        NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'ocr_processing', 'llm_processing', 'pending_review', 'committed', 'failed')),
    error_message       text,
    created_by_user_id  uuid        NOT NULL REFERENCES users (id),
    created_at          timestamptz NOT NULL DEFAULT NOW(),
    updated_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipt_scans_household_id ON receipt_scans (household_id);
CREATE INDEX idx_receipt_scans_created_by   ON receipt_scans (created_by_user_id);
CREATE INDEX idx_receipt_scans_status       ON receipt_scans (status);

CREATE TABLE receipt_scan_items (
    id                            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_scan_id               uuid          NOT NULL REFERENCES receipt_scans (id) ON DELETE CASCADE,
    raw_text                      text          NOT NULL,
    parsed_name                   text,
    parsed_brand                  text,
    parsed_quantity               numeric(10,3),
    parsed_unit                   text,
    parsed_price_per_unit_minor   bigint,
    parsed_currency               char(3),
    parsed_store_name             text,
    confidence_score              numeric,
    status                        text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'corrected')),
    inventory_item_id             uuid          REFERENCES inventory_items (id) ON DELETE SET NULL,
    corrected_name                text,
    corrected_brand               text,
    corrected_quantity            numeric(10,3),
    corrected_price_per_unit_minor bigint,
    corrected_currency            char(3),
    corrected_store_name          text,
    created_at                    timestamptz   NOT NULL DEFAULT NOW(),
    updated_at                    timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipt_scan_items_receipt_scan_id   ON receipt_scan_items (receipt_scan_id);
CREATE INDEX idx_receipt_scan_items_inventory_item_id ON receipt_scan_items (inventory_item_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS receipt_scan_items;
DROP TABLE IF EXISTS receipt_scans;
-- +goose StatementEnd
