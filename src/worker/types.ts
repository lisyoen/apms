export type TaskSpec = {
  id: string;
  projectId: string;
  userSlug: string;
  projectSlug: string;
  projectName: string;
  filename: string;
  title: string;
  body: string;
  preTask: string | null;
  nextTask: string | null;
  timeoutMin: number;
};

export type RunContext = {
  cwd: string;
  env: Record<string, string | undefined>;
  guide: string;
  reportPath: string;
  startedAt: Date;
  onSpawn?: (pid: number) => Promise<void> | void;
};

export type RunResult = {
  exitCode: number | null;
  pid: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  failureReason?: string;
};

export interface WorkerRunner {
  readonly type: "opencode" | "dummy";
  available(): Promise<boolean>;
  run(task: TaskSpec, ctx: RunContext): Promise<RunResult>;
}
