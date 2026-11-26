import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.MONITORING_DEMO_PREVIEW_BASE ?? "http://127.0.0.1:3202";
const output = resolve(process.env.MONITORING_DEMO_BROWSER_OUTPUT ?? join(tmpdir(), "gadews-monitoring-demo"));
await mkdir(output, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click } = browser;
const requests = [];
browser.onEvent((event) => { if (event.method === "Network.requestWillBeSent") requests.push(event.params.request.url); });
const button = (text) => `[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(text)})`;
const demo = `document.querySelector('[aria-label="WSD demo workspace"]')`;
const manual = `document.querySelector('[aria-label="WSD workspace"]')`;
const panel = `document.querySelector('[aria-label="Monitoring observations"]')`;
const result = (scope) => `${scope}.querySelector('[aria-label="Assessment result"]')`;
const monitoringRequests = () => requests.filter((url) => url.includes("/api/monitoring/")).length;
async function capture(name) {
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = join(output, name); await writeFile(file, Buffer.from(shot.data, "base64")); return file;
}
async function fill(id, text) {
  await click(`document.getElementById(${JSON.stringify(id)})`);
  await wait(`document.activeElement.id===${JSON.stringify(id)}`);
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 4, commands: ["selectAll"] });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 4 });
  await call("Input.insertText", { text });
  await wait(`document.getElementById(${JSON.stringify(id)}).value===${JSON.stringify(text)}`);
}
async function scenario(id) {
  await click('document.getElementById("monitoring-feed")');
  await evaluate(`(()=>{const s=document.getElementById('monitoring-feed');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`${panel}.dataset.monitoringState==='success' && document.getElementById('monitoring-feed').value===${JSON.stringify(id)}`);
}
async function download(width, label, scenarioId) {
  const directory = await mkdtemp(join(output, `download-${width}-${label}-`));
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
  await click(button("Download JSON"));
  let file;
  for (let i = 0; i < 100; i++) { file = (await readdir(directory)).find((name) => name.endsWith(".json")); if (file) break; await delay(100); }
  assert.ok(file, "Download must create a real report file");
  const path = join(directory, file); const report = JSON.parse(await readFile(path, "utf8"));
  assert.equal(report.result.dataMode, "example");
  assert.equal(report.result.contextSnapshot.dataMode, "example");
  assert.equal(report.result.contextSnapshot.inputProvenance.demoSession.kind, "demo");
  if (scenarioId) assert.equal(report.result.contextSnapshot.inputProvenance.demoSession.scenarioId, scenarioId);
  for (const item of Object.values(report.result.contextSnapshot.inputProvenance.monitoring ?? {})) {
    assert.equal(item.origin.kind, "demo"); assert.equal(item.origin.scenarioId, scenarioId); assert.ok(item.origin.generatedAt);
  }
  assert.equal(report.result.prediction.probability, null);
  return { path, dataMode: report.result.dataMode, input: report.result.inputSnapshot, provenance: report.result.contextSnapshot.inputProvenance };
}
const runs = [];
try {
  for (const width of [1440, 390]) {
    const initial = monitoringRequests();
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await call("Page.navigate", { url: base + "/warning-tools" });
    await wait(`${button("Evaluate WSD")} && !${button("Evaluate WSD")}.disabled`);
    assert.equal(await evaluate("innerWidth"), width);
    assert.equal(monitoringRequests(), initial);
    await fill("wsd-regionOrSite", "manual-case-site");
    await fill("wsd-farmOrPondId", "manual-case-pond");
    await fill("wsd-ph", "7.02");
    await click(button("Evaluate WSD"));
    await wait(`Boolean(${result(manual)})`);
    assert.ok(await evaluate(`Boolean(${button("Run monitoring demo")})`), "A visible demo entry is required without DB configuration");
    await click(button("Run monitoring demo"));
    await wait(`${panel}.dataset.monitoringSource==='demo' && ${panel}.dataset.monitoringState==='success'`);
    await wait(`${button("Evaluate WSD")} && !${button("Evaluate WSD")}.disabled`);
    assert.equal(await evaluate('document.getElementById("monitoring-feed").value'), "demo-usable");
    assert.equal(await evaluate('document.getElementById("wsd-demo-waterTemperatureC").value'), "");
    assert.equal(await evaluate(`Boolean(${result(demo)})`), false);
    assert.ok(await evaluate(`${panel}.textContent.includes('Demo')`));
    await click(button("Load demo observation into WSD"));
    assert.equal(await evaluate('document.getElementById("wsd-demo-waterTemperatureC").value'), "29");
    assert.equal(await evaluate('document.getElementById("wsd-demo-ph").value'), "8.2");
    await click(button("Evaluate WSD"));
    await wait(`${result(demo)}?.textContent.includes('Example data')`);
    const usable = await download(width, "usable", "demo-usable");
    await evaluate(`${panel}.scrollIntoView({block:'center'})`);
    const usableShot = await capture(`demo-usable-${width}.png`);
    await evaluate(`${result(demo)}.scrollIntoView({block:'start'})`);
    const assessmentShot = await capture(`demo-assessment-${width}.png`);
    await scenario("demo-partial");
    await click(button("Load demo observation into WSD"));
    assert.equal(await evaluate('document.getElementById("wsd-demo-waterTemperatureC").value'), "29");
    assert.equal(await evaluate('document.getElementById("wsd-demo-ph").value'), "");
    await click(button("Evaluate WSD"));
    const partial = await download(width, "partial", "demo-partial");
    assert.equal(partial.provenance.monitoring?.ph, undefined);
    await fill("wsd-demo-ph", "7.02");
    assert.ok(await evaluate(`${result(demo)}.textContent.includes('This result is outdated')`));
    assert.equal(await evaluate(`${button("Download JSON")}.disabled`), true);
    await click(button("Evaluate WSD"));
    const edited = await download(width, "edited", "demo-partial");
    assert.equal(Number(edited.input.ph), 7.02);
    await scenario("demo-stale");
    assert.ok(await evaluate(`${panel}.textContent.includes('stale')`));
    await click(button("Load demo observation into WSD"));
    assert.equal(await evaluate('document.getElementById("wsd-demo-waterTemperatureC").value'), "");
    assert.equal(await evaluate('document.getElementById("wsd-demo-ph").value'), "");
    await scenario("demo-unverified");
    assert.ok(await evaluate(`${panel}.textContent.includes('unit_unverified')`));
    await click(button("Load demo observation into WSD"));
    assert.equal(await evaluate('document.getElementById("wsd-demo-waterTemperatureC").value'), "");
    await click(button("Reset WSD"));
    await click(button("Evaluate WSD"));
    await wait(`${result(demo)}?.textContent.includes('Example data')`);
    assert.ok(await evaluate(`${demo}.textContent.includes('Demo')`));
    // Labels must target the visible demo control rather than the hidden manual one.
    await click(`document.querySelector('label[for="wsd-demo-regionOrSite"]')`);
    assert.equal(await evaluate("document.activeElement.id"), "wsd-demo-regionOrSite");
    assert.ok(await evaluate(`(()=>{const ids=[...document.querySelectorAll('input[id],select[id]')].map(x=>x.id);return new Set(ids).size===ids.length;})()`));
    const demoRequestCount = monitoringRequests() - initial;
    assert.equal(demoRequestCount, 0, "The complete demo must not call the real monitoring APIs");
    await evaluate(`${result(demo)}.scrollIntoView({block:'start'})`);
    const resultShot = await capture(`demo-reset-result-${width}.png`);
    await click(button("Published observations"));
    assert.equal(await evaluate('document.getElementById("wsd-regionOrSite").value'), "manual-case-site");
    assert.equal(await evaluate('document.getElementById("wsd-ph").value'), "7.02");
    assert.ok(await evaluate(`Boolean(${result(manual)})`));
    await click(button("Load monitoring feeds"));
    await wait(`${panel}.textContent.includes('not configured')`);
    assert.equal(await evaluate(`${panel}.dataset.monitoringSource`), "published");
    assert.equal(await evaluate(`Boolean(${button("Load demo observation into WSD")})`), false);
    assert.equal(await evaluate('document.getElementById("wsd-ph").value'), "7.02");
    const afterPublishedRead = monitoringRequests();
    await click(button("Run monitoring demo"));
    await wait(`${panel}.dataset.monitoringSource==='demo' && ${panel}.dataset.monitoringState==='success'`);
    assert.ok(await evaluate(`Boolean(${result(demo)})`), "Returning to demo preserves its own assessment");
    assert.ok(await evaluate(`${result(demo)}.textContent.includes('Example data')`));
    assert.equal(monitoringRequests(), afterPublishedRead, "Explicitly returning to demo must not retry the real API");
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    runs.push({ width, actualInnerWidth: width, demoRequests: demoRequestCount, scenarios: ["usable", "partial", "stale", "unit-unverified"], explicitLoadAndEvaluate: "passed", independentDrafts: "passed", editedOutdated: "passed", resetRemainsExample: "passed", uniqueLabelFocus: "passed", actualPublished503NoFallback: "passed", downloads: [usable, partial, edited].map(({ path, dataMode, input, provenance }) => ({ path, dataMode, input, scenarioId: provenance.demoSession.scenarioId, adoptedFields: Object.keys(provenance.monitoring ?? {}) })), screenshots: [usableShot, assessmentShot, resultShot] });
  }
  console.log(JSON.stringify({ base, runs, scope: "Actual production UI and local demo provider, no demo HTTP interception or DB/device connection" }, null, 2));
} catch (error) { await capture("demo-failure.png").catch(() => {}); throw error; }
finally { await browser.close(); }
