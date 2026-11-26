import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.GADEWS_EXPERIENCE_BASE || "http://127.0.0.1:3221";
const output = process.env.GADEWS_EXPERIENCE_OUTPUT || "/tmp/gadews-c10-c12-browser";
const fixture = process.env.GADEWS_ASSISTANT_FIXTURE === "1";
await mkdir(output, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click: rawClick } = browser;
async function click(expression) {
  await evaluate("(" + expression + ")?.scrollIntoView({block:'center',behavior:'instant'})");
  await delay(120);
  if (await evaluate("innerWidth<600")) {
    const p = await evaluate("(()=>{const e=(" + expression + "),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return {x,y,clear:h===e||e.contains(h)};})()");
    assert.ok(p.clear, "Touch target obscured: " + expression);
    await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
    return call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  return rawClick(expression);
}
const results = [], errors = [], requests = [];
browser.onEvent(event => {
  if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails);
  if (event.method === "Network.requestWillBeSent") requests.push(event.params.request.url);
});
await call("Runtime.enable");
await call("Page.addScriptToEvaluateOnNewDocument", { source: "window.__lifeDraws=0;for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C){const original=C.prototype.drawArrays;C.prototype.drawArrays=function(...args){if(this.canvas.closest('.life-particles'))window.__lifeDraws++;return original.apply(this,args);};}" });
const q = selector => "document.querySelector(" + JSON.stringify(selector) + ")";
const btn = text => "[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&!e.closest('[hidden]')&&e.textContent.trim()===" + JSON.stringify(text) + ")";
const label = text => q('[aria-label="' + text + '"]');
async function shot(name) {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = join(output, name + ".png");
  await writeFile(path, Buffer.from(result.data, "base64")); return path;
}
async function step(name, run) {
  if (process.env.GADEWS_EXPERIENCE_ONLY && !new RegExp(process.env.GADEWS_EXPERIENCE_ONLY).test(name)) return;
  try { results.push({ name, status: "passed", evidence: await run() }); console.log("PASS", name); }
  catch (error) { results.push({ name, status: "failed", error: error.stack, screenshot: await shot("failure-" + results.length), state: await evaluate("({url:location.href,lang:document.documentElement.lang,scrollY,active:document.activeElement?.outerHTML,text:document.body.innerText.slice(0,5000),life:document.querySelector('.life-particles')?.dataset})") }); console.log("FAIL", name, error.message); }
  await save();
}
async function save() { await writeFile(join(output, "results.json"), JSON.stringify({ base, fixture, results, errors, requests, limitations: "Isolated desktop Chromium; mobile viewport emulation, no real handset or paid model call. Fixture response verifies engineering only." }, null, 2)); }
async function navigate(path, locale = "en") {
  await call("Network.setCookie", { name: "gadews-language", value: locale, url: base });
  await evaluate("window.__navigationPending=true");
  await call("Page.navigate", { url: base + path });
  await wait("!window.__navigationPending && document.readyState==='complete' && document.querySelector('[data-gadews-assistant]')");
}
async function metrics(width, height = 1000) {
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await call("Emulation.setTouchEmulationEnabled", { enabled: width < 600, maxTouchPoints: 1 });
}
async function type(selector, text) { await click(selector); await call("Input.insertText", { text }); }
async function closeAssistant() { if (await evaluate("Boolean(" + q("#gadews-assistant-panel") + ")")) await click(label("Close assistant")); }
async function noOverflow() { const size = await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})"); assert.ok(size.scroll <= size.width, JSON.stringify(size)); return size; }
try {
  for (const width of [1440, 390]) {
    await metrics(width);
    await step("assistant " + width, async () => {
      await navigate("/");
      await click(label("Open knowledge assistant")); await wait(q("#gadews-assistant-panel"));
      await type(q(".ga-panel textarea"), "WSSV clinical signs");
      await click(label("Send question"));
      await wait(fixture ? "document.querySelector('.ga-panel').textContent.includes('Local SDK fixture')" : "document.querySelector('.ga-panel').textContent.includes('has not configured')");
      if (fixture) {
        if (await evaluate("Boolean(" + btn("Show full answer") + ")")) await click(btn("Show full answer"));
        await wait("document.querySelector('.ga-panel').textContent.includes('General supplement')");
        await click(q(".ga-panel summary")); await wait(q(".ga-sources li a"));
        const href = await evaluate(q(".ga-sources li a") + ".getAttribute('href')");
        assert.ok(href.startsWith("/") || href.startsWith("https://"));
      } else {
        assert.ok(await evaluate("Boolean(" + btn("Retry") + ")"));
      }
      const screenshot = await shot("assistant-" + width);
      const draft = "Preserve this draft";
      await type(q(".ga-panel textarea"), draft);
      await closeAssistant();
      // An actual Next link transition keeps the root assistant mounted.
      const target = await evaluate("[...document.querySelectorAll('a[href=\"/knowledge-bank\"]')].find(e=>e.getClientRects().length)?.outerHTML");
      assert.ok(target);
      await click("[...document.querySelectorAll('a[href=\"/knowledge-bank\"]')].find(e=>e.getClientRects().length)");
      await wait("location.pathname==='/knowledge-bank'");
      await click(label("Open knowledge assistant"));
      assert.equal(await evaluate(q(".ga-panel textarea") + ".value"), draft);
      await closeAssistant(); await noOverflow();
      return { screenshot, rootSessionPersists: true, paidCalls: 0 };
    });
    await step("life forms and photo reference " + width, async () => {
      await navigate("/");
      await wait(q(".life-particles"));
      await evaluate(q(".life-motion-area") + ".scrollIntoView({block:'center',behavior:'instant'})");
      await wait("document.querySelector('.life-particles').dataset.lifeRenderer==='ready'");
      assert.equal(await evaluate(q(".life-particles") + '.querySelectorAll("button").length'), 0);
      const paths = [];
      for (const id of ["tilapia","shrimp","cell","pathogen"]) {
        await wait(q(".life-particles") + '.dataset.lifeStage===' + JSON.stringify(id));
        await delay(2800);
        paths.push(await shot("life-" + id + "-" + width));
      }
      await noOverflow();
      return { paths, automaticSequence: true };
    });
    await step("risk attention presentation " + width, async () => {
      await navigate("/warning-tools");
      await wait(btn("Evaluate WSD") + " && !" + btn("Evaluate WSD") + ".disabled");
      await click(btn("Evaluate WSD"));
      await wait(q("[data-alert-tone=neutral]"));
      assert.ok(await evaluate(q("[data-assessment-status]") + ".textContent.includes('Evidence is insufficient')"));
      await click(btn("Load WSD example"));
      await evaluate("(()=>{for(const [key,value] of [['pcrQpcrResult','positive'],['whiteSpots','yes']]){const e=document.getElementById('wsd-'+key);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}})()");
      await delay(100); await click(btn("Evaluate WSD"));
      await wait(q("[data-assessment-status=partial]"));
      assert.equal(await evaluate(q("[data-attention]") + ".getAttribute('data-attention')"), "urgent");
      assert.equal(await evaluate(q("[data-alert-tone]") + ".getAttribute('data-alert-tone')"), "urgent");
      assert.equal(await evaluate(q("[data-overall-grade]") + ".textContent"), "Awaiting complete assessment");
      await evaluate(q("[data-alert-tone]") + ".scrollIntoView({block:'center',behavior:'instant'})");
      const screenshot = await shot("risk-urgent-" + width);
      await click("[...document.querySelectorAll('summary')].find(e=>e.textContent==='Model and source')");
      assert.ok(await evaluate("document.querySelector('[data-assessment-status] footer').getClientRects().length"));
      return { neutralEmpty: true, redPartialAttention: true, gradeRemainsIncomplete: true, screenshot };
    });
  }
  await metrics(390);
  await step("assistant keyboard and language", async () => {
    await navigate("/");
    await click(label("Open knowledge assistant"));
    await type(q(".ga-panel textarea"), "Keep across language");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await wait("!document.querySelector('#gadews-assistant-panel')");
    assert.ok(await evaluate("document.activeElement===document.querySelector('.ga-launcher')"));
    await click("[...document.querySelectorAll('.site-language button')].find(e=>e.textContent==='Chinese')");
    await click(label("打开知识助手"));
    assert.equal(await evaluate(q(".ga-panel textarea") + ".value"), "Keep across language");
    await click(label("新对话"));
    assert.equal(await evaluate(q(".ga-panel textarea") + ".value"), "");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
    assert.ok(await evaluate("document.activeElement.closest('#gadews-assistant-panel')!==null"));
    return { escapeRestoresLauncher: true, languagePreservesDraft: true, newConversationClears: true, mobileFocusStaysInside: true };
  });
  await step("actual GPU pause and resume lifecycle", async () => {
    await navigate("/");
    await evaluate(q(".life-motion-area") + ".scrollIntoView({block:'center',behavior:'instant'})");
    await wait("document.querySelector('.life-particles').dataset.lifeRenderer==='ready' && window.__lifeDraws>2");
    await click(label("Open knowledge assistant")); await delay(120);
    const covered = await evaluate("window.__lifeDraws"); await delay(350);
    assert.equal(await evaluate("window.__lifeDraws"), covered);
    await closeAssistant(); await wait("window.__lifeDraws>" + covered);
    const target = await call("Target.createTarget", { url: "about:blank", background: false });
    try {
      await call("Target.activateTarget", { targetId: target.targetId }); await wait("document.hidden"); await delay(150);
      const hidden = await evaluate("window.__lifeDraws"); await delay(350);
      assert.equal(await evaluate("window.__lifeDraws"), hidden);
    } finally { await call("Target.closeTarget", { targetId: target.targetId }); await call("Page.bringToFront"); }
    await wait("!document.hidden");
    const before = await evaluate("window.__lifeDraws"); await wait("window.__lifeDraws>" + before);
    return { covered, hiddenTabTested: true, actualDrawCallsObserved: true };
  });
  await step("reduced motion and 320px/720px layout", async () => {
    await call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await navigate("/");
    await evaluate(q(".life-motion-area") + ".scrollIntoView({block:'center',behavior:'instant'})");
    await wait("document.querySelector('.life-particles').dataset.lifeRenderer==='static'");
    assert.equal(await evaluate(q(".life-static") + ".hidden"), false);
    assert.ok(await evaluate(q(".life-static") + ".getAttribute('src').includes('tilapia')"));
    const sizes = [];
    for (const width of [320, 720, 1024]) {
      await metrics(width, width === 720 ? 500 : 900);
      await evaluate("scrollTo({top:0,behavior:'instant'})");
      await click(label("Open knowledge assistant"));
      sizes.push(await noOverflow());
      const box = await evaluate(q("#gadews-assistant-panel") + ".getBoundingClientRect().toJSON()");
      assert.ok(box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= (width === 720 ? 500 : 900), JSON.stringify(box));
      await shot("reflow-assistant-" + width);
      await closeAssistant();
    }
    await call("Emulation.setEmulatedMedia", { features: [] });
    return { sizes, nativeZoom: false };
  });
  await call("Emulation.setEmulatedMedia", { features: [] });
  await metrics(1440);
  await step("seven routes bilingual access", async () => {
    const rows = [];
    for (const locale of ["zh-CN", "en"]) for (const path of ["/", "/overview", "/risk-map", "/warning-tools", "/knowledge-bank", "/knowledge-bank/literature", "/why-gadews-matters"]) {
      await navigate(path, locale);
      assert.equal(await evaluate("document.documentElement.lang"), locale);
      assert.ok(await evaluate("document.querySelector('.ga-launcher').getClientRects().length"));
      await noOverflow(); rows.push({ path, locale });
    }
    return rows;
  });
  await step("missing point resource static fallback", async () => {
    await call("Network.setBlockedURLs", { urls: ["*/life/photo-points.bin", "*://*.tile.openstreetmap.org/*", "*://cdnjs.cloudflare.com/*"] });
    await navigate("/");
    await evaluate(q(".life-motion-area") + ".scrollIntoView({block:'center',behavior:'instant'})");
    await wait("document.querySelector('.life-description').textContent.includes('Motion is unavailable')");
    assert.equal(await evaluate(q(".life-static") + ".hidden"), false);
    assert.ok(await evaluate("document.querySelector('.report-globe-count').textContent.includes('371')"));
    return { screenshot: await shot("life-fallback"), historicalReports: 371 };
  });
  assert.equal(errors.length, 0, "Uncaught browser exceptions");
} finally { await save(); await browser.close(); }
console.log(JSON.stringify({ passed: results.filter(r => r.status === "passed").length, failed: results.filter(r => r.status === "failed").length, output }));
if (results.some(r => r.status === "failed")) process.exitCode = 1;
