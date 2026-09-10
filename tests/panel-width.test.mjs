import test from "node:test";
import assert from "node:assert/strict";
import { clampChatPanelWidth, restoredChatPanelWidth, DEFAULT_CHAT_PANEL_WIDTH } from "../src/components/chat/panel-width.ts";

test("panel width clamps to 320px and 70% of the viewport", () => {
  assert.equal(clampChatPanelWidth(200, 1000), 320);
  assert.equal(clampChatPanelWidth(900, 1000), 700);
  assert.equal(clampChatPanelWidth(560, 1000), 560);
});

test("missing or invalid saved width restores the 420px default", () => {
  assert.equal(restoredChatPanelWidth(null, 1200), DEFAULT_CHAT_PANEL_WIDTH);
  assert.equal(restoredChatPanelWidth("invalid", 1200), DEFAULT_CHAT_PANEL_WIDTH);
});
