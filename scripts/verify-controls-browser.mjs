import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.C05_PREVIEW_BASE ?? "http://127.0.0.1:3194";
const output = process.env.C05_BROWSER_OUTPUT ?? join(tmpdir(), "gadews-c05-controls");
const only = process.env.C05_CONTROLS_CASE;
await mkdir(output, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click } = browser;
const button = (name) => `document.querySelector('button[aria-label=${JSON.stringify(name)}]')`;
const runs = [];
const screenshot = async (name) => {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const path = join(output, name);
  await writeFile(path, Buffer.from(result.data, "base64"));
  return path;
};
const panelState = `(() => {
  const p = document.querySelector('[data-layer-panel]');
  return { hidden: p.getAttribute('aria-hidden'),
    disease: p.querySelector('[aria-label="Disease filter"]').textContent,
    switches: [...p.querySelectorAll('[role="switch"]')].map(x => [x.getAttribute('aria-label'), x.getAttribute('aria-checked')]),
    accordions: [...p.querySelectorAll('button[aria-expanded][aria-controls]')].map(x => [x.textContent, x.getAttribute('aria-expanded')]) };
})()`;
const marker = `[...document.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive')].find(p => {
  const r=p.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
  return x>10 && x<innerWidth-10 && y>135 && y<innerHeight-40 && document.elementFromPoint(x,y)===p;
})`;
const longStatus = "historical_presence_in_report_year";
if (only === "qaad-status") {
  const records = JSON.parse(await readFile("public/data/qaad-surveillance-display.json", "utf8"));
  const record = records.find((item) => item.disease_id === "WSD" && item.status_summary === longStatus);
  assert.ok(record, "Published QAAD data must contain the long known status used in this layout check");
  // One real source row, moved to an unobscured map point only inside this browser fixture.
  // This isolates status rendering from the order/overlap of thousands of markers.
  const fixture = { ...record, latitude: 20, longitude: 104 };
  browser.onEvent((event) => {
    if (event.method !== "Fetch.requestPaused") return;
    const { requestId, request } = event.params;
    const body = request.url.includes("qaad-surveillance-display") ? [fixture] : [];
    void call("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
  });
  await call("Fetch.enable", { patterns: [{ urlPattern: "*qaad-surveillance-display.json", requestStage: "Request" }, { urlPattern: "*woah-wahis-aquatic-disease-reports.geo.json", requestStage: "Request" }] });
}
try {
  const widths = only === "popup" ? [1440] : [1440, 320, 360, 390];
  for (const width of widths) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await call("Page.navigate", { url: base + "/risk-map" });
    await wait(`document.querySelector('.leaflet-container') && ${button("Close panel")}`);
    assert.equal(await evaluate("innerWidth"), width);
    const row = { width };
    if (only !== "popup") {
      const geometry = await evaluate(`(() => {
        const p=document.querySelector('[data-layer-panel]').getBoundingClientRect();
        const b=${button("Close panel")}; const r=b.getBoundingClientRect();
        const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
        return {panel:{left:p.left,right:p.right,width:p.width},close:{left:r.left,right:r.right,width:r.width},clear:hit===b||b.contains(hit)};
      })()`);
      assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= width, `${width}px panel exceeds viewport: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.close.left >= 0 && geometry.close.right <= width && geometry.clear, `${width}px close button is outside viewport or obscured: ${JSON.stringify(geometry)}`);
      await click(button("Close panel"));
      await wait('Number(getComputedStyle(document.querySelector("[data-layer-panel]")).opacity) === 0');
      assert.equal(await evaluate('document.querySelector("[data-layer-panel]").getAttribute("aria-hidden")'), "true");
      await click(button("Open panel"));
      await wait('Number(getComputedStyle(document.querySelector("[data-layer-panel]")).opacity) === 1');
      row.geometry = geometry;
      row.panelCloseReopen = "passed";
      row.panelScreenshot = await screenshot(`map-panel-${width}.png`);
    }
    if (only === "panel") { runs.push(row); continue; }
    await wait(only === "qaad-status" ? 'document.querySelectorAll(".leaflet-interactive").length === 1' : 'document.querySelectorAll(".leaflet-interactive").length >= 500');
    await click(button("Disease filter"));
    await click(`[...document.querySelectorAll('[role="option"]')].find(x => x.textContent.trim() === 'WSD')`);
    await wait(`${button("Disease filter")}.textContent.includes('WSD')`);
    // Change internal accordion state so unmounting/remounting the panel is caught.
    await click(`[...document.querySelectorAll('[data-layer-panel] button')].find(x => x.textContent.trim() === 'Base Layers')`);
    if (width < 600) {
      await click(button("Close panel"));
      await wait('Number(getComputedStyle(document.querySelector("[data-layer-panel]")).opacity) === 0');
    }
    const before = await evaluate(panelState);
    await wait(marker);
    // Use a real tap on narrow touch layouts and a moved mouse on desktop.
    // The point is inside the viewport and was checked against elementFromPoint.
    const markerPoint = await evaluate(`(() => { const r=(${marker}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    if (width < 600) {
      await call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [markerPoint] });
      await call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...markerPoint });
      await click(marker);
    }
    await wait('document.querySelector(".leaflet-popup-content") && getComputedStyle(document.querySelector(".leaflet-popup")).opacity === "1"');
    const background = await evaluate(`(() => {
      const panel=document.querySelector('[data-layer-panel]');
      const header=[...document.querySelectorAll('nav')].find(x => x.textContent.includes('Risk Map')).parentElement.parentElement;
      const toggle=document.querySelector('button[aria-label="Close panel"],button[aria-label="Open panel"]');
      return { panelDisplay:getComputedStyle(panel).display, headerDisplay:getComputedStyle(header).display,
        toggleDisplay:getComputedStyle(toggle).display, headingRects:[...panel.querySelectorAll('button[aria-expanded][aria-controls]')].map(x => x.getClientRects().length),
        popup:(()=>{const r=document.querySelector('.leaflet-popup').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})() };
    })()`);
    assert.equal(background.panelDisplay, "none", `Popup must remove background panel from layout: ${JSON.stringify(background)}`);
    assert.equal(background.headerDisplay, "none", "Popup hides the background page header with display:none");
    assert.equal(background.toggleDisplay, "none", "Popup hides the panel toggle with display:none");
    assert.ok(background.headingRects.length > 0 && background.headingRects.every(x => x === 0), "No accordion heading can paint through the popup");
    assert.ok(background.popup.left >= 0 && background.popup.right <= width && background.popup.top >= 0 && background.popup.bottom <= 1000, "Public popup remains inside the viewport");
    if (only === "qaad-status") {
      const status = await evaluate(`(() => {
        const content=document.querySelector('.leaflet-popup-content');
        const row=[...content.querySelectorAll('p')].find(p=>p.firstElementChild?.textContent==='Status');
        const value=row?.lastElementChild;
        if (!value) throw new Error('QAAD Status row not found');
        const rowRect=row.getBoundingClientRect(), valueRect=value.getBoundingClientRect();
        const range=document.createRange(); range.selectNodeContents(value);
        const glyphs=[...range.getClientRects()].map(r=>({left:r.left,right:r.right}));
        const scroller=content.firstElementChild;
        return { text:value.textContent,row:{left:rowRect.left,right:rowRect.right},value:{left:valueRect.left,right:valueRect.right},glyphs,
          scrollWidth:scroller.scrollWidth,clientWidth:scroller.clientWidth };
      })()`);
      assert.equal(status.text, longStatus, "Layout must preserve the exact source status token");
      assert.ok(status.glyphs.length > 0 && status.glyphs.every(rect => rect.left >= status.row.left - 1 && rect.right <= status.row.right + 1 && rect.right <= width), `${width}px QAAD status text is clipped: ${JSON.stringify(status)}`);
      assert.ok(status.scrollWidth <= status.clientWidth + 1, `${width}px QAAD content must not require hidden horizontal scrolling: ${JSON.stringify(status)}`);
      row.qaadStatus = status;
    }
    row.popupScreenshot = await screenshot(`map-popup-${width}.png`);
    await click('document.querySelector(".leaflet-popup-close-button")');
    await wait('!document.querySelector(".leaflet-popup-content")');
    const restored = await evaluate(panelState);
    assert.deepEqual(restored, before, "Closing popup restores panel visibility, filters, layer switches and accordion state");
    assert.notEqual(await evaluate('getComputedStyle(document.querySelector("[data-layer-panel]")).display'), "none");
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
    row.popupBackground = background;
    row.popupCloseRestoresState = "passed";
    runs.push(row);
  }
  console.log(JSON.stringify({ base, runs, externalBasemapTilesBlocked: true }, null, 2));
} catch (error) {
  await screenshot(`failure-${only ?? "all"}.png`).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
