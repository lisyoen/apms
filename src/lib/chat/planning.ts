export const PLANNING_SECRET_PATTERN = /(?:\bsk-[A-Za-z0-9_-]{8,}|\bcfut_[A-Za-z0-9_-]{8,}|\bpassword\s*=|\b(?:api[_-]?key|token|secret)\s*=)/i;

export function containsPlanningSecret(value: string) { return PLANNING_SECRET_PATTERN.test(value); }

export function planningDate(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }

export type PlanningIntent = "planning" | "meta" | "general";
export function planningIntent(message: string): PlanningIntent {
  const value = message.normalize("NFKC").trim();
  if (/^(?:기획(?:서)?\s*(?:좀\s*)?(?:해|작성해)?\s*(?:볼까|볼까요|할까|할까요)[?？]?)$/.test(value)) return "meta";
  if (/(?:설명|알려|무엇|뭐야|어떻게|왜|상태|현황|조회).*[?？]?$/u.test(value) && !/(?:추가해줘|넣자|해야\s*한다|하자|로\s*정하자)/.test(value)) return "general";
  const explicit = /(?:기획\s*추가|기획서\s*반영|기획서|기획|요구사항|작업지침|스펙|범위|정책|결정사항|추가해줘|넣자|해야\s*한다|하자|로\s*정하자)/.test(value);
  const listItems = value.match(/(?:^|\n|\s)(?:[-*+]\s+|\d+[.)]\s*)/g)?.length ?? 0;
  return explicit || listItems >= 2 || /acceptance criteria/i.test(value) ? "planning" : "general";
}

export function orderPlanningFirst<T extends { name: string }>(calls: T[]) { const rank=(name:string)=>["fetch_url","web_search"].includes(name)?0:name==="append_planning"?1:name==="create_task"?2:3; return [...calls].sort((left, right) => rank(left.name)-rank(right.name)); }

export function planningRules(date: string) { return `현재 날짜는 ${date}입니다. 사용자의 발화에 명시 키워드(기획, 기획서, 기획 추가, 기획서 반영, 요구사항, 작업지침, 스펙, 범위, 정책, 결정사항), 명령·의지 표현(추가해줘, 넣자, 해야 한다, 하자, 로 정하자), 또는 복수 bullet·번호·acceptance criteria 요구사항 목록이 포함되면 기획 모드로 처리하세요. 구체 요구가 있으면 반드시 다른 도구보다 먼저 append_planning을 호출해 현재 프로젝트 proposal의 오늘 날짜 절에 원문 복제가 아닌 정제된 요구사항·결정·열린 질문을 기록하세요. 구현해·발주해·배포해가 명시되고 새 요구사항도 있으면 append_planning을 먼저 호출한 뒤 기존 정책대로 create_task를 호출하세요. 구현·발주가 명시되지 않으면 create_task를 호출하지 마세요. 내용 없는 메타 발화(예: "기획해볼까?")는 도구를 호출하지 말고 질문한 뒤, 구체 답변 턴에서 기록하세요. 일반 설명 요청과 상태 조회는 append_planning을 호출하지 마세요. entries의 열린 질문은 "열린 질문:"으로 시작하세요. project는 현재 프로젝트, date는 반드시 ${date}를 사용하세요. 기록 확인 문장은 서버가 고정하므로 임의로 기록 완료를 주장하지 마세요.`; }

export function planningConfirmation(output: { section: string; added: string[]; duplicates: string[] }, taskCreated = false) {
  const entries = [...output.added, ...output.duplicates];
  const questions = entries.filter((entry) => /^(?:열린\s*질문|질문)\s*[:：]/.test(entry));
  const summary = entries.filter((entry) => !questions.includes(entry)).join(" / ") || "중복 항목을 기존 기록과 병합했습니다.";
  return `기획서에 기록했습니다.\n기록 위치: proposal > ${output.section}\n요약: ${summary}\n열린 질문: ${questions.length ? questions.map((entry) => entry.replace(/^(?:열린\s*질문|질문)\s*[:：]\s*/, "")).join(" / ") : "없음"}${taskCreated ? "\n구현 작업도 발주했습니다." : ""}`;
}
