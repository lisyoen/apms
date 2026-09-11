import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const screenshotDir = new URL("../work-reports/dirigo/20260911-038-screenshots/", import.meta.url);

test("chat header CSS separates a shrinking title from fixed actions", async () => {
  const [css, panel] = await Promise.all([
    readFile(new URL("src/app/globals.css", root), "utf8"),
    readFile(new URL("src/components/chat/ChatPanel.tsx", root), "utf8"),
  ]);
  assert.match(css, /\.chat-app \.chat-sticky-header\s*\{[^}]*align-items:\s*flex-start;[^}]*gap:\s*8px;/s);
  assert.match(css, /\.chat-app \.chat-header-title\s*\{[^}]*flex:\s*1;[^}]*min-width:\s*0;/s);
  assert.match(css, /\.chat-app \.chat-header-actions\s*\{[^}]*z-index:\s*31;[^}]*flex:\s*none;/s);
  assert.match(css, /\.session-title\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /-webkit-line-clamp:\s*3/);
  assert.match(css, /min-width:\s*32px;[^}]*min-height:\s*32px;/s);
  assert.match(panel, /title=\{active\?\.title \|\| "세션 선택"\}/);
  assert.match(panel, /className="session-title"/);
});

test("Chromium keeps the fullscreen action exposed at narrow widths", async (t) => {
  await mkdir(screenshotDir, { recursive: true });
  const [globalCss, panelCss] = await Promise.all([
    readFile(new URL("src/app/globals.css", root), "utf8"),
    readFile(new URL("src/components/chat/ChatPanel.css", root), "utf8"),
  ]);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/snap/bin/chromium", headless: true });
  t.after(() => browser.close());
  const title = "가나다라마바사아자차카타파하".repeat(15).slice(0, 200);

  for (const width of [280, 375, 600]) {
    const page = await browser.newPage({ viewport: { width, height: 520 } });
    await page.setContent(`<!doctype html><style>${panelCss}\n${globalCss}\nhtml,body{margin:0}.chat-app{width:100vw}</style>
      <main class="chat-app chat-panel"><div class="chat-main">
        <header class="chat-sticky-header">
          <div class="chat-session-heading chat-header-title"><span class="project-context">긴 제목 레이아웃 검증</span><div class="session-picker"><button class="session-picker-toggle" title="${title}"><span class="session-title">${title}</span><span class="session-picker-caret">▾</span></button></div><div class="usage"><span>사용량 10%</span></div></div>
          <div class="chat-header-actions"><button data-testid="fullscreen">전체화면</button></div>
        </header>
        <div class="conversation-shell"><div class="conversation">메시지 목록</div></div>
        <form class="composer"><textarea aria-label="메시지"></textarea><button>↑</button></form>
      </div></main>`);
    const base = await page.evaluate(() => {
      const titleBox = document.querySelector(".chat-header-title").getBoundingClientRect();
      const action = document.querySelector("[data-testid=fullscreen]");
      const actionBox = action.getBoundingClientRect();
      const hit = document.elementFromPoint(actionBox.left + actionBox.width / 2, actionBox.top + actionBox.height / 2);
      const appBox = document.querySelector(".chat-app").getBoundingClientRect();
      return { appWidth: appBox.width, gridColumns: getComputedStyle(document.querySelector(".chat-app")).gridTemplateColumns, titleFlex: getComputedStyle(document.querySelector(".chat-header-title")).flex, titleRight: titleBox.right, actionLeft: actionBox.left, actionWidth: actionBox.width, actionHeight: actionBox.height, hitAction: hit === action || action.contains(hit), hit: `${hit?.tagName}.${hit?.className}` };
    });
    assert.ok(base.titleRight <= base.actionLeft, `${width}px title overlaps action`);
    assert.ok(base.actionWidth >= 32 && base.actionHeight >= 32, `${width}px action target is too small`);
    assert.equal(base.hitAction, true, `${width}px action center is obscured: ${JSON.stringify(base)}`);

    const before = await page.locator(".composer").boundingBox();
    await page.locator(".session-picker-toggle").focus();
    const expanded = await page.evaluate(() => {
      const titleElement = document.querySelector(".session-title");
      return {
        lines: Math.round(titleElement.getBoundingClientRect().height / parseFloat(getComputedStyle(titleElement).lineHeight)),
        shellHeight: document.querySelector(".conversation-shell").getBoundingClientRect().height,
        composerBottom: document.querySelector(".composer").getBoundingClientRect().bottom,
        viewportHeight: innerHeight,
      };
    });
    const after = await page.locator(".composer").boundingBox();
    assert.ok(expanded.lines >= 2 && expanded.lines <= 3, `${width}px expanded title is not clamped to 3 lines`);
    assert.ok(expanded.shellHeight > 0, `${width}px message list collapsed`);
    assert.ok(expanded.composerBottom <= expanded.viewportHeight, `${width}px composer was clipped`);
    assert.equal(after.height, before.height, `${width}px composer height changed`);
    t.diagnostic(`${width}px: titleRight=${base.titleRight.toFixed(2)}, actionLeft=${base.actionLeft.toFixed(2)}, action=${base.actionWidth.toFixed(2)}x${base.actionHeight.toFixed(2)}, hitAction=${base.hitAction}, expandedLines=${expanded.lines}, messageHeight=${expanded.shellHeight.toFixed(2)}, composerBottom=${expanded.composerBottom.toFixed(2)}`);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}px.png`, screenshotDir)), fullPage: true });
    await page.close();
  }
});
