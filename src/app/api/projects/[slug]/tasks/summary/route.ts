import { readdir } from "node:fs/promises";
import path from "node:path";
import { ownedProject } from "@/lib/api";
import { db } from "@/lib/db";
import { projectRoot } from "@/lib/storage";

export async function GET(_: Request, { params }: RouteContext<"/api/projects/[slug]/tasks/summary">) {
  const { slug } = await params;
  const own = await ownedProject(slug);
  if ("error" in own) return own.error;
  const [counts, reportNames] = await Promise.all([
    db.query("SELECT status::text status,count(*)::int count FROM tasks WHERE project_id=$1 GROUP BY status", [own.project.id]),
    readdir(path.join(projectRoot(own.user.storageSlug, slug), "tasks", "reports")).catch(() => []),
  ]);
  const summary = { pending: 0, in_progress: 0, done: 0, failed: 0, reports: 0 };
  for (const row of counts.rows) {
    const key = row.status === "in-progress" ? "in_progress" : row.status;
    if (key in summary) summary[key as keyof typeof summary] = row.count;
  }
  summary.reports = reportNames.filter((name) => /^\d{8}-\d{3}-report\.md$/.test(name)).length;
  return Response.json(summary);
}
