"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import ModeToggle from "@/app/mode-toggle";
import "./ChatPanel.css";

export type ChatPanelLayout = "page" | "panel" | "fullscreen";
type Session = { id:string; title:string; project_name?:string; project_id?:string; project_slug?:string; parent_session_id?:string; status:string; context_tokens:number; context_limit:number };
type Message = { id?:string; role:string; content:string; metadata?:{cards?:Array<{card?:string}>} };

export function chatSessionStorageKey(projectSlug?: string) {
  return `apms.chat.session.${projectSlug || "global"}`;
}

export default function ChatPanel({ projectSlug, layout, user, llmConfigured = true, initialPrompt = "" }: {
  projectSlug?: string;
  layout: ChatPanelLayout;
  user?: { email:string; role:string };
  llmConfigured?: boolean;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const [sessions,setSessions] = useState<Session[]>([]);
  const [projects,setProjects] = useState<Array<{id:string;name:string;slug:string}>>([]);
  const [projectTitle,setProjectTitle] = useState("");
  const [active,setActive] = useState<Session|null>(null);
  const [messages,setMessages] = useState<Message[]>([]);
  const [input,setInput] = useState(initialPrompt);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState(llmConfigured ? "" : "LLM 연결 필요 — 관리자가 기본 연결을 등록해야 합니다.");
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const query = projectSlug ? `?project_slug=${encodeURIComponent(projectSlug)}` : "";
    const requests = [fetch(`/api/chat/sessions${query}`)];
    if (layout === "page") requests.push(fetch("/api/projects"));
    const [sessionResponse, projectResponse] = await Promise.all(requests);
    if (sessionResponse.ok) setSessions((await sessionResponse.json()).items);
    if (projectResponse?.ok) setProjects((await projectResponse.json()).items);
  }, [layout, projectSlug]);

  const open = useCallback(async (session: Session) => {
    const response = await fetch(`/api/chat/sessions/${session.id}`);
    if (!response.ok) return;
    const data = await response.json();
    const opened = {...session,...data.session};
    setActive(opened);
    setMessages(data.messages);
    setNotice("");
    localStorage.setItem(chatSessionStorageKey(projectSlug), opened.id);
  }, [projectSlug]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!projectSlug) return;
    void fetch(`/api/projects/${encodeURIComponent(projectSlug)}`).then((response)=>response.ok?response.json():null).then((project)=>setProjectTitle(project?.name||projectSlug));
    const draft=localStorage.getItem(`apms.chat.prompt.${projectSlug}`);
    if (draft) { setInput(draft);localStorage.removeItem(`apms.chat.prompt.${projectSlug}`); }
  }, [projectSlug]);
  useEffect(() => {
    if (!sessions.length || active) return;
    const saved = localStorage.getItem(chatSessionStorageKey(projectSlug));
    const candidate = sessions.find((session) => session.id === saved) || sessions.find((session) => session.status === "active");
    if (candidate) void open(candidate);
  }, [active, open, projectSlug, sessions]);
  useEffect(() => { bottom.current?.scrollIntoView({behavior:"smooth"}); }, [messages,notice]);
  useEffect(() => {
    const receivePrompt = (event: Event) => {
      const detail = (event as CustomEvent<{prompt:string}>).detail;
      if (detail?.prompt) { setInput(detail.prompt);if(projectSlug)localStorage.removeItem(`apms.chat.prompt.${projectSlug}`); }
    };
    window.addEventListener("apms:chat-prompt", receivePrompt);
    return () => window.removeEventListener("apms:chat-prompt", receivePrompt);
  }, [projectSlug]);
  useEffect(() => {
    if (layout !== "fullscreen") return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") router.push(`/p/${projectSlug}`); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [layout, projectSlug, router]);

  async function create(projectId?: string) {
    const response = await fetch("/api/chat/sessions", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(projectSlug ? {project_slug:projectSlug} : {project_id:projectId})});
    if (!response.ok) return;
    const session = await response.json();
    await load();
    await open(session);
  }

  async function send() {
    const text=input.trim();
    if (!text || !active || busy) return;
    setInput(""); setBusy(true); setMessages((value)=>[...value,{role:"user",content:text}]);
    const response=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({session_id:active.id,message:text})});
    if (!response.ok) { const error=await response.json().catch(()=>({error:"응답 오류"}));setNotice(error.error);setBusy(false);return; }
    const raw=await response.text();
    for (const line of raw.split("\n")) if (line.startsWith("data: ")) {
      const data=JSON.parse(line.slice(6));
      if (!data.content) continue;
      setMessages((value)=>[...value,{role:"assistant",content:data.content,metadata:{cards:data.cards}}]);
      setActive((value)=>value&&({...value,context_tokens:data.usage.tokens,context_limit:data.usage.limit}));
      if (data.cards?.length) window.dispatchEvent(new CustomEvent("apms:tasks-changed"));
      if (data.handover) { setNotice(data.handover.notice);setActive(data.handover.session);localStorage.setItem(chatSessionStorageKey(projectSlug),data.handover.session.id);await load(); }
    }
    setBusy(false);
  }

  const ratio=active?Math.min(100,Math.round(Number(active.context_tokens||0)/Number(active.context_limit||1)*100)):0;
  const projectName=active?.project_name||projectTitle||projects.find((project)=>project.slug===projectSlug)?.name||projectSlug;
  return <main className={`chat-app chat-${layout}`} data-chat-panel={layout}>
    {layout==="page"&&<aside><div className="brand">APMS</div><button className="new-chat" onClick={()=>create()}>＋ 새 대화</button>{projects.map((project)=><section key={project.id}><div className="project-row"><b>{project.name}</b><button onClick={()=>create(project.id)}>＋</button></div>{sessions.filter((session)=>session.project_id===project.id).map((session)=><button className={`session ${active?.id===session.id?"active":""}`} onClick={()=>open(session)} key={session.id}>{session.parent_session_id&&"↳ "}{session.title}<small>{session.status==="handed_over"?"핸드오버됨":""}</small></button>)}</section>)}</aside>}
    <div className="chat-main"><header><div><span className="project-context">{projectName}</span><strong>{active?.title||"새 대화를 시작하세요"}</strong>{active&&<div className="usage"><span>사용량 {ratio}% ({Number(active.context_tokens).toLocaleString()}/{Number(active.context_limit).toLocaleString()})</span><i><em style={{width:`${ratio}%`}}/></i></div>}</div><div className="chat-header-actions">{layout==="panel"&&<button onClick={()=>router.push(`/p/${projectSlug}/chat`)}>전체화면</button>}{layout==="fullscreen"&&<button onClick={()=>router.push(`/p/${projectSlug}`)}>패널로</button>}{layout==="page"&&user&&<ModeToggle admin={user.role==="admin"}/>}</div></header>
      <div className="conversation">{!active&&<div className="empty"><h1>무엇을 만들어 볼까요?</h1><p>{sessions.length?"대화를 선택하세요.":"새 대화를 만들고 작업지시서를 발주하세요."}</p><button className="new-chat central" onClick={()=>create()}>＋ 새 대화</button></div>}{messages.map((message,index)=><article className={message.role} key={message.id||index}>{message.role==="assistant"?<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{message.content}</ReactMarkdown>:<p>{message.content}</p>}{message.metadata?.cards?.map((card,j)=><div className="task-card" key={j}>✓ {card.card}</div>)}</article>)}{notice&&<div className="handover">{notice}</div>}<div ref={bottom}/></div>
      <div className="composer"><textarea disabled={!active||busy} value={input} placeholder={!active?"먼저 새 대화를 만드세요":"메시지를 입력하세요"} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void send();}}}/><button onClick={()=>void send()} disabled={!active||busy||!input.trim()}>{busy?"…":"↑"}</button></div>
    </div>
  </main>;
}
