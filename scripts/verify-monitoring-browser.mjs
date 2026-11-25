import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.MONITORING_PREVIEW_BASE ?? "http://127.0.0.1:3198";
const output = resolve(process.env.MONITORING_BROWSER_OUTPUT ?? join(tmpdir(), "gadews-monitoring-browser"));
await mkdir(output, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click } = browser;
const button = (name) => `[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(name)})`;
const panel = `document.querySelector('[aria-label="Monitoring observations"]')`;
const result = `document.querySelector('[aria-label="WSD workspace"] [aria-label="Assessment result"]')`;
const network = [];
const interceptionErrors = [];
let interception = false;
let requestFailure = false;
let delayed = null;
const now = Date.now();
const observedAt = new Date(now - 10 * 60_000).toISOString();
const ingestedAt = new Date(now - 9 * 60_000).toISOString();
const feeds = ["a", "b"].map((id) => ({ id: `synthetic-${id}`, label: `Synthetic browser fixture ${id.toUpperCase()}`, siteId: "synthetic-site", pondId: "synthetic-pond", maxAgeHours: 1, unitVerificationRef: "Synthetic unit declaration; browser test only" }));
feeds.push({ ...feeds[0], id: "synthetic-unverified", label: "Synthetic unverified units", unitVerificationRef: null });
feeds.push({ ...feeds[0], id: "synthetic-stale", label: "Synthetic expired observation" });
const metric = (value, unit) => ({ value, unit, state: value === null ? "missing" : "usable", issues: value === null ? ["missing"] : [] });
const snapshot = (id) => {
  const data = { schemaVersion: "1.0", feed: feeds.find((feed) => feed.id === id), fetchedAt: new Date(now).toISOString(), observation: {
  observedAt, ingestedAt, reference: `monitoring:${id}:${observedAt}`,
  metrics: { waterTemperatureC: metric(id === "synthetic-a" ? 29 : null, "°C"), dissolvedOxygenMgL: metric(5.2, "mg/L"), ph: metric(id === "synthetic-b" ? 8.2 : null, "pH") },
  } };
  if (id === "synthetic-unverified" || id === "synthetic-stale") {
    data.observation.metrics.waterTemperatureC.value = 28;
    for (const item of Object.values(data.observation.metrics)) {
      if (item.value !== null) { item.state = id === "synthetic-stale" ? "stale" : "unit_unverified"; item.issues = [item.state]; }
    }
    if (id === "synthetic-stale") {
      data.observation.observedAt = new Date(now - 3 * 3_600_000).toISOString();
      data.observation.ingestedAt = new Date(now - 2.9 * 3_600_000).toISOString();
      data.observation.reference = `monitoring:${id}:${data.observation.observedAt}`;
    }
  }
  return data;
};
async function fulfill(requestId, body, status = 200) {
  await call("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Cache-Control", value: "no-store" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
}
browser.onEvent((event) => {
  if (event.method === "Network.requestWillBeSent") network.push(event.params.request.url);
  if (event.method === "Fetch.requestPaused") {
    const { requestId, request } = event.params;
    (async () => {
      if (!interception) return call("Fetch.continueRequest", { requestId });
      const url = new URL(request.url);
      if (requestFailure) return fulfill(requestId, { error: "Synthetic deliberate read failure" }, 503);
      if (url.pathname.endsWith("/feeds")) return fulfill(requestId, { schemaVersion: "1.0", feeds });
      const id = url.searchParams.get("feedId");
      if (delayed?.feedId === id) { delayed.requestId = requestId; return; }
      return fulfill(requestId, snapshot(id));
    })().catch((error) => interceptionErrors.push(error.message));
  }
});
async function capture(name) {
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = join(output, name); await writeFile(file, Buffer.from(shot.data, "base64")); return file;
}
async function input(id, text) {
  await click(`document.getElementById(${JSON.stringify(id)})`);
  await wait(`document.activeElement.id===${JSON.stringify(id)}`);
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 4, commands: ["selectAll"] });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 4 });
  await call("Input.insertText", { text });
  assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).value`), text);
}
async function selectFeed(id) {
  await click('document.getElementById("monitoring-feed")');
  await evaluate(`(() => {const s=document.getElementById('monitoring-feed');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function currentDownload(width, manualPh) {
  const directory = await mkdtemp(join(output, `download-${width}-`));
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
  await click(button("Download JSON"));
  let file;
  for (let i = 0; i < 100; i++) { file = (await readdir(directory)).find((name) => name.endsWith(".json")); if (file) break; await delay(100); }
  assert.ok(file, "Browser must save an actual report file");
  const path = join(directory, file); const report = JSON.parse(await readFile(path, "utf8"));
  assert.equal(report.result.dataMode, "manual");
  assert.equal(report.result.inputSnapshot.waterTemperatureC, 29);
  assert.equal(report.result.inputSnapshot.ph, manualPh ?? 8.2);
  assert.equal(report.result.contextSnapshot.observations.waterTemperatureC.observedAt, observedAt);
  const monitoring = report.result.contextSnapshot.inputProvenance.monitoring;
  assert.equal(monitoring.waterTemperatureC.snapshot.feed.id, "synthetic-a");
  if (manualPh === undefined) assert.equal(monitoring.ph.snapshot.feed.id, "synthetic-b");
  else { assert.equal(monitoring.ph, undefined); assert.equal(Number(report.result.inputSnapshot.ph), Number(manualPh)); }
  assert.equal(report.result.prediction.probability, null);
  return path;
}
const runs = [];
try {
  for (const width of [1440, 390]) {
    interception = false; requestFailure = false; delayed = null;
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await call("Page.navigate", { url: base + "/warning-tools" });
    await wait(`${button("Evaluate WSD")} && !${button("Evaluate WSD")}.disabled`);
    assert.ok(await evaluate(`Boolean(${panel})`), "Workbench must include a monitoring preview panel");
    const initialRequests = network.filter((url) => url.includes("/api/monitoring/")).length;
    assert.equal(initialRequests, width === 1440 ? 0 : runs[0].monitoringRequestTotal, "Initial entry must not issue a new monitoring request");
    await click(button("Load monitoring feeds"));
    await wait(`${panel}.textContent.includes('not configured')`);
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "");
    await call("Fetch.enable", { patterns: [{ urlPattern: "*/api/monitoring/*" }] });
    interception = true;
    await click(button("Retry monitoring"));
    await wait('document.getElementById("monitoring-feed")?.options.length>=3');
    await selectFeed("synthetic-a");
    await wait(`${panel}.textContent.includes('29') && ${button("Apply monitoring to empty WSD fields")}`);
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "");
    assert.equal(await evaluate(`${button("Apply monitoring to empty WSD fields")}.disabled`), true, "No identity must block apply");
    await input("wsd-regionOrSite", "synthetic-site");
    await input("wsd-farmOrPondId", "wrong-pond");
    assert.equal(await evaluate(`${button("Apply monitoring to empty WSD fields")}.disabled`), true, "Different nonempty pond must block apply");
    await input("wsd-farmOrPondId", "synthetic-pond");
    await click(button("Evaluate WSD"));
    await click(button("Apply monitoring to empty WSD fields"));
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "29");
    assert.equal(await evaluate('document.getElementById("wsd-ph").value'), "");
    assert.ok(await evaluate(`${result}.textContent.includes('This result is outdated')`));
    assert.equal(await evaluate(`${button("Download JSON")}.disabled`), true);
    await selectFeed("synthetic-b");
    await wait(`${panel}.textContent.includes('8.2')`);
    await click(button("Apply monitoring to empty WSD fields"));
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "29", "Second feed must not replace the first observation");
    await click(button("Evaluate WSD"));
    const report = await currentDownload(width);
    await evaluate(`${panel}.scrollIntoView({block:'center'})`);
    const preview = await capture(`monitoring-preview-${width}.png`);
    await evaluate(`${result}.scrollIntoView({block:'start'})`);
    const assessment = await capture(`monitoring-result-${width}.png`);
    const decimalReports = [];
    for (const decimal of ["7.02", "0.05"]) {
      await click('document.getElementById("wsd-ph")');
      await call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 4, commands: ["selectAll"] });
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 4 });
      let prefix = "";
      for (const text of decimal) {
        prefix += text;
        await call("Input.insertText", { text });
        await wait(`document.getElementById('wsd-ph').value===${JSON.stringify(prefix)}`);
      }
      await click(button("Evaluate WSD"));
      decimalReports.push(await currentDownload(width, decimal));
    }
    await input("wsd-farmOrPondId", "other-pond");
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "", "Changed scope must clear still-imported temperature");
    assert.equal(await evaluate('document.getElementById("wsd-ph").value'), "0.05", "Manually replaced pH must retain its hand-entered value");
    await click(button("Load WSD example"));
    assert.equal(await evaluate(`${button("Apply monitoring to empty WSD fields")}.disabled`), true);
    await click(button("Tilapia streptococcosis"));
    await wait(button("Evaluate tilapia"));
    assert.equal(await evaluate(`Boolean(${button("Apply monitoring to empty WSD fields")} )`), false);
    assert.equal(await evaluate('document.getElementById("tilapia-siteId").value'), "");
    await click(button("WSD / white spot disease"));
    await click(button("Reset WSD"));
    requestFailure = true;
    await selectFeed("synthetic-a");
    await wait(button("Retry monitoring"));
    requestFailure = false;
    await click(button("Retry monitoring"));
    await wait(`${panel}.textContent.includes('29')`);
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "");
    delayed = { feedId: "synthetic-a", requestId: null };
    await click(button("Refresh observation"));
    for (let i = 0; i < 100 && !delayed.requestId; i++) await delay(50);
    assert.ok(delayed.requestId, "Hold the earlier observation request before changing selection");
    const oldRequest = delayed.requestId;
    await selectFeed("synthetic-b");
    await wait(`${panel}.dataset.monitoringState==='success' && ${panel}.textContent.includes('8.2')`);
    delayed = null;
    try { await fulfill(oldRequest, snapshot("synthetic-a")); }
    catch (error) { if (!/Invalid InterceptionId|Invalid interceptionId|No resource with given identifier/i.test(error.message)) throw error; }
    await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    assert.equal(await evaluate('document.getElementById("monitoring-feed").value'), "synthetic-b");
    assert.ok(await evaluate(`${panel}.textContent.includes('8.2')`));
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "");
    await input("wsd-regionOrSite", "synthetic-site");
    await input("wsd-farmOrPondId", "synthetic-pond");
    await selectFeed("synthetic-unverified");
    await wait(`${panel}.dataset.monitoringState==='success' && ${panel}.textContent.includes('unit_unverified')`);
    assert.equal(await evaluate(`${button("Apply monitoring to empty WSD fields")}.disabled`), true, "Unverified units are preview only");
    await selectFeed("synthetic-stale");
    await wait(`${panel}.dataset.monitoringState==='success' && ${panel}.textContent.includes('stale')`);
    assert.equal(await evaluate(`${button("Apply monitoring to empty WSD fields")}.disabled`), true, "Expired observations cannot fill inputs");
    assert.equal(await evaluate('document.getElementById("wsd-waterTemperatureC").value'), "");
    await call("Fetch.disable");
    runs.push({ width, actualInnerWidth: await evaluate("innerWidth"), initialIdle: "passed", defaultUnconfigured: "passed", explicitPreview: "passed", matchingOnly: "passed", emptyOnly: "passed", independentProvenance: "passed", outdatedExportBlocked: "passed", manualAndScopeEdits: "passed", examplesBlocked: "passed", tilapiaReadOnly: "passed", failedRetry: "passed", cancelledOrLateSelection: "passed", unverifiedUnitsBlocked: "passed", staleBlocked: "passed", report, decimalReports, screenshots: [preview, assessment], monitoringRequestTotal: network.filter((url) => url.includes("/api/monitoring/")).length });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  }
  assert.deepEqual(interceptionErrors, []);
  console.log(JSON.stringify({ base, runs, fixtureScope: "Synthetic browser HTTP responses only, never real device/database integration; initial unconfigured response is actual production route" }, null, 2));
} catch (error) { await capture("monitoring-failure.png").catch(() => {}); throw error; }
finally { await browser.close(); }
