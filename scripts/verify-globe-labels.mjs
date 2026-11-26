import assert from "node:assert/strict";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const url = process.env.GADEWS_GLOBE_URL || "http://127.0.0.1:3251/";
const results = [];

// Runs in the page. Attribute old values let us distinguish a real focus-order
// change from writing -1 to every hidden label again on every animation frame.
async function observeLabels() {
  const host = document.querySelector(".report-globe-labels");
  const changes = { frames: 0, styleWrites: 0, focusOrderWrites: 0, redundantFocusWrites: 0 };
  const observer = new MutationObserver((entries) => {
    const nextFocusValues = new Map();
    for (const entry of entries.reverse()) {
      if (entry.attributeName === "style") {
        changes.styleWrites++;
        continue;
      }
      const value = nextFocusValues.get(entry.target) ?? entry.target.getAttribute("tabindex");
      if (entry.oldValue === value) changes.redundantFocusWrites++;
      nextFocusValues.set(entry.target, entry.oldValue);
      changes.focusOrderWrites++;
    }
  });
  observer.observe(host, { attributes: true, subtree: true, attributeOldValue: true, attributeFilter: ["style", "tabindex"] });
  await new Promise((resolve) => {
    function sample() {
      if (++changes.frames === 45) resolve();
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  observer.disconnect();
  const labels = [...host.querySelectorAll("button")];
  const visible = labels.filter((label) => getComputedStyle(label).visibility === "visible");
  return {
    ...changes,
    visibleLabels: visible.length,
    focusOrderMatches: labels.every((label) => (label.tabIndex === 0) === visible.includes(label)),
  };
}

for (const [width, height] of [[1440, 1000], [390, 844]]) {
  const browser = await openBrowser();
  try {
    await browser.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 480 });
    await browser.call("Page.navigate", { url });
    await browser.wait("document.querySelector('.report-globe[data-renderer=ready]') && document.querySelectorAll('.report-globe-label').length > 15");
    await browser.wait("document.querySelector('.hero-title')?.dataset.introState === 'complete'");
    await browser.evaluate("document.querySelector('.report-globe').scrollIntoView({block:'center',behavior:'instant'})");
    await browser.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
    await browser.wait("document.querySelector('.report-globe-label[tabindex=\"0\"]')");
    const sample = await browser.evaluate(`(${observeLabels})()`);
    assert.ok(sample.visibleLabels > 0 && sample.visibleLabels <= 4);
    assert.ok(sample.styleWrites > 0, "Automatic rotation must update the positions");
    assert.ok(sample.focusOrderMatches, "Only visible labels can be reached by keyboard");
    results.push({ width, ...sample });
  } finally {
    await browser.close();
  }
}

console.log(JSON.stringify(results, null, 2));
for (const result of results) {
  assert.equal(result.redundantFocusWrites, 0, `Focus order was rewritten without a change at ${result.width}px`);
}
