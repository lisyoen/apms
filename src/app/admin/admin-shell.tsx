"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import ModeToggle from "@/app/mode-toggle";
import { formatKstShort } from "@/lib/format-time";
import "./admin.css";
const menus = ["사용자", "사용량", "프로젝트", "LLM 연결", "워커 설정"];
export default function AdminShell() {
  const [tab, setTab] = useState(menus[0]);
  return (
    <main className="admin-app">
      <aside>
        <div className="admin-logo">
          APMS <small>ADMIN</small>
        </div>
        {menus.map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {x}
          </button>
        ))}
      </aside>
      <section>
        <header>
          <div>
            <h1>{tab}</h1>
            <p>AI Project Management System 관리</p>
          </div>
          <ModeToggle admin />
        </header>
        {tab === "사용자" && <Users />}
        {tab === "사용량" && <Usage />}
        {tab === "프로젝트" && <Projects />}
        {tab === "LLM 연결" && <Connections />}
        {tab === "워커 설정" && <Workers />}
      </section>
    </main>
  );
}
function useData(url: string) {
  const [data, setData] = useState<any>(null);
  const load = useCallback(
    () =>
      fetch(url)
        .then((r) => r.json())
        .then(setData),
    [url],
  );
  useEffect(() => {
    load();
  }, [load]);
  return [data, load];
}
function Users() {
  const [d, load] = useData("/api/admin/users");
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    const x = await r.json();
    if (r.ok) alert(`임시 비밀번호: ${x.temporary_password}`);
    load();
  }
  return (
    <div className="panel">
      <form className="inline-form" onSubmit={invite}>
        <input name="email" type="email" required placeholder="초대 이메일" />
        <input name="display_name" placeholder="이름" />
        <select name="role">
          <option>user</option>
          <option>admin</option>
        </select>
        <button>사용자 초대</button>
      </form>
      <Table
        heads={["이메일", "이름", "역할", "상태", "가입일"]}
        rows={d?.items?.map((x: any) => [
          x.email,
          x.display_name || "—",
          <select
            key={x.id}
            value={x.role}
            onChange={async (e) => {
              await fetch(`/api/admin/users/${x.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ role: e.target.value }),
              });
              load();
            }}
          >
            <option>user</option>
            <option>admin</option>
          </select>,
          x.disabled_at ? "비활성" : "활성",
          new Date(x.created_at).toLocaleDateString(),
        ])}
      />
    </div>
  );
}
function Usage() {
  const [d] = useData("/api/admin/usage");
  return (
    <div className="panel">
      <a className="action" href="/api/admin/usage?format=csv">
        CSV 다운로드
      </a>
      <Table
        heads={[
          "일자",
          "사용자",
          "프로젝트",
          "입력 토큰",
          "출력 토큰",
          "비용(USD)",
        ]}
        rows={d?.items?.map((x: any) => [
          String(x.day).slice(0, 10),
          x.email,
          x.project || "—",
          Number(x.input_tokens).toLocaleString(),
          Number(x.output_tokens).toLocaleString(),
          x.cost,
        ])}
      />
    </div>
  );
}
function Projects() {
  const [d] = useData("/api/admin/projects");
  return (
    <div className="panel">
      <Table
        heads={["프로젝트", "slug", "소유자", "작업", "대기"]}
        rows={d?.items?.map((x: any) => [
          x.name,
          x.slug,
          x.owner_email,
          x.task_count,
          x.pending_count,
        ])}
      />
    </div>
  );
}
function Connections() {
  const [d, load] = useData("/api/admin/llm-connections");
  const [tests, setTests] = useState<Record<string, any>>({});
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/admin/llm-connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...f,
        context_window: Number(f.context_window),
        is_default: true,
      }),
    });
    if (!r.ok) alert((await r.json()).error);
    else {
      e.currentTarget.reset();
      load();
    }
  }
  return (
    <div className="panel">
      {d && !d.items?.some((x: any) => x.is_default) && (
        <div className="connection-warning" role="alert">
          기본 LLM 연결이 없습니다. 사용할 연결을 기본으로 지정하세요.
        </div>
      )}
      <div className="callout">
        API Key는 AUTH_SECRET 파생 AES-256-GCM 키로 암호화되며 다시 표시되지
        않습니다.
      </div>
      <form className="connection-form" onSubmit={add}>
        <input name="name" required placeholder="연결 이름" />
        <select name="provider">
          <option value="compatible">OpenAI 호환</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input
          name="base_url"
          type="url"
          required
          placeholder="https://api.example.com"
        />
        <input name="model" required placeholder="모델" />
        <input name="context_window" type="number" defaultValue="100000" />
        <input
          name="api_key"
          type="password"
          required
          autoComplete="new-password"
          placeholder="API Key"
        />
        <button>연결 등록</button>
      </form>
      <Table
        heads={[
          "상태",
          "이름",
          "Provider",
          "모델",
          "Key",
          "Context",
          "기본",
          "마지막 확인 / 오류",
          "테스트",
        ]}
        rows={d?.items?.map((x: any) => [
          <span
            key={x.id}
            className={`connection-dot ${x.last_ok === true ? "ok" : x.last_ok === false ? "bad" : "unknown"}`}
            title={
              x.last_ok === true
                ? "정상"
                : x.last_ok === false
                  ? "오류"
                  : "미확인"
            }
          />,
          x.name,
          x.provider,
          x.model,
          x.api_key_hint || "설정됨",
          Number(x.context_window).toLocaleString(),
          x.is_default ? (
            <strong key={x.id}>기본</strong>
          ) : (
            <button
              key={x.id}
              onClick={async () => {
                const r = await fetch(`/api/admin/llm-connections/${x.id}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ is_default: true }),
                });
                if (r.ok) load();
              }}
            >
              기본으로 지정
            </button>
          ),
          <div key={x.id} className="health-detail">
            <span>
              {x.last_check_at ? formatKstShort(x.last_check_at) : "미확인"}
            </span>
            {x.last_error && <code>{x.last_error}</code>}
          </div>,
          <button
            key={x.id}
            onClick={async () => {
              const r = await fetch(`/api/admin/llm-connections/${x.id}`, {
                method: "POST",
              });
              const body = await r.json();
              setTests((v) => ({ ...v, [x.id]: body }));
              load();
            }}
          >
            연결 테스트
            {tests[x.id] && (
              <span className="test-result">
                {tests[x.id].reason} · {tests[x.id].latency_ms}ms
                <br />
                {tests[x.id].url}
              </span>
            )}
          </button>,
        ])}
      />
    </div>
  );
}
function Workers() {
  const [d, load] = useData("/api/admin/worker-settings");
  if (!d) return <div className="panel">불러오는 중…</div>;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    await fetch("/api/admin/worker-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...f,
        max_workers: Number(f.max_workers),
        timeout_min: Number(f.timeout_min),
      }),
    });
    load();
    alert("저장했습니다. 스케줄러가 30초 안에 반영합니다.");
  }
  return (
    <div className="panel">
      <form className="settings" onSubmit={save}>
        <label>
          최대 워커
          <input
            name="max_workers"
            type="number"
            defaultValue={d.max_workers}
          />
        </label>
        <label>
          기본 타임아웃(분)
          <input
            name="timeout_min"
            type="number"
            defaultValue={d.timeout_min}
          />
        </label>
        <label>
          러너
          <select name="runner" defaultValue={d.runner}>
            <option>subprocess</option>
            <option>container</option>
          </select>
        </label>
        <label>
          OpenCode 경로
          <input name="opencode_path" defaultValue={d.opencode_path} />
        </label>
        <button>설정 저장</button>
      </form>
    </div>
  );
}
function Table({ heads, rows = [] }: { heads: string[]; rows?: any[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((x, j) => (
                <td key={j}>{x}</td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={heads.length}>데이터가 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
