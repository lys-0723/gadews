import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.GADEWS_EXPERIENCE_BASE || "http://127.0.0.1:3251";
const output = process.env.GADEWS_EXPERIENCE_OUTPUT || "/tmp/gadews-life-recovery";
const browser = await openBrowser();
const { call, evaluate, wait } = browser;
const results = [];
const errors = [];
let pointRequests = 0;
browser.onEvent(event => {
  if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails.text);
  if (event.method === "Network.requestWillBeSent" && event.params.request.url.endsWith("/life/photo-points.bin")) pointRequests++;
});
const host = 'document.querySelector(".life-particles")';
const canvas = host + '.querySelector("canvas")';
const image = host + '.querySelector(".life-static")';
const frames = 'Number(' + canvas + '.dataset.lifeFrames || 0)';
const autoButton = host + '.querySelector(".life-shapes button")';

async function step(name, run) {
  try { results.push({ name, status: "passed", evidence: await run() }); }
  catch (error) { results.push({ name, status: "failed", error: String(error) }); throw error; }
}
async function viewport(width, height) {
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
}
async function showForm() {
  await evaluate(host + '.querySelector(".life-motion-area").scrollIntoView({block:"center",behavior:"instant"})');
}
async function verifyFrames(count) {
  await wait(host + '.dataset.lifeRenderer==="ready" && Number(' + canvas + '.dataset.lifeCount)===' + count + ' && ' + frames + '>3');
  const before = await evaluate(frames);
  await wait(frames + ">" + before);
  return evaluate('({frames:' + frames + ',canvas:[' + canvas + '.width,' + canvas + '.height],sectionHeight:' + host + '.clientHeight})');
}

try {
  await call("Runtime.enable");
  await call("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__observedGlobeDraws = 0;
    if (window.WebGL2RenderingContext) {
      for (const method of ["drawArrays", "drawElements"]) {
        const original = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function (...args) {
          if (this.canvas.closest(".globe-stage")) window.__observedGlobeDraws++;
          return original.apply(this, args);
        };
      }
    }` });
  await viewport(390, 844);
  await call("Page.navigate", { url: new URL("/", base).href });
  await wait('document.readyState==="complete" && ' + host + '?.querySelector(".life-motion-area")');
  await step("phone defers offscreen particle data until the form is in view", async () => {
    assert.ok(await evaluate(host + '.querySelector(".life-motion-area").getBoundingClientRect().top >= innerHeight'));
    await delay(500);
    assert.equal(pointRequests, 0);
    assert.equal(await evaluate(frames), 0);
    await showForm();
    const visible = await verifyFrames(10500);
    assert.ok(visible.canvas[1] < visible.sectionHeight / 2);
    return { initialPointRequests: 0, visible };
  });
  await step("returning to the phone header suspends just the offscreen form", async () => {
    await evaluate('scrollTo({top:0,behavior:"instant"})');
    await delay(350);
    const before = await evaluate(frames);
    await delay(400);
    assert.equal(await evaluate(frames), before);
    await showForm();
    await wait(frames + ">" + before);
    return { pausedFrame: before, resumedFrame: await evaluate(frames) };
  });
  await step("reduced motion back to animation keeps the selected form on a fresh canvas", async () => {
    await evaluate(canvas + '.setAttribute("data-old-context","1")');
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await wait(host + '.dataset.lifeRenderer==="static" && !' + image + '.hidden');
    await evaluate(host + '.querySelectorAll(".life-shapes button")[2].click()');
    await wait(host + '.dataset.lifeStage==="shrimp" && ' + image + '.src.endsWith("shrimp-static.svg")');
    await call("Emulation.setEmulatedMedia", { features: [] });
    const visible = await verifyFrames(10500);
    assert.equal(await evaluate(canvas + '.hasAttribute("data-old-context")'), false);
    assert.equal(await evaluate(host + ".dataset.lifeStage"), "shrimp");
    return visible;
  });
  await step("desktop and mobile particle budgets recover across both resize directions", async () => {
    const rows = [];
    for (const [width, height, count] of [[1440, 900, 39000], [390, 844, 10500]]) {
      await viewport(width, height);
      await showForm();
      rows.push({ width, ...await verifyFrames(count) });
      assert.equal(await evaluate(host + ".dataset.lifeStage"), "shrimp");
    }
    return rows;
  });
  await step("desktop focus hides country labels, stops globe draws and restores the globe on return", async () => {
    await viewport(1440, 900);
    await evaluate('scrollTo({top:0,behavior:"instant"})');
    await wait("window.__observedGlobeDraws > 2");
    const toggle = host + '.querySelector(".life-actions button[aria-pressed]")';
    const globe = 'document.querySelector(".globe-stage")';
    const visibleLabels = '[...document.querySelectorAll(".report-globe-label")].filter(el => el.getClientRects().length && getComputedStyle(el).visibility === "visible").length';
    await evaluate(toggle + ".click()");
    await wait(host + '.classList.contains("is-focused") && !' + globe + ".getClientRects().length");
    assert.ok(Math.abs(await evaluate('document.querySelector(".hero").getBoundingClientRect().top')) < 120, "focused scene should start in view");
    assert.equal(await evaluate(visibleLabels), 0);
    await delay(250);
    const paused = await evaluate("window.__observedGlobeDraws");
    await delay(400);
    assert.equal(await evaluate("window.__observedGlobeDraws"), paused);
    await evaluate(toggle + ".click()");
    await wait(globe + ".getClientRects().length && window.__observedGlobeDraws > " + paused);
    await wait(visibleLabels + " > 0");
    return { pausedDraws: paused, resumedDraws: await evaluate("window.__observedGlobeDraws"), restoredLabels: await evaluate(visibleLabels) };
  });
  await step("an actual context loss leaves the sourced static form selectable", async () => {
    await evaluate(canvas + '.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');
    await wait(host + '.dataset.lifeRenderer==="static" && !' + image + '.hidden');
    await evaluate(host + '.querySelectorAll(".life-shapes button")[3].click()');
    await wait(host + '.dataset.lifeStage==="cell" && ' + image + '.src.endsWith("cell-static.svg")');
    assert.equal(await evaluate(autoButton + '.getAttribute("aria-pressed")'), "false");
    return { selected: await evaluate(host + ".dataset.lifeStage") };
  });
  assert.deepEqual(errors, []);
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "life-recovery.json"), JSON.stringify({ base, results, errors, pointRequests }, null, 2));
  await browser.close();
  console.log(results.map(({name,status}) => status + " " + name).join("\n"));
}
