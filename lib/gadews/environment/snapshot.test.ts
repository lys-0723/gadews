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

import { featureUrl, nearbySourceCell, pixelQuery } from "./pixel";
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
    ["226", "414", "147", "51"],
  );
  assert.equal(url.searchParams.get("elevation"), "-0.49");
  assert.equal(url.searchParams.get("time"), "2026-11-26T00:00:00Z");
  assert.equal(pixelQuery.safeParse({ lat: 90, lon: 0, time: "2026-11-26", layer: "ph" }).success, false);
});

import { heatClass, heatColumn, heatRow } from "./heat-grid";

test("NOAA grid wraps longitude and keeps missing distinct from zero probability", () => {
  assert.equal(heatColumn(-1), 359);
  assert.equal(heatColumn(360), 0);
  assert.equal(heatRow(-90), 0);
  assert.equal(heatRow(90), 180);
  assert.equal(heatRow(20.5), 110);
  assert.equal(heatColumn(111.5), 111);
  assert.equal(heatClass(100), 3);
  assert.equal(heatClass(0), 0);
  const { feeds } = schema.parse(snapshot);
  const f = feeds.find(x => x.id === "heatwave")!;
  if (f.heatMaps) {
    const s = f.series[0];
    const i = heatRow(s.lat) * 360 + heatColumn(s.lon);
    for (const [lead, encoded] of f.heatMaps.entries()) {
      const value = s.fields[0].values[lead];
      const decoded = Buffer.from(encoded, "base64")[i];
      if (value === null) assert.equal(decoded, 255);
      else assert.ok(Math.abs(value - decoded) <= 0.51);
    }
  }
});

test("Copernicus rejects distant cells and handles neighbours across the dateline", () => {
  assert.equal(nearbySourceCell("chl-l4", 20.478, 111.543, 20.47917, 111.5625), true);
  assert.equal(nearbySourceCell("chl-l4", 20.478, 111.543, 15.35417, 111.52084), false);
  assert.equal(nearbySourceCell("salinity", 5, -179.99, 5, 180), true);
});

test("source links in legacy NOAA snapshots reproduce the displayed time and original subset", () => {
  for (const f of schema.parse(snapshot).feeds.filter(f => f.grid)) {
    const source = decodeURIComponent(new URL(f.series[0].source).search);
    assert.ok(source.includes(`[(${f.grid!.time})]`));
    assert.ok(!source.includes("(last)"));
    assert.equal(source.includes(":2:"), f.id === "viirs");
  }
});
