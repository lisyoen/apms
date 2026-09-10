import { apiError, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

async function ownedSession(id: string, userId: string) {
  const result = await db.query("SELECT * FROM sessions WHERE id=$1", [id]);
  if (!result.rows[0]) return { error: new Response("Not found", { status: 404 }) };
  if (result.rows[0].user_id !== userId) return { error: new Response("Forbidden", { status: 403 }) };
  return { session: result.rows[0] };
}

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const owned = await ownedSession(id, user.id);
    if (owned.error) return owned.error;
    const messages = await db.query(
      "SELECT id,role,content,tokens,metadata,created_at FROM messages WHERE session_id=$1 AND role<>'system' ORDER BY created_at",
      [id],
    );
    const continuation = await db.query(
      `WITH RECURSIVE ancestors AS (
         SELECT id,parent_session_id,1 AS depth FROM sessions WHERE id=$1
         UNION ALL SELECT s.id,s.parent_session_id,a.depth+1 FROM sessions s JOIN ancestors a ON s.id=a.parent_session_id
       ) SELECT child.id,child.title,child.created_at,(SELECT max(depth)+1 FROM ancestors) handover_number
       FROM sessions child WHERE child.parent_session_id=$1 ORDER BY child.created_at LIMIT 1`,
      [id],
    );
    return Response.json({ session: { ...owned.session, continuation: continuation.rows[0] || null }, messages: messages.rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const owned = await ownedSession(id, user.id);
    if (owned.error) return owned.error;
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    if (!title) return Response.json({ error: "title이 필요합니다." }, { status: 400 });
    const result = await db.query("UPDATE sessions SET title=$2 WHERE id=$1 RETURNING *", [id, title]);
    return Response.json(result.rows[0]);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const owned = await ownedSession(id, user.id);
    if (owned.error) return owned.error;
    await db.query("DELETE FROM sessions WHERE id=$1", [id]);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
