ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_project_filename_key ON tasks(project_id, filename);

CREATE TABLE IF NOT EXISTS task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  runner_type text NOT NULL,
  status text NOT NULL,
  pid integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  exit_code integer,
  log_path text,
  failure_reason text,
  UNIQUE(task_id, attempt)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  kind text NOT NULL DEFAULT 'project-complete',
  status text NOT NULL DEFAULT 'pending',
  subject text NOT NULL,
  body text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS scheduler_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  heartbeat_at timestamptz NOT NULL,
  max_workers integer NOT NULL,
  pid integer NOT NULL
);
