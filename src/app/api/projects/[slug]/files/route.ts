import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { ownedProject, jsonError } from "@/lib/api";
import { projectRoot } from "@/lib/storage/index";

const CONTENT_TYPES:Record<string,string>={".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".webp":"image/webp",".svg":"image/svg+xml",".avif":"image/avif"};

export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const own=await ownedProject(slug);if("error" in own)return own.error;
  const relative=new URL(request.url).searchParams.get("path")||"";
  if(!relative||relative.includes("\0")||path.isAbsolute(relative)||relative.split(/[\\/]/).includes(".."))return jsonError("path_escape",403);
  const normalized=relative.replaceAll("\\","/");if(!/^(?:docs|tasks)\//.test(normalized))return jsonError("path_not_allowed",403);
  const root=projectRoot(own.user.storageSlug,slug);const target=path.resolve(root,normalized);
  if(!target.startsWith(`${root}${path.sep}`))return jsonError("path_escape",403);
  try{const [canonicalRoot,canonicalTarget,info]=await Promise.all([realpath(root),realpath(target),stat(target)]);if(!canonicalTarget.startsWith(`${canonicalRoot}${path.sep}`)||!info.isFile())return jsonError("path_escape",403);const type=CONTENT_TYPES[path.extname(target).toLowerCase()];if(!type)return jsonError("unsupported_file",415);return new Response(await readFile(canonicalTarget),{headers:{"Content-Type":type,"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff"}})}catch{return jsonError("not_found",404)}
}
