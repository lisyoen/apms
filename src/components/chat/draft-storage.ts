export const CHAT_DRAFT_DEBOUNCE_MS = 300;

export type ChatDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function chatDraftStorageKey(sessionId: string) {
  return `apms.chat.draft.${sessionId}`;
}

export function readChatDraft(storage: ChatDraftStorage, sessionId: string) {
  return storage.getItem(chatDraftStorageKey(sessionId)) ?? "";
}

export function writeChatDraft(
  storage: ChatDraftStorage,
  sessionId: string,
  draft: string,
) {
  const key = chatDraftStorageKey(sessionId);
  if (draft) storage.setItem(key, draft);
  else storage.removeItem(key);
}

export function deleteChatDraft(storage: ChatDraftStorage, sessionId: string) {
  storage.removeItem(chatDraftStorageKey(sessionId));
}

export function debounceChatDraft(
  storage: ChatDraftStorage,
  sessionId: string,
  draft: string,
  delay = CHAT_DRAFT_DEBOUNCE_MS,
) {
  return setTimeout(() => writeChatDraft(storage, sessionId, draft), delay);
}
