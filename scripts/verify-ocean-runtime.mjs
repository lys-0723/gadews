import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.OCEAN_PREVIEW_BASE ?? "http://127.0.0.1:3219";
const output = resolve(process.env.OCEAN_RUNTIME_OUTPUT ?? "/tmp/gadews-c09-runtime");
await mkdir(output, { recursive: true });
const browser = await openBrowser();
const tileResponses = [];
browser.onEvent(event => { if (event.method === "Network.responseReceived" && event.params.response.url.includes(".tile.openstreetmap.org/")) tileResponses.push({ url: event.params.response.url, status: event.params.response.status }); });
try {
  await browser.call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.call("Page.navigate", { url: `${base}/` });
  await browser.wait("document.querySelector('.report-globe')?.dataset.renderer==='ready'");
  const resources = await browser.evaluate("performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize,type:e.initiatorType}))");
  const texture = resources.filter(item => item.path === "/globe/earth-blue-marble.png");
  const video = resources.filter(item => item.path.endsWith(".mp4"));
  const allJSAndGeographyEncoded = resources.filter(item => item.path.endsWith(".js") || item.path.startsWith("/globe/")).reduce((sum, item) => sum + item.encoded, 0);
  const result = { base, runtime: process.env.OCEAN_RUNTIME ?? "production", resources, textureRequests: texture.length, initialVideoRequests: video.length, allJSAndGeographyEncoded, osm: { checked: false, loadedTiles: 0, responses: tileResponses } };
  await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  assert.equal(texture.length, 1, "Successful globe must not download its texture again for a loading preview");
  assert.equal(video.length, 0, "Initial viewport must not preload the full video");
  assert.ok(allJSAndGeographyEncoded < 3 * 1024 * 1024, "Initial JS and geographic content must fit 3MiB; includes more than the globe chunk alone");
  if (process.env.OCEAN_CHECK_OSM === "1") {
    await browser.call("Network.setBlockedURLs", { urls: [] });
    await browser.call("Page.navigate", { url: `${base}/risk-map` });
    await browser.wait("document.querySelectorAll('.leaflet-tile-loaded').length>0");
    result.osm.checked = true;
    result.osm.loadedTiles = await browser.evaluate("document.querySelectorAll('.leaflet-tile-loaded').length");
    assert.ok(tileResponses.some(item => item.status === 200), "At least one genuine OSM tile must succeed");
  }
  await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ textureRequests: texture.length, initialVideoRequests: video.length, allJSAndGeographyEncoded, osm: result.osm }));
} finally { await browser.close(); }
