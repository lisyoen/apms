import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CHAT_DRAFT_DEBOUNCE_MS,
  chatDraftStorageKey,
  debounceChatDraft,
  deleteChatDraft,
  readChatDraft,
} from "../src/components/chat/draft-storage.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("chat draft keys are scoped to the session", () => {
  assert.equal(chatDraftStorageKey("session-42"), "apms.chat.draft.session-42");
});

test("chat drafts are persisted after the 300ms debounce", async () => {
  const storage = memoryStorage();
  debounceChatDraft(storage, "session-1", "새 초안", 10);
  assert.equal(readChatDraft(storage, "session-1"), "");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(readChatDraft(storage, "session-1"), "새 초안");
  assert.equal(CHAT_DRAFT_DEBOUNCE_MS, 300);
});

test("deleting a sent draft removes only that session key", async () => {
  const storage = memoryStorage();
  debounceChatDraft(storage, "sent", "보낸 메시지", 0);
  debounceChatDraft(storage, "typing", "작성 중", 0);
  await new Promise((resolve) => setTimeout(resolve, 5));
  deleteChatDraft(storage, "sent");
  assert.equal(readChatDraft(storage, "sent"), "");
  assert.equal(readChatDraft(storage, "typing"), "작성 중");
});

test("pending generation locks submission without disabling the textarea", async () => {
  const panel = await readFile(
    new URL("../src/components/chat/ChatPanel.tsx", import.meta.url),
    "utf8",
  );
  const textarea = panel.match(/<textarea[\s\S]*?\/>/)?.[0] || "";
  assert.match(textarea, /disabled=\{!active \|\| readOnly\}/);
  assert.doesNotMatch(textarea, /busy/);
  assert.match(panel, /if \(busy\) return;[\s\S]*event\.preventDefault\(\)/);
  assert.match(panel, /aria-live="polite"/);
});
