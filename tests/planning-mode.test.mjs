import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { containsPlanningSecret, orderPlanningFirst, planningConfirmation, planningDate, planningIntent, planningRules } from "../src/lib/chat/planning.ts";

test("기획 모드는 명시 키워드, 명령형, 복수 요구사항 목록을 식별한다", () => {
  assert.equal(planningIntent("기획서 반영: 담당자 필드를 추가한다"), "planning");
  assert.equal(planningIntent("작업 카드에 담당자 필드를 넣자"), "planning");
  assert.equal(planningIntent("1) 목록에 표시 2) 상세에서 편집"), "planning");
});

test("내용 없는 메타 발화와 일반 질의는 기록 대상으로 분류하지 않는다", () => {
  assert.equal(planningIntent("기획해볼까?"), "meta");
  assert.equal(planningIntent("현재 작업 상태를 알려줘"), "general");
});

test("혼합 발화 규칙은 기획 기록 후 create_task를 요구하고 기존 계약을 유지한다", async () => {
  const rules = planningRules("2026-09-11");
  assert.match(rules, /append_planning을 먼저 호출한 뒤.*create_task/);
  const source = await readFile(new URL("../src/lib/llm/tools.ts", import.meta.url), "utf8");
  assert.match(source, /name:"create_task"/);
  assert.match(source, /required:\["project","date","entries"\]/);
  assert.deepEqual(orderPlanningFirst([{ name: "create_task" }, { name: "append_planning" }]).map((call) => call.name), ["append_planning", "create_task"]);
});

test("고정 확인 응답은 위치, 요약, 열린 질문과 선택적 발주 줄을 보장한다", () => {
  const response = planningConfirmation({ section: "## 기획 2026-09-11", added: ["담당자 필드를 추가한다", "열린 질문: 복수 담당자를 허용할지"], duplicates: [] }, true);
  assert.equal(response, "기획서에 기록했습니다.\n기록 위치: proposal > ## 기획 2026-09-11\n요약: 담당자 필드를 추가한다\n열린 질문: 복수 담당자를 허용할지\n구현 작업도 발주했습니다.");
});

test("KST 날짜와 시크릿 패턴을 결정론적으로 처리한다", () => {
  assert.equal(planningDate(new Date("2026-09-10T15:30:00Z")), "2026-09-11");
  assert.equal(containsPlanningSecret("password=do-not-store"), true);
  assert.equal(containsPlanningSecret("공개 요구사항"), false);
});
