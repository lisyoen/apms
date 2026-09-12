import { apiError } from "@/lib/auth";
import { getConfig } from "@/lib/config/loader";
import { authorizeConfig } from "../access";
export async function GET(request: Request) { try { const project = new URL(request.url).searchParams.get("project"); await authorizeConfig(project); const value = getConfig({ project: project ?? undefined }); return new Response(value.raw, { headers: { "content-type": "application/yaml; charset=utf-8", etag: `"${value.hash}"`, "cache-control": "no-store" } }); } catch (error) { return apiError(error); } }
