import { apiError,requireUser } from "@/lib/auth";
export async function GET(){try{const u=await requireUser();return Response.json({id:u.id,email:u.email,display_name:u.display_name,role:u.role})}catch(e){return apiError(e)}}
