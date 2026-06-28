-- +goose Up
-- +goose StatementBegin
ALTER TABLE receipt_scan_items
    ADD COLUMN parsed_total_price_minor    bigint,
    ADD COLUMN corrected_total_price_minor bigint,
    ADD COLUMN corrected_unit              text;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE receipt_scan_items
    DROP COLUMN parsed_total_price_minor,
    DROP COLUMN corrected_total_price_minor,
    DROP COLUMN corrected_unit;
-- +goose StatementEnd
