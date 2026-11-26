import assert from "node:assert/strict";
import test from "node:test";
import snapshot from "@/public/data/environment/snapshot.json";
import { schema, timeIndex, utcMillis, overdue, sitesFor } from "./snapshot";

test("bundled API snapshot has a unique entry per source, aligned units and time axes", () => {
  const data = schema.parse(snapshot);
  for (const feed of data.feeds)
    for (const series of feed.series) {
      assert.ok(sitesFor(feed.id).includes(series.site));
      assert.ok(series.fields.every((f) => f.values.length === series.times.length && f.unit));
    }
  assert.ok(!schema.safeParse({ ...data, feeds: data.feeds.slice(1) }).success);
});
test("selects UTC evidence time, including legitimate zero and a future first step", () => {
  const times = ["2026-11-26T00:00", "2026-11-26T01:00", "2026-11-26T02:00"];
  assert.equal(utcMillis(times[1]), Date.UTC(2026, 10, 26, 1));
  assert.equal(timeIndex(times, Date.UTC(2026, 10, 26, 1, 30)), 1);
  assert.equal(timeIndex(times, 0), 0);
});
test("satellite gaps, interpolated products and stale snapshots remain separate", () => {
  const s = schema.parse(snapshot);
  const l3 = s.feeds.find((f) => f.id === "chl-l3")!,
    l4 = s.feeds.find((f) => f.id === "chl-l4")!;
  assert.notEqual(l3.raster?.layer, l4.raster?.layer);
  assert.equal(overdue({ ...l3, state: "retained" }, Date.now()), true);
  assert.equal(overdue(l4, utcMillis(l4.checkedAt) + 15 * 86400000), true);
  assert.equal(sitesFor("chl-l3").includes("mekong"), false);
});

import { featureUrl, pixelQuery } from "./pixel";
test("global WMTS queries pin the published version, time, depth and EPSG:3857 pixel", () => {
  const url = new URL(
    featureUrl(20.5, 111.5, {
      layer: "product/dataset/o2",
      style: "cmap:test",
      time: "2026-11-26T00:00:00Z",
      elevation: "-0.49",
    }),
  );
  assert.equal(url.host, "wmts.marine.copernicus.eu");
  assert.deepEqual(
    ["TILEROW", "TILECOL", "I", "J"].map((k) => url.searchParams.get(k)),
    ["56", "103", "164", "140"],
  );
  assert.equal(url.searchParams.get("elevation"), "-0.49");
  assert.equal(url.searchParams.get("time"), "2026-11-26T00:00:00Z");
  assert.equal(pixelQuery.safeParse({ lat: 90, lon: 0, time: "2026-11-26", layer: "ph" }).success, false);
});
