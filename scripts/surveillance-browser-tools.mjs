import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export async function openBrowser() {
  const profile = await mkdtemp(join(tmpdir(), "gadews-surveillance-browser-"));
  const browser = spawn(process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) { try { port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; } catch { await delay(100); } }
    assert.ok(port, "Isolated Chromium did not start");
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    const pending = new Map(); const listeners = new Set(); let id = 0;
    socket.addEventListener("message", (event) => {
      const data = JSON.parse(String(event.data));
      if (data.id && pending.has(data.id)) { const waiter = pending.get(data.id); pending.delete(data.id); clearTimeout(waiter.timer); if (data.error) waiter.reject(new Error(data.error.message)); else waiter.resolve(data.result); }
      else listeners.forEach((listener) => listener(data));
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Browser timeout: ${method}`)); }, 20000);
      pending.set(requestId, { resolve, reject, timer }); socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = async (expression) => {
      for (let i = 0; i < 200; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
      throw new Error(`Expected browser state not reached: ${expression}`);
    };
    const click = async (expression) => {
      const point = await evaluate(`(() => { const b=(${expression}); if(!b) throw new Error('Missing click target'); b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,visible:r.width>0&&r.height>0,clear:hit===b||b.contains(hit),hit:hit?.tagName}; })()`);
      assert.ok(point.visible && point.clear, `Click target is obscured or invisible (${point.hit}): ${expression}`);
      await call("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
      await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
    };
    await call("Page.enable"); await call("Network.enable"); await call("Network.setCacheDisabled", { cacheDisabled: true });
    await call("Network.setBlockedURLs", { urls: ["*://*.tile.openstreetmap.org/*", "*://cdnjs.cloudflare.com/*"] });
    return { call, evaluate, wait, click, onEvent: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, close: async () => { socket.close(); const exited = new Promise((r) => browser.once("exit", r)); browser.kill("SIGTERM"); await Promise.race([exited, delay(3000)]); await rm(profile, { recursive: true, force: true, maxRetries: 3 }); } };
  } catch (error) { socket?.close(); browser.kill("SIGTERM"); await rm(profile, { recursive: true, force: true, maxRetries: 3 }); throw error; }
}
