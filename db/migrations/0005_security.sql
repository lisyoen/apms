ALTER TABLE users ADD COLUMN IF NOT EXISTS slug text;

WITH bases AS (
  SELECT id,
         coalesce(nullif(trim(both '-' from regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9]+', '-', 'g')), ''), 'user') AS base,
         row_number() OVER (PARTITION BY coalesce(nullif(trim(both '-' from regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9]+', '-', 'g')), ''), 'user') ORDER BY created_at, id) AS collision
  FROM users WHERE slug IS NULL
)
UPDATE users u SET slug = left(b.base, CASE WHEN b.collision = 1 THEN 63 ELSE 58 END) || CASE WHEN b.collision = 1 THEN '' ELSE '-' || b.collision END
FROM bases b WHERE u.id = b.id;

CREATE OR REPLACE FUNCTION apms_assign_user_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base text; candidate text; suffix integer := 1;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN RAISE EXCEPTION 'users.slug is immutable'; END IF;
  IF NEW.slug IS NOT NULL THEN RETURN NEW; END IF;
  base := coalesce(nullif(trim(both '-' from regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9]+', '-', 'g')), ''), 'user');
  candidate := left(base, 63);
  WHILE EXISTS (SELECT 1 FROM users WHERE slug = candidate) LOOP suffix := suffix + 1; candidate := left(base, 58) || '-' || suffix; END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS users_assign_slug ON users;
CREATE TRIGGER users_assign_slug BEFORE INSERT OR UPDATE OF slug ON users FOR EACH ROW EXECUTE FUNCTION apms_assign_user_slug();
ALTER TABLE users ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_slug_key ON users(slug);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE task_runs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
ALTER TABLE task_runs ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE scheduler_state ADD COLUMN IF NOT EXISTS leader_pid integer;

CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY, email text NOT NULL, ip text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false, attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx ON login_attempts(lower(email), ip, attempted_at DESC);
