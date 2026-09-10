"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { TaskItem } from "./task-sections";

export type NewTaskPayload = { title: string; body: string; "pre-task": string | null; "next-task": string | null; timeout_min: number };

export function buildNewTaskPayload(values: Record<string, FormDataEntryValue | null>): NewTaskPayload {
  const timeout = Number(values.timeout_min);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1440) throw new Error("timeout은 1~1440 사이의 정수여야 합니다.");
  return {
    title: String(values.title ?? "").trim(), body: String(values.body ?? ""),
    "pre-task": values["pre-task"] ? String(values["pre-task"]) : null,
    "next-task": values["next-task"] ? String(values["next-task"]) : null,
    timeout_min: timeout,
  };
}

type Props = { pendingTasks: TaskItem[]; onClose: () => void; onCreate: (payload: NewTaskPayload) => Promise<string | null> };

export default function NewTaskModal({ pendingTasks, onClose, onCreate }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestClose = () => { if (!dirtyRef.current || window.confirm("작성 중인 내용을 버릴까요?")) onClose(); };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (!dirtyRef.current || window.confirm("작성 중인 내용을 버릴까요?"))) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    let payload: NewTaskPayload;
    try { payload = buildNewTaskPayload(Object.fromEntries(new FormData(event.currentTarget).entries())); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "입력값을 확인해 주세요."); return; }
    setSubmitting(true);
    const result = await onCreate(payload);
    setSubmitting(false);
    if (result) { setError(result); return; }
    dirtyRef.current = false;
  }

  return <div className="new-task-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <section className="new-task-modal" role="dialog" aria-modal="true" aria-labelledby="new-task-title">
      <header><div><span className="eyebrow">TASK ORDER</span><h2 id="new-task-title">새 작업</h2></div><button type="button" className="new-task-close" aria-label="새 작업 닫기" onClick={requestClose}>×</button></header>
      <form className="task-form" onSubmit={submit} onChange={() => { dirtyRef.current = true; }}>
        <label>제목<input ref={titleRef} name="title" required maxLength={120} /></label>
        <label>작업지시서 본문 (Markdown)<textarea name="body" required /></label>
        <div className="dependency-fields">
          <label>선행 작업<select name="pre-task"><option value="">없음</option>{pendingTasks.map((task) => <option key={task.filename}>{task.filename}</option>)}</select></label>
          <label>후속 작업<select name="next-task"><option value="">없음</option>{pendingTasks.map((task) => <option key={task.filename}>{task.filename}</option>)}</select></label>
        </div>
        <label>Timeout (분)<input name="timeout_min" type="number" min="1" max="1440" step="1" defaultValue="20" required /></label>
        {error && <div className="new-task-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" onClick={requestClose}>취소</button><button className="primary" disabled={submitting}>{submitting ? "등록 중…" : "등록"}</button></div>
      </form>
    </section>
  </div>;
}
