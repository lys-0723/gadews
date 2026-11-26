import assert from "node:assert/strict";
import test from "node:test";
import { localRange, sampleLocations, summarize } from "./map-range";
import type { Feed } from "./snapshot";

const dateline = { south: -3, north: 3, west: 177, span: 6 };
test("viewport sampling covers the antimeridian without hitting invalid longitudes", () => {
  const points = sampleLocations(dateline);
  assert.deepEqual(points.map(p => p.lon).slice(0,3), [178, -180, -178]);
  assert.deepEqual(points.map(p => p.lat), [-2,-2,-2,0,0,0,2,2,2]);
});
test("local viewport extrema exclude missing and offscreen values but include zero", () => {
  const feed: Feed = {id:"oisst", state:"ok", series:[], checkedAt:"2026-11-26",
    grid:{time:"2026-11-26",unit:"°C",points:[[0,179,0],[0,-179,3],[0,-178,null],[0,10,45]]}};
  assert.deepEqual(localRange(feed, dateline, 0), {min:0,max:3,unit:"°C",total:3,valid:2,failed:0});
  assert.deepEqual(summarize([null], "mg/m³", 2), {min:null,max:null,unit:"mg/m³",total:3,valid:0,failed:2});
});

test("tight viewports count visible footprints, not just centres; subsampled VIIRS gaps stay empty", () => {
  const feed: Feed = { id: "oisst", state: "ok", series: [], checkedAt: "2026-11-26",
    grid: { time: "2026-11-26", unit: "°C", points: [[20.125, 110.875, 26]] } };
  const box = { south: 20.20, north: 20.21, west: 110.94, span: 0.01 };
  assert.equal(localRange(feed, box, 0)?.min, 26);
  assert.equal(localRange({...feed, id: "viirs"}, box, 0)?.total, 0);
  const bytes = Buffer.alloc(181 * 360, 255);
  bytes[110 * 360 + 180] = 72;
  const heat: Feed = { ...feed, id: "heatwave", grid: undefined, heatMaps: [bytes.toString("base64")] };
  assert.equal(localRange(heat, {...box, west: -179.8}, 0)?.min, 72);
  assert.equal(localRange(heat, {...box, west: 179.8}, 0)?.max, 72);
  assert.deepEqual(sampleLocations({south: 86, north: 85, west: 0, span: 1}), []);
});
