export const CHAT_PANEL_WIDTH_KEY = "apms.chat.panel.width";
export const CHAT_PANEL_FULLSCREEN_KEY = "apms.chat.panel.fullscreen";
export const DEFAULT_CHAT_PANEL_WIDTH = 420;
export const MIN_CHAT_PANEL_WIDTH = 320;
export const MOBILE_CHAT_BREAKPOINT = 900;

export function clampChatPanelWidth(width: number, viewportWidth: number) {
  const maximum = Math.max(MIN_CHAT_PANEL_WIDTH, viewportWidth * 0.7);
  return Math.min(maximum, Math.max(MIN_CHAT_PANEL_WIDTH, width));
}

export function restoredChatPanelWidth(value: string | null, viewportWidth: number) {
  const parsed = Number(value);
  return clampChatPanelWidth(Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHAT_PANEL_WIDTH, viewportWidth);
}
