ALTER TABLE projects ADD COLUMN IF NOT EXISTS view_mode text NOT NULL DEFAULT 'card';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeout_min integer NOT NULL DEFAULT 20;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_filename_idx ON tasks(project_id, filename);
CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_links_token_expiry_idx ON share_links(token, expires_at);
