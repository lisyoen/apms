ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS view_mode text NOT NULL DEFAULT 'card';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeout_min integer NOT NULL DEFAULT 20;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_hash text;

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '새 대화',
  context_tokens bigint NOT NULL DEFAULT 0 CHECK (context_tokens >= 0),
  context_limit bigint NOT NULL DEFAULT 100000 CHECK (context_limit > 0),
  context_ratio numeric(5,4) NOT NULL DEFAULT 0 CHECK (context_ratio BETWEEN 0 AND 1),
  parent_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','handed_over','closed')),
  handover_summary text,
  created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_session_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content text NOT NULL, tokens bigint NOT NULL DEFAULT 0 CHECK (tokens >= 0), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS llm_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, provider text NOT NULL CHECK (provider IN ('openai','compatible','anthropic')),
  base_url text NOT NULL, model text NOT NULL, api_key_enc text NOT NULL, api_key_hint text,
  context_window integer NOT NULL DEFAULT 100000 CHECK (context_window > 0), is_default boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true, created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS llm_connections_scope_name ON llm_connections (coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
CREATE UNIQUE INDEX IF NOT EXISTS llm_connections_one_default ON llm_connections ((is_default)) WHERE is_default AND owner_id IS NULL;
CREATE TABLE IF NOT EXISTS usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL, session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES llm_connections(id) ON DELETE SET NULL, model text NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0), output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cached_tokens bigint NOT NULL DEFAULT 0 CHECK (cached_tokens >= 0), cost numeric(18,8), currency char(3) NOT NULL DEFAULT 'USD',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL CHECK (scope IN ('user','global')),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE, key text NOT NULL, value jsonb NOT NULL,
  encrypted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope='user' AND user_id IS NOT NULL) OR (scope='global' AND user_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS settings_user_key ON settings (user_id,key) WHERE scope='user';
CREATE UNIQUE INDEX IF NOT EXISTS settings_global_key ON settings (key) WHERE scope='global';
CREATE INDEX IF NOT EXISTS sessions_user_created ON sessions(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_session_created ON messages(session_id,created_at);
CREATE INDEX IF NOT EXISTS usage_user_date ON usage(user_id,occurred_at);
CREATE INDEX IF NOT EXISTS usage_project_date ON usage(project_id,occurred_at);
