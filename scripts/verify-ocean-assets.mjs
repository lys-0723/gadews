import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { verifyLifeVisuals } from "./publish-life-visuals.mjs";

await verifyLifeVisuals();

const digest = value => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(await readFile("public/media/gadews/sources.json", "utf8"));
for (const item of manifest.items) {
  assert.ok(item.path.startsWith("/") && !item.path.includes(".."), "Local visual asset path");
  const bytes = await readFile(`public${item.path}`);
  assert.equal(bytes.length, item.bytes, `${item.path} size`);
  assert.equal(digest(bytes), item.sha256, `${item.path} identity`);
  assert.match(item.page, /^https:\/\//, "Source page retained");
  assert.match(item.license, /^https:\/\//, "License source retained");
}
const boundary = manifest.items.find(item => item.path === "/globe/countries.json");
const original = gunzipSync(await readFile("data/geography/natural-earth-110m-countries.geojson.gz"));
assert.equal(digest(original), boundary.sourceSha256, "Original Natural Earth identity");
const source = JSON.parse(original);
const projected = { type: "FeatureCollection", features: source.features.map(feature => ({ type: "Feature", properties: { name: feature.properties.ADMIN }, geometry: feature.geometry })) };
assert.equal(JSON.stringify(projected) + "\n", await readFile("public/globe/countries.json", "utf8"), "Geometry preserved exactly in lightweight projection");
assert.equal(projected.features.length, boundary.featureCount);
assert.ok(manifest.items.find(item => item.path.endsWith("ocean-life.mp4")).bytes <= 6 * 1024 * 1024, "Video budget");
assert.ok(manifest.items.filter(item => item.path.startsWith("/globe/")).reduce((sum, item) => sum + item.bytes, 0) < 3 * 1024 * 1024, "Geographic asset budget; compiled Three chunk is separately measured in browser");
console.log(`Verified ${manifest.items.length} visual assets, ${projected.features.length} unchanged country geometries and media budgets.`);
