-- +goose Up
-- +goose StatementBegin
-- Background job queue table. The Sprint 6 spec targets River for the job store,
-- but to avoid coupling to River's full (and version-specific) schema, this sprint
-- ships an in-process goroutine-based job queue. This table records enqueued jobs
-- for durability/observability so a future River migration can adopt the same data.
-- TODO(sprint-7+): migrate to River's official schema and driver (riverpgxv5).
CREATE TABLE background_jobs (
    id           bigserial PRIMARY KEY,
    kind         text NOT NULL,
    args         jsonb NOT NULL DEFAULT '{}',
    state        text NOT NULL DEFAULT 'available',
    attempt      smallint NOT NULL DEFAULT 0,
    max_attempts smallint NOT NULL DEFAULT 3,
    last_error   text,
    created_at   timestamptz NOT NULL DEFAULT NOW(),
    finalized_at timestamptz
);
CREATE INDEX idx_background_jobs_kind ON background_jobs (kind);
CREATE INDEX idx_background_jobs_state ON background_jobs (state);
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS background_jobs;
-- +goose StatementEnd
