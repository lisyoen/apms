import { db } from "@/lib/db";
import { contentHash,createTaskFile,DOC_KINDS,initializeProject,readDocument,slugify,writeDocument,type DocKind,type Frontmatter } from "@/lib/storage";
function isDocKind(value: unknown): value is DocKind {
 return typeof value === "string" && (DOC_KINDS as readonly string[]).includes(value);
}
function invalidDocKind(kind: unknown) {
 return {error:"invalid_doc_kind",kind,allowed_doc_kinds:DOC_KINDS};
}
export const toolSpecs=[
 {name:"create_project",description:"새 APMS 프로젝트를 생성합니다.",parameters:{type:"object",properties:{name:{type:"string"}},required:["name"]}},
 {name:"create_task",description:"프로젝트 pending 큐에 작업지시서를 발주합니다.",parameters:{type:"object",properties:{project:{type:"string"},title:{type:"string"},body:{type:"string"},pre_task:{type:["string","null"]},next_task:{type:["string","null"]}},required:["project","title","body"]}},
 {name:"list_tasks",description:"프로젝트 작업을 조회합니다.",parameters:{type:"object",properties:{project:{type:"string"},status:{type:"string"}},required:["project"]}},
 {name:"read_doc",description:"프로젝트 문서를 읽습니다.",parameters:{type:"object",properties:{project:{type:"string"},kind:{type:"string",enum:DOC_KINDS}},required:["project","kind"]}},
 {name:"update_doc",description:"프로젝트 문서를 갱신합니다.",parameters:{type:"object",properties:{project:{type:"string"},kind:{type:"string",enum:DOC_KINDS},content:{type:"string"}},required:["project","kind","content"]}}
];
async function project(userId:string,slug:string){const r=await db.query("SELECT * FROM projects WHERE owner_id=$1 AND slug=$2 AND archived_at IS NULL",[userId,slug]);if(!r.rows[0])throw new Error("프로젝트를 찾을 수 없습니다.");return r.rows[0]}
export async function runTool(user:{id:string,email:string,slug:string},sessionId:string,name:string,args:any){
 if(name==="create_project"){const slug=slugify(String(args.name));const r=await db.query("INSERT INTO projects(owner_id,name,slug) VALUES($1,$2,$3) RETURNING *",[user.id,String(args.name).slice(0,120),slug]);await initializeProject(user.slug,slug,String(args.name).slice(0,120));return{project:r.rows[0]};}
 const p=await project(user.id,String(args.project));
 if(name==="create_task"){const createdAt=new Date().toISOString();const title=String(args.title).slice(0,120);const fm:Frontmatter={title,project:p.slug,user:user.slug,"pre-task":args.pre_task||null,"next-task":args.next_task||null,type:"task",created_at:createdAt,timeout_min:20};const file=await createTaskFile(fm.user,p.slug,fm,String(args.body));const values=[p.id,sessionId,file.filename,title,contentHash(file.content),createdAt,file.path];let r;try{r=await db.query("INSERT INTO tasks(project_id,session_id,filename,title,status,content_hash,created_at,file_path) VALUES($1,$2,$3,$4,'pending',$5,$6,$7) RETURNING id,filename,status",values)}catch(error){console.error("[chat:create_task] insert failed",{parameterCount:values.length,error});throw error}return{task:r.rows[0],card:`작업지시서 #${file.filename.slice(0,12)} 발주됨`};}
 if(name==="list_tasks"){const values:any[]=[p.id];let sql="SELECT id,filename,title,status,created_at FROM tasks WHERE project_id=$1";if(args.status){values.push(args.status);sql+=" AND status=$2"}sql+=" ORDER BY created_at DESC LIMIT 100";return{items:(await db.query(sql,values)).rows};}
 if(name==="read_doc"){if(!isDocKind(args.kind))return invalidDocKind(args.kind);return{kind:args.kind,content:await readDocument(user.slug,p.slug,args.kind)};}
 if(name==="update_doc"){if(!isDocKind(args.kind))return invalidDocKind(args.kind);await writeDocument(user.slug,p.slug,args.kind,String(args.content));return{updated:true,kind:args.kind};}
 throw new Error("지원하지 않는 도구입니다.");
}
