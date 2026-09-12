import { apiError } from "@/lib/auth";
import { diffConfig } from "@/lib/config/diff";
import { validateYaml } from "@/lib/config/loader";
import { authorizeConfig, yamlBody } from "../access";
export async function POST(request: Request) { try { const project = new URL(request.url).searchParams.get("project"); await authorizeConfig(project); const yaml = await yamlBody(request); const validation = validateYaml(yaml, { project: Boolean(project), env: process.env }); if (!validation.valid) return Response.json({ error: "validation_failed", errors: validation.errors, warnings: validation.warnings }, { status: 400 }); return Response.json({ changes: diffConfig(yaml, { project: project ?? undefined }), warnings: validation.warnings }); } catch (error) { return apiError(error); } }
