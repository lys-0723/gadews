import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.WORKBENCH_PREVIEW_BASE ?? "http://127.0.0.1:3195";
const output = resolve(process.env.WORKBENCH_BROWSER_OUTPUT ?? join(tmpdir(), "gadews-workbench-browser"));
const downloads = join(output, "downloads");
await mkdir(downloads, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click } = browser;
const requests = [];
let failingResource = null;
const interceptionErrors = [];
browser.onEvent((event) => {
  if (event.method === "Network.requestWillBeSent") requests.push(event.params.request.url);
  if (event.method === "Fetch.requestPaused") {
    const { requestId, request } = event.params;
    const operation = failingResource && request.url.includes(failingResource)
      ? call("Fetch.fulfillRequest", { requestId, responseCode: 503, responseHeaders: [{ name: "Content-Type", value: "text/plain" }], body: Buffer.from("Deliberate local test failure").toString("base64") })
      : call("Fetch.continueRequest", { requestId });
    operation.catch((error) => interceptionErrors.push(error.message));
  }
});
const button = (name) => `[...document.querySelectorAll('button')].find(b=>b.getClientRects().length && b.textContent.trim()===${JSON.stringify(name)})`;
const workspace = (name) => `document.querySelector('[aria-label="${name} workspace"]')`;
const result = (name) => `${workspace(name)}.querySelector('[aria-label="Assessment result"]')`;
async function capture(name) {
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = join(output, name); await writeFile(path, Buffer.from(shot.data, "base64")); return path;
}
async function input(id, text) {
  await click(`document.getElementById(${JSON.stringify(id)})`);
  await wait(`document.activeElement.id===${JSON.stringify(id)}`);
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 4, commands: ["selectAll"] });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 4 });
  await call("Input.insertText", { text });
  assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).value`), text);
}
async function download(name, width, mode, label = "example") {
  const target = await mkdtemp(join(downloads, `${name.toLowerCase()}-${label}-${width}-`));
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: target, eventsEnabled: true });
  await click(button("Download JSON"));
  let path;
  for (let i = 0; i < 100; i++) {
    const file = (await readdir(target)).find((f) => f.endsWith(".json"));
    if (file) { path = join(target, file); break; }
    await delay(100);
  }
  assert.ok(path, "Actual JSON download must reach the local download directory");
  const report = JSON.parse(await readFile(path, "utf8"));
  const assessment = report.result;
  assert.equal(report.reportType, "gadews-assessment");
  assert.equal(assessment.dataMode, mode);
  assert.equal(assessment.diseaseId, name === "WSD" ? "wsd" : "tilapia-streptococcosis");
  assert.ok(assessment.assessedAt && assessment.model.version && assessment.model.source.length);
  assert.ok(assessment.inputSnapshot && assessment.contextSnapshot && assessment.quality);
  assert.equal(assessment.prediction.probability, null);
  if (name === "Tilapia") { assert.equal(assessment.ruleTraces.length, 22); assert.equal(assessment.contextSnapshot.dataMode, "draft-preview"); }
  const saved = join(downloads, `${name.toLowerCase()}-${label}-${width}.json`);
  await writeFile(saved, JSON.stringify(report, null, 2) + "\n");
  return { file: saved, diseaseId: assessment.diseaseId, dataMode: assessment.dataMode, status: assessment.status, modelVersion: assessment.model.version };
}
const runs = [];
try {
  await call("Network.setBlockedURLs", { urls: ["*://*.tile.openstreetmap.org/*", "*://cdnjs.cloudflare.com/*", "*://fonts.googleapis.com/*", "*://fonts.gstatic.com/*"] });
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true });
  for (const width of [1440, 390]) {
    const start = requests.length;
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await call("Page.navigate", { url: base + "/warning-tools" });
    await wait(`${button("Evaluate WSD")} && !(${button("Evaluate WSD")}).disabled`);
    assert.equal(await evaluate("innerWidth"), width);
    const fonts = await evaluate(`(async () => {
      const styles=getComputedStyle(document.documentElement), result=[];
      for (const variable of ['--font-inter','--font-jetbrains-mono']) {
        const family=styles.getPropertyValue(variable).split(',')[0].trim();
        const loaded=await document.fonts.load('400 16px '+family);
        result.push({variable,family,loaded:loaded.length,status:loaded.map(f=>f.status)});
      }
      await document.fonts.ready; return result;
    })()`);
    assert.ok(fonts.every((font) => font.family && font.loaded > 0 && font.status.every((state) => state === "loaded")), "Both original font families must load locally with Google Fonts blocked");
    assert.ok(await evaluate(`Boolean(${workspace("WSD")})`), "Workbench must provide an independent WSD workspace");
    assert.equal(await evaluate('document.getElementById("wsd-ph").value'), "");
    assert.equal(await evaluate(`Boolean(${result("WSD")})`), false);
    assert.equal(requests.slice(start).filter((url) => url.includes("/data/knowledge/tilapia-")).length, 0, "Unvisited tilapia panel must not load knowledge");
    await evaluate(`${button("WSD / white spot disease")}.scrollIntoView({block:'center'})`);
    const entry = await capture(`workbench-entry-${width}.png`);
    await click(button("Evaluate WSD"));
    await wait(`${result("WSD")}?.dataset.assessmentStatus==='insufficient_data'`);
    await click(button("Load WSD example"));
    await click(button("Evaluate WSD"));
    await wait(`${result("WSD")}?.dataset.assessmentStatus==='partial'`);
    const wsd = await download("WSD", width, "example");
    await click(button("Tilapia streptococcosis"));
    await wait(`${button("Evaluate tilapia")} && !(${button("Evaluate tilapia")}).disabled`);
    assert.equal(await evaluate('document.getElementById("tilapia-siteId").value'), "");
    assert.equal(await evaluate(`Boolean(${result("Tilapia")})`), false);
    await click(button("Evaluate tilapia"));
    await wait(`${result("Tilapia")}?.dataset.assessmentStatus==='draft_disabled'`);
    assert.ok(await evaluate(`${result("Tilapia")}.textContent.includes('missing')`));
    await click(button("Load tilapia draft example"));
    await click(button("Evaluate tilapia"));
    await wait(`${result("Tilapia")}?.dataset.assessmentStatus==='draft_preview'`);
    assert.ok(await evaluate(`${workspace("Tilapia")}.textContent.includes('Draft simulation')`));
    assert.ok(await evaluate(`Boolean(${workspace("Tilapia")}.querySelector('[aria-label="Tilapia knowledge"]'))`));
    assert.equal(await evaluate(`${workspace("Tilapia")}.querySelectorAll('[aria-label="Tilapia rule traces"] [data-rule-id]').length`), 22);
    const tilapia = await download("Tilapia", width, "draft-preview");
    await evaluate(`${result("Tilapia")}.scrollIntoView({block:'start'})`);
    const simulation = await capture(`tilapia-simulation-${width}.png`);
    await input("tilapia-siteId", "edited-example-site");
    await wait(`${result("Tilapia")}?.textContent.includes('This result is outdated')`);
    assert.equal(await evaluate(`${button("Download JSON")}.disabled`), true);
    await click(button("Evaluate tilapia"));
    await wait(`!${result("Tilapia")}.textContent.includes('This result is outdated')`);
    const edited = await download("Tilapia", width, "draft-preview", "edited");
    const editedReport = JSON.parse(await readFile(edited.file, "utf8"));
    assert.equal(editedReport.result.contextSnapshot.professionalRecords?.length ?? 0, 0, "Edited example must not reuse professional fixtures");
    assert.equal(editedReport.result.inputSnapshot.reviewRecordIds?.length ?? 0, 0);
    await click(button("WSD / white spot disease"));
    assert.equal(await evaluate('document.getElementById("wsd-redBody").value'), "yes");
    assert.equal(await evaluate(`${result("WSD")}.dataset.assessmentStatus`), "partial");
    await input("wsd-ph", "8.5");
    await wait(`${result("WSD")}.textContent.includes('This result is outdated')`);
    assert.equal(await evaluate(`${button("Download JSON")}.disabled`), true);
    await click(button("Reset WSD"));
    assert.equal(await evaluate(`Boolean(${result("WSD")})`), false);
    await click(button("Tilapia streptococcosis"));
    assert.equal(await evaluate('document.getElementById("tilapia-siteId").value'), "edited-example-site");
    await click(button("Reset tilapia"));
    assert.equal(await evaluate('document.getElementById("tilapia-siteId").value'), "");
    assert.equal(await evaluate(`Boolean(${result("Tilapia")})`), false);
    // Keyboard focus follows visible, editable fields; hidden panels cannot take focus.
    await click('document.getElementById("tilapia-siteId")');
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate("document.activeElement.id"), "tilapia-unitId");
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
    const knowledgeRequests = requests.slice(start).filter((url) => url.includes("/data/knowledge/tilapia-"));
    assert.equal(knowledgeRequests.length, 1, "Knowledge success survives disease switches");
    assert.equal(requests.slice(start).filter((url) => /fonts\.(?:googleapis|gstatic)\.com/.test(url)).length, 0);
    runs.push({ width, actualInnerWidth: width, fonts, googleFontsBlocked: true, blank: "passed", manualDisabled: "passed", explicitExamples: "passed", editedFixtureRemoved: "passed", diseaseIsolation: "passed", outdatedDownloadBlocked: "passed", reset: "passed", keyboard: "passed", knowledgeRequests: knowledgeRequests.length, downloads: [wsd, tilapia, edited], screenshots: [entry, simulation] });
    await call("Fetch.enable", { patterns: [{ urlPattern: "*/data/models/wsd-warning-model.json" }, { urlPattern: "*/data/knowledge/tilapia-streptococcosis.json" }] });
    failingResource = "/data/models/wsd-warning-model.json";
    await call("Page.navigate", { url: base + "/warning-tools" });
    await wait(button("Retry configuration"));
    assert.equal(await evaluate(`${button("Evaluate WSD")}.disabled`), true);
    assert.equal(await evaluate(`Boolean(${result("WSD")})`), false);
    failingResource = null;
    await click(button("Retry configuration"));
    await wait(`${button("Evaluate WSD")} && !${button("Evaluate WSD")}.disabled`);
    failingResource = "/data/knowledge/tilapia-streptococcosis.json";
    await click(button("Tilapia streptococcosis"));
    await wait(button("Retry knowledge"));
    assert.equal(await evaluate(`${button("Evaluate tilapia")}.disabled`), true);
    assert.equal(await evaluate(`Boolean(${result("Tilapia")})`), false);
    failingResource = null;
    await click(button("Retry knowledge"));
    await wait(`${button("Evaluate tilapia")} && !${button("Evaluate tilapia")}.disabled`);
    await call("Fetch.disable");
    runs.at(-1).configurationFailureRetry = "passed for both diseases, HTTP503 then explicit retry";
  }
  assert.deepEqual(interceptionErrors, []);
  console.log(JSON.stringify({ base, runs, scope: "Real local browser, synthetic examples and prototype rules; no live service or scientific scoring" }, null, 2));
} catch (error) { await capture("workbench-failure.png").catch(() => {}); throw error; }
finally { await browser.close(); }
