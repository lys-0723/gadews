import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Runs against the disposable preview fixture, never a production route.
const browserBinary = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const previewUrl = process.env.C01_PREVIEW_URL ?? "http://127.0.0.1:3181/c01-calendar-check";
const outputDirectory = process.env.C01_BROWSER_OUTPUT ?? tmpdir();
const profile = await mkdtemp(join(tmpdir(), "gadews-calendar-browser-"));
const browser = spawn(browserBinary, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; }
    catch { await delay(100); }
  }
  assert.ok(port, "Isolated browser did not start");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(String(message.data));
    const waiter = pending.get(data.id);
    if (waiter) { pending.delete(data.id); clearTimeout(waiter.timer); if (data.error) waiter.reject(new Error(data.error.message)); else waiter.resolve(data.result); }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Browser timeout: ${method}`)); }, 15000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitUntil = async (expression) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error(`Preview did not reach expected state: ${expression}`);
  };
  await call("Page.enable");
  const results = [];
  for (const width of [1440, 390]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390, screenWidth: width, screenHeight: 900 });
    await call("Page.navigate", { url: previewUrl });
    await waitUntil('Object.keys(document.querySelector("[data-c01=single] button") ?? {}).some(k => k.startsWith("__reactProps"))');
    await evaluate("document.fonts.ready.then(() => true)");
    assert.equal(await evaluate("innerWidth"), width, "Actual viewport must match the requested width");
    const click = async (scope, name) => {
      const hit = await evaluate(`(() => {
        const b = [...document.querySelectorAll('[data-c01="${scope}"] button')].find(x => x.getAttribute('aria-label')?.toLowerCase().includes(${JSON.stringify(name.toLowerCase())}));
        if (!b) throw new Error('Missing button');
        b.scrollIntoView({block:'center'});
        const r=b.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2;
        const target=document.elementFromPoint(x,y);
        return {x,y,unobstructed:target===b||b.contains(target),hit:target?.tagName,label:b.getAttribute('aria-label')};
      })()`);
      assert.ok(hit.unobstructed, `${width}px ${name} is obscured by ${hit.hit}`);
      await call("Input.dispatchMouseEvent", { type: "mousePressed", x: hit.x, y: hit.y, button: "left", clickCount: 1 });
      await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: hit.x, y: hit.y, button: "left", clickCount: 1 });
    };
    await click("single", "next month");
    await waitUntil('document.querySelector("[data-c01=single]").textContent.includes("November 2026")');
    await click("single", "previous month");
    await waitUntil('document.querySelector("[data-c01=single]").textContent.includes("October 2026")');
    await click("single", "Thursday, October 15th, 2026");
    await waitUntil('document.querySelector("[data-c01=single] output").textContent === "15"');
    await click("range", "Thursday, October 15th, 2026");
    await click("range", "Tuesday, October 20th, 2026");
    await waitUntil('document.querySelector("[data-c01=range] output").textContent === "15 - 20"');
    // v9 puts selection state on the grid cell, not a descendant button.
    // Check the rendered paint and corners; a matching class alone is insufficient.
    const rangeStyles = await evaluate(`(() => {
      const style = (day) => {
        const cell = document.querySelector('[data-c01="range"] [data-day="2026-10-' + day + '"]');
        const s = getComputedStyle(cell);
        return { selected: cell.getAttribute('aria-selected'), background: s.backgroundColor,
          corners: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(parseFloat) };
      };
      return { start: style('15'), middle: style('16'), end: style('20'), unselected: style('21') };
    })()`);
    assert.ok(rangeStyles.start.corners[0] > 0 && rangeStyles.start.corners[3] > 0, `${width}px range start needs rounded left corners: ${JSON.stringify(rangeStyles)}`);
    assert.ok(rangeStyles.end.corners[1] > 0 && rangeStyles.end.corners[2] > 0, `${width}px range end needs rounded right corners: ${JSON.stringify(rangeStyles)}`);
    assert.ok(rangeStyles.start.corners[1] === 0 && rangeStyles.start.corners[2] === 0 && rangeStyles.end.corners[0] === 0 && rangeStyles.end.corners[3] === 0, "Range endpoints join the middle without internal rounding");
    assert.deepEqual(rangeStyles.middle.corners, [0, 0, 0, 0], "Range middle is continuous");
    assert.equal(rangeStyles.middle.selected, "true");
    assert.notEqual(rangeStyles.middle.background, rangeStyles.unselected.background, "Selected range middle has visible paint");
    assert.notEqual(rangeStyles.start.background, rangeStyles.middle.background, "Range endpoints remain distinct from the middle");
    const singleStyles = await evaluate(`(() => {
      const selected = document.querySelector('[data-c01="single"] [data-day="2026-10-15"]');
      const other = document.querySelector('[data-c01="single"] [data-day="2026-10-16"]');
      return { selected: selected.getAttribute('aria-selected'), selectedBackground: getComputedStyle(selected).backgroundColor, otherBackground: getComputedStyle(other).backgroundColor };
    })()`);
    assert.equal(singleStyles.selected, "true");
    assert.notEqual(singleStyles.selectedBackground, singleStyles.otherBackground, "Single selected date has visible paint");
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "Preview must not overflow horizontally");
    // Start at a known control: Tab after the last date can legitimately leave it.
    await evaluate(`(() => {
      const b = document.querySelector('[data-c01="single"] button[aria-label="Go to the Previous Month"]');
      b.scrollIntoView({block:'center'}); b.focus();
    })()`);
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.ok(await evaluate(`(() => {
      const b = document.activeElement; const r = b.getBoundingClientRect();
      return b.closest('[data-c01="single"]') && b.getAttribute('aria-label')?.toLowerCase().includes('next month') && r.width > 0 && r.height > 0;
    })()`), "Tab moves focus to the visible next-month button");
    const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const path = join(outputDirectory, `c01-calendar-${width}.png`);
    await writeFile(path, Buffer.from(screenshot.data, "base64"));
    results.push({ width, actualInnerWidth: width, navigation: "passed", controlledSingle: "passed", controlledRange: "passed", rangeStyles, singleStyles, keyboardFocus: "passed", screenshot: path });
  }
  console.log(JSON.stringify({ previewUrl, results }, null, 2));
} finally {
  socket?.close();
  const exited = new Promise((resolve) => { browser.once("exit", resolve); });
  browser.kill("SIGTERM");
  await Promise.race([exited, delay(3000)]);
  await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
