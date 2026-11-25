import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.C02_PREVIEW_BASE ?? "http://127.0.0.1:3184";
const output = process.env.C02_BROWSER_OUTPUT ?? join(tmpdir(), "gadews-c02-browser");
await mkdir(output, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click } = browser;
const button = (name) => `document.querySelector('button[aria-label=${JSON.stringify(name)}]')`;
const runs = []; let requests = [];
browser.onEvent((data) => { if (data.method === "Network.requestWillBeSent" && data.params.request.url.startsWith(base + "/data/")) requests.push(new URL(data.params.request.url).pathname); });
const counts = () => ({ wahis: requests.filter((p) => p.includes("woah-wahis")).length, qaad: requests.filter((p) => p === "/data/qaad-surveillance-display.json").length, manifest: requests.filter((p) => p.includes("surveillance-manifest")).length, originalQaad: requests.filter((p) => p.includes("qaad-regional-surveillance-summary")).length });
async function navigate(path) { requests = []; await call("Page.navigate", { url: base + path }); await wait('document.readyState === "complete"'); }
async function screenshot(name) { const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); const path = join(output, name); await writeFile(path, Buffer.from(result.data, "base64")); return path; }
try {
  for (const width of [1440, 390]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await navigate("/risk-map");
    await wait(`document.querySelector(".leaflet-container") && ${button("Demo case markers")}`);
    assert.equal(await evaluate("innerWidth"), width);
    assert.equal(await evaluate(`${button("Demo case markers")}.getAttribute("aria-checked")`), "false");
    assert.equal(await evaluate('document.querySelectorAll(".demo-case-marker,.demo-heatmap-marker").length'), 0);
    if (process.env.C02_BROWSER_CASE === "defaults") { runs.push({ width, defaults: "passed" }); continue; }
    await wait('document.querySelectorAll(".leaflet-interactive").length >= 500');
    await click(button("Demo case markers")); await wait('document.querySelectorAll(".demo-case-marker").length > 0');
    await click(button("Demo heatmap")); await wait('document.body.textContent.includes("Demo heatmap · illustrative values")');
    await click(button("Demo case markers")); await click(button("Demo heatmap"));
    await click(button("Disease filter")); await click(`[...document.querySelectorAll('[role=option]')].find(x=>x.textContent.trim()==='WSD')`);
    await wait(`${button("Disease filter")}.textContent.includes("WSD")`);
    if (width === 390) {
      await click(button("Close panel"));
      await wait('Number(getComputedStyle(document.querySelector("[data-layer-panel]")).opacity) === 0');
    }
    await wait(`document.querySelector('[data-public-source="WOAH WAHIS"]')?.textContent.includes("2026-05-18")`);
    assert.ok(await evaluate('document.body.textContent.includes("Country/territory centroids") || document.body.textContent.includes("country/territory centroids")'));
    await evaluate(`document.querySelector('[data-public-source="NACA QAAD"]').scrollIntoView({block:'nearest'})`);
    const mapShot = await screenshot(`risk-map-${width}.png`);
    assert.equal(counts().wahis, 1); assert.equal(counts().qaad, 1); assert.equal(counts().originalQaad, 0);
    const marker = `[...document.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive')].find(p=>{const r=p.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>10&&x<innerWidth-10&&y>130&&y<innerHeight-40&&document.elementFromPoint(x,y)===p})`;
    const markerPoint = await evaluate(`(() => { const r=(${marker}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    if (width === 390) {
      await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [markerPoint] });
      await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...markerPoint });
      await click(marker);
    }
    await wait('document.querySelector(".leaflet-popup-content")');
    await wait(`(() => { const p=document.querySelector('.leaflet-popup');const r=p.getBoundingClientRect();return getComputedStyle(p).opacity==='1' && getComputedStyle(document.querySelector('[data-layer-panel]')).display==='none' && r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight })()`);
    assert.ok(await evaluate('document.querySelector(".leaflet-popup-content").textContent.includes("not a farm-level")'));
    await evaluate('document.querySelector(".leaflet-popup-content").firstElementChild.scrollTop = 10000');
    assert.ok(await evaluate(`document.querySelector('.leaflet-popup-content a[href^="https:"]')` + ' !== null'));
    const popupShot = await screenshot(`public-popup-${width}.png`);
    await click('document.querySelector(".leaflet-popup-close-button")');
    await navigate("/");
    await wait('document.querySelectorAll("[data-public-event]").length === 8');
    assert.equal(counts().wahis, 1); assert.equal(counts().qaad, 1); assert.equal(counts().originalQaad, 0);
    assert.equal(await evaluate('document.querySelectorAll(".demo-case-marker,.demo-heatmap-marker").length'), 0);
    await evaluate('document.querySelector("[data-public-event]").scrollIntoView({block:"center"})');
    const homeShot = await screenshot(`home-events-${width}.png`);

    await navigate("/c02-surveillance-check");
    await wait('document.querySelector(".leaflet-container") && document.querySelector("[data-fixture-ready]")');
    assert.deepEqual(counts(), { wahis: 0, qaad: 0, manifest: 0, originalQaad: 0 });
    await click(button("Enable WAHIS")); await wait('document.querySelector("[data-wahis-count]").textContent === "371"');
    await click(button("Add WAHIS consumer")); await wait('document.querySelector("[data-consumer-count]").textContent === "371"');
    assert.equal(counts().wahis, 1);
    await click(button("Enable QAAD")); await wait('document.querySelector("[data-qaad-count]").textContent === "140"');
    await click(button("Show WSD only")); await wait('document.querySelector("[data-wahis-count]").textContent === "23"');
    await click(button("Show all QAAD statuses"));
    await click(button("Disable QAAD")); await wait('document.querySelector("[data-qaad-count]").textContent === "0"');
    await click(button("Enable QAAD"));
    assert.deepEqual(counts(), { wahis: 1, qaad: 1, manifest: 1, originalQaad: 0 });
    const fixtureShot = await screenshot(`lifecycle-${width}.png`);
    const lifecycleCounts = counts();

    // A real failed HTTP response followed by a user click must start a new attempt.
    let failOnce = true;
    const stop = browser.onEvent((data) => {
      if (data.method !== "Fetch.requestPaused") return;
      const params = data.params;
      if (failOnce) { failOnce = false; void call("Fetch.fulfillRequest", { requestId: params.requestId, responseCode: 503, responseHeaders: [{ name: "Content-Type", value: "text/plain" }], body: Buffer.from("injected local test failure").toString("base64") }); }
      else void call("Fetch.continueRequest", { requestId: params.requestId });
    });
    await call("Fetch.enable", { patterns: [{ urlPattern: "*qaad-surveillance-display.json", requestStage: "Request" }] });
    await navigate("/c02-surveillance-check"); await wait('document.querySelector(".leaflet-container") && document.querySelector("[data-fixture-ready]")');
    await click(button("Enable QAAD")); await wait(button("Retry NACA QAAD"));
    await click(button("Retry NACA QAAD")); await wait('document.querySelector("[data-qaad-count]").textContent === "140"');
    assert.equal(counts().qaad, 2);
    await call("Fetch.disable"); stop();

    // Pause one request while the last subscriber closes/reopens the layer.
    let paused; let first = true;
    const stopDelay = browser.onEvent((data) => {
      if (data.method !== "Fetch.requestPaused") return;
      if (first) { first = false; paused = data.params.requestId; }
      else void call("Fetch.continueRequest", { requestId: data.params.requestId });
    });
    await call("Fetch.enable", { patterns: [{ urlPattern: "*qaad-surveillance-display.json", requestStage: "Request" }] });
    await navigate("/c02-surveillance-check"); await wait('document.querySelector(".leaflet-container") && document.querySelector("[data-fixture-ready]")');
    await click(button("Enable QAAD"));
    for (let i = 0; i < 100 && !paused; i++) await evaluate('new Promise(r=>setTimeout(r,20))');
    assert.ok(paused);
    await click(button("Disable QAAD")); await wait('document.querySelector("[data-qaad-count]").textContent === "0"');
    await click(button("Enable QAAD"));
    await call("Fetch.continueRequest", { requestId: paused }).catch(() => {});
    await wait('document.querySelector("[data-qaad-count]").textContent === "140"');
    assert.equal(counts().qaad, 2); assert.equal(counts().originalQaad, 0);
    await call("Fetch.disable"); stopDelay();
    await evaluate(`${button("Disable QAAD")}.focus()`);
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.ok(await evaluate('document.activeElement?.tagName === "BUTTON"'));
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    runs.push({ width, actualInnerWidth: await evaluate("innerWidth"), defaults: "passed", actualPages: "passed", lifecycle: lifecycleCounts, httpFailureRetry: "passed", fastToggle: "passed", keyboardFocus: "passed", screenshots: [mapShot, homeShot, fixtureShot, popupShot] });
  }
  console.log(JSON.stringify({ base, runs, externalBasemapTilesBlocked: true }, null, 2));
} catch (error) {
  await screenshot("failure.png").catch(() => {});
  throw error;
} finally { await browser.close(); }
