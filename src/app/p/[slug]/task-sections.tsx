"use client";

import { FormEvent, useEffect, useState } from "react";

export type TaskSectionKey = "in-progress" | "pending" | "done" | "failed" | "reports";
export type TaskItem = {
  id?: string;
  filename: string;
  title: string;
  status: string;
  created_at: string;
  pid?: number;
  run_started_at?: string;
  elapsed_seconds?: number;
};

const sections: { key: TaskSectionKey; label: string; summaryKey: "in_progress" | "pending" | "done" | "failed" | "reports" }[] = [
  { key: "in-progress", label: "진행", summaryKey: "in_progress" },
  { key: "pending", label: "대기", summaryKey: "pending" },
  { key: "done", label: "완료", summaryKey: "done" },
  { key: "failed", label: "실패", summaryKey: "failed" },
  { key: "reports", label: "리포트", summaryKey: "reports" },
];
const moveTargets = sections.filter((section) => section.key !== "reports");

type Props = {
  slug: string;
  items: Record<TaskSectionKey, TaskItem[]>;
  totals: Record<"in_progress" | "pending" | "done" | "failed" | "reports", number>;
  offsets: Record<TaskSectionKey, number>;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onMove: (file: string, target: string) => void;
  onOpen: (item: TaskItem, section: TaskSectionKey) => void;
  onOpenInChat: (task: TaskItem) => void;
  onPage: (section: TaskSectionKey, offset: number) => void;
};

export default function TaskSections({ slug, items, totals, offsets, onCreate, onMove, onOpen, onOpenInChat, onPage }: Props) {
  const storageKey = `apms.tasks.sections.${slug}`;
  const [expanded, setExpanded] = useState<Record<TaskSectionKey, boolean>>({
    "in-progress": true, pending: true, done: true, failed: true, reports: true,
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved === "object") setExpanded((current) => ({ ...current, ...saved }));
    } catch { /* Ignore malformed browser state and retain defaults. */ }
  }, [storageKey]);

  function toggle(key: TaskSectionKey) {
    setExpanded((current) => {
      const next = { ...current, [key]: !current[key] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="task-sections" data-section-order="in-progress,pending,done,failed,reports">
      {sections.map((section) => {
        const total = totals[section.summaryKey];
        const offset = offsets[section.key];
        const paged = section.key !== "in-progress";
        const page = Math.floor(offset / 5) + 1;
        const pageCount = Math.max(1, Math.ceil(total / 5));
        return (
          <section className="task-section" data-task-section={section.key} key={section.key}>
            <button className="task-section-header" aria-expanded={expanded[section.key]} onClick={() => toggle(section.key)}>
              <span>{section.label}</span><span className="task-count" aria-label={`${section.label} ${total}개`}>{total}</span>
              <span className="task-chevron" aria-hidden="true">{expanded[section.key] ? "⌄" : "›"}</span>
            </button>
            {expanded[section.key] && (
              <div className="task-section-body">
                {section.key === "pending" && (
                  <form className="task-form" onSubmit={onCreate}>
                    <h2>새 작업지시서</h2>
                    <label>제목<input name="title" required maxLength={120} /></label>
                    <label>본문 Markdown<textarea name="body" required /></label>
                    <div className="dependency-fields">
                      <label>선행 작업<select name="pre-task"><option value="">없음</option>{items.pending.map((task) => <option key={task.filename}>{task.filename}</option>)}</select></label>
                      <label>후속 작업<select name="next-task"><option value="">없음</option>{items.pending.map((task) => <option key={task.filename}>{task.filename}</option>)}</select></label>
                    </div>
                    <button className="primary">등록</button>
                  </form>
                )}
                <div className="task-list">
                  {items[section.key].map((task) => (
                    <div className="task-row" key={task.filename}>
                      <button className="task-open" onClick={() => onOpen(task, section.key)}>
                        <strong>{task.title || task.filename}</strong><code>{task.filename}</code>
                        {task.status === "in-progress" && <span className="worker-badge">실행 중 · PID {task.pid ?? "-"} · {task.elapsed_seconds ?? 0}초</span>}
                      </button>
                      {section.key !== "reports" && (
                        <select aria-label={`${task.filename} 상태 이동`} value={task.status} onChange={(event) => onMove(task.filename, event.target.value)}>
                          {moveTargets.map((target) => <option value={target.key} key={target.key}>{target.label}</option>)}
                        </select>
                      )}
                      <button className="open-in-chat" onClick={() => onOpenInChat(task)}>챗봇에서 열기</button>
                    </div>
                  ))}
                  {!items[section.key].length && <div className="empty">없음</div>}
                </div>
                {paged && total > 5 && (
                  <nav className="task-pagination" aria-label={`${section.label} 페이지`}>
                    <button disabled={offset === 0} onClick={() => onPage(section.key, Math.max(0, offset - 5))}>이전</button>
                    <span>{page} / {pageCount} 페이지 · 총 {total}개</span>
                    <button disabled={offset + 5 >= total} onClick={() => onPage(section.key, offset + 5)}>더 보기 / 다음</button>
                  </nav>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
