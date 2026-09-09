import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import ChatPanel from "@/components/chat/ChatPanel";

export default async function ProjectChatPage({params}: PageProps<"/p/[slug]/chat">) {
  const session=await readSession((await cookies()).get("apms_session")?.value);
  if (!session) redirect("/login");
  const {slug}=await params;
  return <ChatPanel projectSlug={slug} layout="fullscreen" user={{email:session.email,role:session.role}} />;
}
