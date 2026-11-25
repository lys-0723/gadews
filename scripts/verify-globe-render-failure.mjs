import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";
const out = process.env.GADEWS_FAULT_OUTPUT || "/tmp/gadews-globe-render-failure";
await mkdir(out, { recursive: true });
const results = [];
for (const fault of ["draw", "shader"]) {
  const b = await openBrowser(), errors = [];
  b.onEvent(e => { if (e.method === "Runtime.exceptionThrown")
    errors.push(e.params.exceptionDetails.exception?.description?.slice(0, 350) || e.params.exceptionDetails.text); });
  try {
    await b.call("Runtime.enable");
    await b.call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await b.call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await b.call("Page.addScriptToEvaluateOnNewDocument", { source: fault === "draw" ? `{
   const original=WebGL2RenderingContext.prototype.drawElements;
   WebGL2RenderingContext.prototype.drawElements=function(...args){if(this.canvas.closest('.report-globe')){window.__injectedFault=true;throw new Error('Injected globe draw failure');}return original.apply(this,args);};
  }` : `{
   const original=WebGL2RenderingContext.prototype.compileShader;
   WebGL2RenderingContext.prototype.compileShader=function(shader){const source=this.getShaderSource(shader);if(this.canvas.closest('.report-globe')&&source.includes('#define PHONG')){window.__injectedFault=true;this.shaderSource(shader,source+'\\nINVALID_GLOBE_SHADER');}return original.call(this,shader);};
  }` });
    await b.call("Page.navigate", { url: process.env.GADEWS_FAULT_URL || "http://127.0.0.1:3221/" });
    await b.wait("document.querySelector('.report-globe') && window.__injectedFault");
    await delay(1000);
    const state = await b.evaluate("({state:document.querySelector('.report-globe').dataset.renderer, fallback:!!document.querySelector('.report-globe-static'), canvasCount:document.querySelectorAll('.report-globe-canvas canvas').length})");
    await writeFile(out + "/" + fault + ".png", Buffer.from((await b.call("Page.captureScreenshot", { format: "png" })).data, "base64"));
    assert.equal(state.state, "error", "Failed rendering must leave ready state");
    assert.equal(state.fallback, true, "Real static map and reports must remain available");
    assert.equal(state.canvasCount, 0, "Failed renderer must release canvas");
    assert.equal(errors.length, 0, "Render failure must be handled");
    assert.equal(await b.evaluate("[...document.querySelectorAll('.report-globe-label')].filter(e=>getComputedStyle(e).visibility==='visible').length"), 0, "Stale 3D labels must not overlay the static map");
    await b.click("[...document.querySelectorAll('.report-globe-access button')].find(e=>/Browse all reports|\u67E5\u770B\u5168\u90E8\u62A5\u544A/.test(e.textContent))");
    await b.wait("document.querySelector('.report-globe-dialog')");
    assert.equal(await b.evaluate("document.querySelectorAll('[data-globe-report]').length"), 371, "All historical reports must remain accessible");
    results.push({ fault, status: "passed", state, errors });
  }
  catch (e) {
    results.push({ fault, status: "failed", error: String(e), errors, state: await b.evaluate("document.querySelector('.report-globe')?.dataset.renderer") });
  }
  finally {
    await b.close();
  }
}
await writeFile(out + "/results.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(x => x.status === "failed"))
  process.exitCode = 1;
