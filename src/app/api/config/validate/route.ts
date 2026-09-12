import { apiError } from "@/lib/auth";
import { validateYaml } from "@/lib/config/loader";
import { authorizeConfig, yamlBody } from "../access";
export async function POST(request: Request) { try { const project = new URL(request.url).searchParams.get("project"); await authorizeConfig(project); const result = validateYaml(await yamlBody(request), { project: Boolean(project), env: process.env }); return Response.json(result, { status: result.valid ? 200 : 400 }); } catch (error) { return apiError(error); } }
