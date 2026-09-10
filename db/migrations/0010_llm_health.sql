ALTER TABLE llm_connections ADD COLUMN IF NOT EXISTS last_check_at timestamptz;
ALTER TABLE llm_connections ADD COLUMN IF NOT EXISTS last_ok boolean;
ALTER TABLE llm_connections ADD COLUMN IF NOT EXISTS last_error text;
