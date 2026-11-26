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
    window.__wave = 0;
    if (window.WebGL2RenderingContext) {
      const gl = WebGL2RenderingContext.prototype, locations = new WeakSet();
      const get = gl.getUniformLocation, set = gl.uniform1f;
      gl.getUniformLocation = function(program, name) {
        const loc = get.call(this, program, name);
        if (name === "waveStrength" && loc) locations.add(loc);
        return loc;
      };
      gl.uniform1f = function(loc, value) {
        if (loc && locations.has(loc)) window.__wave = value;
        return set.call(this, loc, value);
      };
    }` });
  await viewport(390, 844);
  await call("Page.navigate", { url: new URL("/", base).href });
  await wait('document.readyState==="complete" && ' + host + '?.querySelector(".life-motion-area")');
  await step("phone defers offscreen particle data until the form is in view", async () => {
    assert.equal(await evaluate('document.querySelector(".hero .life-particles")'), null);
    assert.equal(await evaluate(host + '.closest("article").dataset.step'), "1");
    assert.ok(await evaluate(host + '.querySelector(".life-motion-area").getBoundingClientRect().top >= innerHeight'));
    await delay(500);
    assert.equal(pointRequests, 0);
    assert.equal(await evaluate(frames), 0);
    await showForm();
    const visible = await verifyFrames(7000);
    assert.ok(visible.canvas[1] <= visible.sectionHeight * 1.5);
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
    const stage = await evaluate(host + ".dataset.lifeStage");
    assert.ok(await evaluate(image + '.src.endsWith("' + stage + '-static.svg")'));
    await call("Emulation.setEmulatedMedia", { features: [] });
    const visible = await verifyFrames(7000);
    assert.equal(await evaluate(canvas + '.hasAttribute("data-old-context")'), false);
    assert.equal(await evaluate(host + ".dataset.lifeStage"), stage);
    return visible;
  });
  await step("desktop and mobile particle budgets recover across both resize directions", async () => {
    const rows = [];
    for (const [width, height, count] of [[1440, 900, 14000], [390, 844, 7000]]) {
      await viewport(width, height);
      await showForm();
      rows.push({ width, ...await verifyFrames(count) });
      assert.equal(await evaluate(host + '.querySelectorAll("button").length'), 0);
    }
    return rows;
  });
  await step("automatic cycle and local mouse wave fade without buttons", async () => {
    await viewport(1440, 900);
    await showForm();
    await verifyFrames(14000);
    assert.equal(await evaluate(host + '.querySelectorAll("button").length'), 0);
    assert.equal(await evaluate('document.querySelector(".life-jump")'), null);
    const stage = await evaluate(host + ".dataset.lifeStage");
    const point = await evaluate('(()=>{const r=' + canvas + '.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
    await call("Input.dispatchMouseEvent", {type:"mouseMoved", ...point});
    await wait("window.__wave > .7");
    await call("Input.dispatchMouseEvent", {type:"mouseMoved",x:12,y:12});
    await wait("window.__wave < .01");
    await wait(host + '.dataset.lifeStage!==' + JSON.stringify(stage));
    return { from: stage, to: await evaluate(host + ".dataset.lifeStage"), shaderResponded: true };
  });
  await step("an actual context loss leaves the current static form", async () => {
    const stage = await evaluate(host + ".dataset.lifeStage");
    await evaluate(canvas + '.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');
    await wait(host + '.dataset.lifeRenderer==="static" && !' + image + '.hidden');
    assert.ok(await evaluate(image + '.src.endsWith("' + stage + '-static.svg")'));
    return { stage };
  });
  assert.deepEqual(errors, []);
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "life-recovery.json"), JSON.stringify({ base, results, errors, pointRequests }, null, 2));
  await browser.close();
  console.log(results.map(({name,status}) => status + " " + name).join("\n"));
}
