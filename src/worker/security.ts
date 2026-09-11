import { chmod, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { dataRoot } from "../lib/storage/index";

function contains(root: string, target: string) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export async function resolveRunWorkdir(base: string, project: string, configured?: string) {
  const requested = configured ? path.resolve(configured) : path.join(base, "workspace");
  const roots = [dataRoot(), ...(process.env.DIRIGO_WORKDIR_ALLOWLIST || "").split(path.delimiter).filter(Boolean)];
  if (roots.some((root) => !path.isAbsolute(root))) throw new Error("workdir allowlist entries must be absolute paths");
  if (!roots.some((root) => contains(path.resolve(root), requested))) {
    throw new Error(`workdir outside DIRIGO_DATA_ROOT or DIRIGO_WORKDIR_ALLOWLIST: ${project}`);
  }
  await Promise.all(roots.map((root) => mkdir(root, { recursive: true, mode: 0o700 })));
  await mkdir(requested, { recursive: true, mode: 0o700 });
  const [target, ...allowed] = await Promise.all([realpath(requested), ...roots.map((root) => realpath(root))]);
  if (!allowed.some((root) => contains(root, target))) {
    throw new Error(`workdir outside DIRIGO_DATA_ROOT or DIRIGO_WORKDIR_ALLOWLIST: ${project}`);
  }
  return target;
}

export async function buildRunEnv(user: string, project: string, run: string): Promise<Record<string, string | undefined>> {
  const root = path.join(dataRoot(), user, ".opencode");
  const directories = {
    HOME: root,
    XDG_DATA_HOME: path.join(root, "data"),
    XDG_CONFIG_HOME: path.join(root, "config"),
    XDG_CACHE_HOME: path.join(root, "cache"),
  };
  await Promise.all(Object.values(directories).map(async (directory) => { await mkdir(directory, { recursive: true, mode: 0o700 }); await chmod(directory, 0o700); }));
  const env: Record<string, string | undefined> = { ...directories, DIRIGO_USER: user, DIRIGO_PROJECT: project, DIRIGO_RUN: run };
  for (const key of ["PATH", "LANG", "TZ"] as const) if (process.env[key]) env[key] = process.env[key];
  return env;
}
