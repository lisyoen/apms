import { apiError, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const slug = new URL(req.url).searchParams.get("project_slug");
    const values: unknown[] = [user.id];
    let where = "s.user_id=$1";
    if (slug) {
      values.push(slug);
      where += " AND p.slug=$2";
    } else {
      where += " AND s.project_id IS NULL";
    }
    const result = await db.query(
      `SELECT s.*, p.name project_name, p.slug project_slug,
        coalesce(last_message.created_at, s.created_at) last_message_at,
        continuation.id continuation_id
       FROM sessions s
       LEFT JOIN projects p ON p.id=s.project_id
       LEFT JOIN LATERAL (
         SELECT created_at FROM messages WHERE session_id=s.id ORDER BY created_at DESC LIMIT 1
       ) last_message ON true
       LEFT JOIN sessions continuation ON continuation.parent_session_id=s.id
       WHERE ${where}
       ORDER BY coalesce(last_message.created_at, s.created_at) DESC`,
      values,
    );
    return Response.json({ items: result.rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    let limit = 100000;
    let projectId = body.project_id || null;
    if (body.project_slug) {
      const project = await db.query(
        "SELECT id FROM projects WHERE slug=$1 AND owner_id=$2 AND archived_at IS NULL",
        [body.project_slug, user.id],
      );
      if (!project.rowCount) return Response.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
      projectId = project.rows[0].id;
    } else if (projectId) {
      const own = await db.query("SELECT id FROM projects WHERE id=$1 AND owner_id=$2", [projectId, user.id]);
      if (!own.rowCount) return Response.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }
    const connection = await db.query(
      "SELECT context_window FROM llm_connections WHERE enabled AND is_default ORDER BY updated_at DESC LIMIT 1",
    );
    if (connection.rows[0]) limit = connection.rows[0].context_window;
    const result = await db.query(
      "INSERT INTO sessions(user_id,project_id,title,context_limit) VALUES($1,$2,$3,$4) RETURNING *",
      [user.id, projectId, String(body.title || "새 대화").trim().slice(0, 120) || "새 대화", limit],
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
