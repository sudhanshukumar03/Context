-- Disable ingestion and preserve new key/event records before rollback.
DROP INDEX service_events_org_external_unique;
ALTER TABLE service_events DROP COLUMN external_id;
DROP TABLE webhook_keys;
