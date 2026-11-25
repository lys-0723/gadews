import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.WARNING_PREVIEW_BASE ?? "http://127.0.0.1:3190";
const directory = process.env.WARNING_BROWSER_OUTPUT ?? join(tmpdir(), "gadews-warning-browser");
await mkdir(directory, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click } = browser;
const button = (name) => `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(name)})`;
const result = `document.querySelector('[aria-label="Assessment result"]')`;
async function capture(name) { const data = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); const path = join(directory, name); await writeFile(path, Buffer.from(data.data, "base64")); return path; }
const runs = [];
try {
  for (const width of [1440, 390]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await call("Page.navigate", { url: base + "/warning-tools" });
    await wait(`${button("Evaluate WSD")} && !(${button("Evaluate WSD")}).disabled`);
    assert.equal(await evaluate("innerWidth"), width);
    assert.equal(await evaluate('document.querySelector("#wsd-ph").value'), "");
    assert.equal(await evaluate(`Boolean(${result})`), false);
    await click(button("Evaluate WSD"));
    await wait(`${result}?.getAttribute('data-assessment-status') === 'insufficient_data'`);
    await evaluate(`${result}.scrollIntoView({block:'center'})`);
    const empty = await capture(`wsd-insufficient-${width}.png`);
    await click(button("Load WSD example"));
    assert.equal(await evaluate('document.querySelector("#wsd-redBody").value'), "yes");
    assert.equal(await evaluate('document.querySelector("#wsd-softShell").value'), "no");
    await click(button("Evaluate WSD"));
    await wait(`${result}?.getAttribute('data-assessment-status') === 'partial'`);
    assert.ok(await evaluate(`${result}.textContent.includes('Example data')`));
    assert.equal(await evaluate('document.querySelector("[data-overall-grade]").textContent'), "Awaiting complete assessment");
    await evaluate(`${result}.scrollIntoView({block:'center'})`);
    const example = await capture(`wsd-example-${width}.png`);
    await click('document.querySelector("#wsd-ph")');
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 4 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 4 });
    await call("Input.insertText", { text: "8.5" });
    await wait('document.body.textContent.includes("This result is outdated")');
    await click(button("Evaluate WSD"));
    await wait(`${result}?.textContent.includes('rule_conflict')`);
    await click(button("Reset WSD"));
    assert.equal(await evaluate('document.querySelector("#wsd-ph").value'), "");
    assert.equal(await evaluate(`Boolean(${result})`), false);
    await click('document.querySelector("#wsd-regionOrSite")');
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate('document.activeElement?.id'), "wsd-farmOrPondId");
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    runs.push({ width, actualInnerWidth: width, blank: "passed", insufficient: "passed", explicitExample: "passed", outdated: "passed", conflict: "passed", reset: "passed", keyboard: "passed", screenshots: [empty, example] });
  }
  console.log(JSON.stringify({ base, runs, scope: "C03 WSD original entry; local rule prototype only" }, null, 2));
} catch (error) { await capture("warning-failure.png").catch(() => {}); throw error; }
finally { await browser.close(); }
