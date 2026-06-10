-- +goose Up
-- +goose StatementBegin
-- Enable pg_cron extension (requires superuser; skip if not available)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_cron not available, skipping cron job registration';
END $$;

-- Schedule jobs only when pg_cron is actually present, so dev/CI environments
-- without the extension still migrate cleanly.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Purge expired sessions daily at 3am
    PERFORM cron.schedule_in_database('purge-expired-sessions', '0 3 * * *', current_database(),
      'DELETE FROM sessions WHERE expires_at < NOW()');

    -- Purge emptied inventory batches older than 90 days weekly on Sunday at 4am
    PERFORM cron.schedule_in_database('purge-emptied-batches', '0 4 * * 0', current_database(),
      'DELETE FROM inventory_batches WHERE emptied_at IS NOT NULL AND emptied_at < NOW() - INTERVAL ''90 days''');

    -- Archive completed grocery lists older than 30 days daily at 3:30am
    PERFORM cron.schedule_in_database('archive-completed-lists', '30 3 * * *', current_database(),
      'UPDATE grocery_lists SET status = ''archived'', updated_at = NOW() WHERE status = ''completed'' AND completed_at < NOW() - INTERVAL ''30 days''');
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-expired-sessions');
    PERFORM cron.unschedule('purge-emptied-batches');
    PERFORM cron.unschedule('archive-completed-lists');
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
-- +goose StatementEnd
