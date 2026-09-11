import { NextResponse,type NextRequest } from "next/server";
import { jwtVerify } from "jose";
export async function proxy(request:NextRequest){const token=request.cookies.get("dirigo_session")?.value;if(!token)return NextResponse.next();try{const secret=process.env.AUTH_SECRET;if(!secret)return NextResponse.next();const {payload}=await jwtVerify(token,new TextEncoder().encode(secret));if(payload.role!=="admin")return new NextResponse("Forbidden",{status:403})}catch{return NextResponse.next()}return NextResponse.next()}
export const config={matcher:"/admin/:path*"};
