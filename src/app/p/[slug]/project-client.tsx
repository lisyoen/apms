"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import MdViewer from "@/components/MdViewer";
import ChatPanel from "@/components/chat/ChatPanel";
const docs = [
  { key: "dev", label: "개요" },
  { key: "guide", label: "지침" },
  { key: "setting", label: "설정" },
  { key: "proposal", label: "기획서" },
  { key: "tasks", label: "작업" },
  { key: "next", label: "핸드오버" },
];
const statuses = [
  { key: "pending", label: "대기" },
  { key: "in-progress", label: "진행" },
  { key: "done", label: "완료" },
  { key: "failed", label: "실패" },
  { key: "reports", label: "리포트" },
];
type Task = {
  id: string;
  filename: string;
  title: string;
  status: string;
  created_at: string;
  pid?: number;
  run_started_at?: string;
  elapsed_seconds?: number;
};
export default function ProjectClient({ slug }: { slug: string }) {
  const [project, setProject] = useState<{ name: string } | null>(null);
  const [section, setSection] = useState("dev");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("pending");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(420);
  const dragging = useRef(false);
  async function loadDoc(kind: string) {
    const r = await fetch(`/api/projects/${slug}/docs/${kind}`);
    if (r.ok) setContent(await r.text());
  }
  async function loadTasks(next = status) {
    const r = await fetch(
      `/api/projects/${slug}/${next === "reports" ? "reports" : "tasks"}${next === "reports" ? "" : `?status=${next}`}`,
    );
    if (r.ok) setTasks((await r.json()).items);
  }
  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProject)
      .catch(() => (location.href = "/dashboard"));
  }, [slug]);
  useEffect(() => {
    setChatOpen(localStorage.getItem("apms.project.chat.open") !== "false");
    const saved = Number(localStorage.getItem("apms.project.chat.width"));
    if (saved >= 320 && saved <= 720) setChatWidth(saved);
  }, []);
  useEffect(() => {
    if (section === "tasks") void loadTasks();
    else {
      setOpenFile(null);
      void loadDoc(section);
    }
  }, [section, status]);
  useEffect(() => {
    if (section !== "tasks") return;
    const refresh = () => void loadTasks();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("apms:tasks-changed", refresh);
    return () => { window.clearInterval(timer);window.removeEventListener("apms:tasks-changed", refresh); };
  }, [section, status]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      const width = Math.max(320, Math.min(720, window.innerWidth - event.clientX));
      setChatWidth(width);
    };
    const up = () => { if (dragging.current) { dragging.current=false;localStorage.setItem("apms.project.chat.width",String(chatWidth)); } };
    window.addEventListener("pointermove", move);window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move);window.removeEventListener("pointerup", up); };
  }, [chatWidth]);
  async function save() {
    await fetch(`/api/projects/${slug}/docs/${section}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setEditing(false);
  }
  async function createTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch(`/api/projects/${slug}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: f.get("title"),
        body: f.get("body"),
        "pre-task": f.get("pre-task") || null,
        "next-task": f.get("next-task") || null,
      }),
    });
    if (r.ok) {
      e.currentTarget.reset();
      await loadTasks("pending");
    } else alert((await r.json()).error);
  }
  async function move(file: string, target: string) {
    const r = await fetch(`/api/projects/${slug}/tasks/${file}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target }),
    });
    if (r.ok) await loadTasks();
  }
  async function open(item: Task) {
    const prefix = status === "reports" ? "reports" : "tasks";
    const r = await fetch(`/api/projects/${slug}/${prefix}/${item.filename}`);
    if (r.ok) {
      setContent(await r.text());
      setOpenFile(item.filename);
    }
  }
  async function share() {
    const resource = openFile
      ? { project: slug, file: openFile }
      : { project: slug, kind: section };
    const r = await fetch("/api/md/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(resource),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error);
    return `${location.origin}${body.url}`;
  }
  function openInChat(task: Task) {
    setChatOpen(true);localStorage.setItem("apms.project.chat.open","true");
    const prompt=`다음 작업지시서를 요약하고 현재 상태와 다음 조치를 알려줘: ${task.filename} — ${task.title}`;
    localStorage.setItem(`apms.chat.prompt.${slug}`,prompt);
    window.dispatchEvent(new CustomEvent("apms:chat-prompt", {detail:{prompt}}));
  }
  return (
    <div className={`project-workspace ${chatOpen ? "chat-open" : "chat-closed"}`} style={{"--chat-width":`${chatWidth}px`} as React.CSSProperties}>
    <main className="project-layout">
      <aside className="project-sidebar">
        <a className="back" href="/dashboard">
          ← 프로젝트
        </a>
        <h1>{project?.name || slug}</h1>
        <nav>
          {docs.map((d) => (
            <button
              className={section === d.key ? "active" : ""}
              key={d.key}
              onClick={() => setSection(d.key)}
            >
              {d.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="project-content">
        {section !== "tasks" ? (
          <>
            {editing ? (
              <div className="editor">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <div>
                  <button onClick={() => setEditing(false)}>취소</button>
                  <button className="primary" onClick={save}>
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="edit-button"
                  onClick={() => setEditing(true)}
                >
                  편집
                </button>
                <MdViewer
                  content={content}
                  title={`${slug}.${section}`}
                  onShare={share}
                />
              </>
            )}
          </>
        ) : (
          <div className="tasks-view">
            <div className="task-tabs">
              {statuses.map((s) => (
                <button
                  className={status === s.key ? "active" : ""}
                  key={s.key}
                  onClick={() => {
                    setStatus(s.key);
                    setOpenFile(null);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {openFile ? (
              <>
                <button onClick={() => setOpenFile(null)}>← 목록</button>
                <MdViewer content={content} title={openFile} onShare={share} />
              </>
            ) : (
              <>
                {status === "pending" && (
                  <form className="task-form" onSubmit={createTask}>
                    <h2>새 작업지시서</h2>
                    <label>
                      제목
                      <input name="title" required maxLength={120} />
                    </label>
                    <label>
                      본문 Markdown
                      <textarea name="body" required />
                    </label>
                    <div className="dependency-fields">
                      <label>
                        선행 작업
                        <select name="pre-task">
                          <option value="">없음</option>
                          {tasks.map((t) => (
                            <option key={t.id}>{t.filename}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        후속 작업
                        <select name="next-task">
                          <option value="">없음</option>
                          {tasks.map((t) => (
                            <option key={t.id}>{t.filename}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button className="primary">등록</button>
                  </form>
                )}
                <div className="task-list">
                  {tasks.map((t) => (
                    <div className="task-row" key={t.filename}>
                      <button
                        className="task-open"
                        onClick={() => void open(t)}
                      >
                  <strong>{t.title || t.filename}</strong>
                  <code>{t.filename}</code>
                  {t.status === "in-progress" && (
                    <span className="worker-badge">
                      실행 중 · PID {t.pid ?? "-"} ·{" "}
                      {t.elapsed_seconds ?? 0}
                      초
                    </span>
                  )}
                      </button>
                      {status !== "reports" && (
                        <select
                          aria-label={`${t.filename} 상태 이동`}
                          value={t.status}
                          onChange={(e) =>
                            void move(t.filename, e.target.value)
                          }
                        >
                          {statuses.slice(0, 4).map((s) => (
                            <option value={s.key} key={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <button className="open-in-chat" onClick={() => openInChat(t)}>챗봇에서 열기</button>
                    </div>
                  ))}
                  {!tasks.length && (
                    <div className="empty">항목이 없습니다.</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
    <button className="chat-collapse" aria-expanded={chatOpen} onClick={()=>{const next=!chatOpen;setChatOpen(next);localStorage.setItem("apms.project.chat.open",String(next));}}>{chatOpen?"챗봇 접기":"챗봇 펴기"}</button>
    {chatOpen&&<aside className="project-chat" data-testid="project-chat-panel"><div className="chat-resizer" onPointerDown={(event)=>{dragging.current=true;event.currentTarget.setPointerCapture(event.pointerId);}}/><ChatPanel projectSlug={slug} layout="panel" /></aside>}
    </div>
  );
}
