import { apiError, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDefaultLlmStatus, LLM_HEALTH_MESSAGES } from "@/lib/llm/health";

export async function GET() {
  try {
    const user = await requireUser();
    let status = await getDefaultLlmStatus(db);
    if (status.connection_id && Date.now() - new Date(status.checked_at).getTime() > 60_000)
      status = await getDefaultLlmStatus(db, true);
    return Response.json({
      ...status,
      message: LLM_HEALTH_MESSAGES[status.reason],
      is_admin: user.role === "admin",
    });
  } catch (error) {
    return apiError(error);
  }
}
