import { requireAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertSlug } from "@/lib/storage";

export async function authorizeConfig(project?: string | null) {
  if (!project) return requireAdmin();
  assertSlug(project);
  const user = await requireUser();
  const result = await db.query("SELECT id FROM projects WHERE slug=$1 AND owner_id=$2 AND archived_at IS NULL", [project, user.id]);
  if (!result.rowCount) throw new Response("Forbidden", { status: 403 });
  return user;
}

export async function yamlBody(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) return String((await request.json()).yaml ?? "");
  return request.text();
}
