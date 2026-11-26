import assert from "node:assert/strict";
import test from "node:test";
import { gridSummary, legendUrl, readScale, unitText } from "./ocean-legend";

const raster = {
  layer: "product/dataset/so", style: "cmap:haline", time: "2026-11-26T00:00:00Z", elevation: "-0.494",
};
const scale = {
  variableId: "so", units: "1e-3", cmapName: "haline", logScale: false, clamp: true,
  valueMin: 30, valueMax: 37, cmap: { colorMap: [[42, 24, 108], [253, 239, 154]] },
};

test("the provider legend follows the displayed version, time, depth and colour map", () => {
  const url = new URL(legendUrl(raster, "application/json"));
  for (const [key, expected] of Object.entries({
    time: raster.time, LAYER: raster.layer, STYLE: raster.style, elevation: raster.elevation,
    REQUEST: "GetLegend", FORMAT: "application/json",
  })) assert.equal(url.searchParams.get(key), expected);
  assert.equal(readScale({ continuous: scale }, raster).valueMin, 30);
  assert.equal(unitText(scale.units), "10⁻³");
  for (const change of [{valueMax: 30}, {variableId: "ph"}, {cmapName: "algae"}, {logScale: true, valueMin: 0}]) {
    assert.throws(() => readScale({ continuous: { ...scale, ...change } }, raster));
  }
});

test("reported subset extents include missing sample locations; numeric ranges preserve zero and all-missing states", () => {
  assert.deepEqual(gridSummary([[20,110,0], [21,112,5], [22,113,null]]), {
    count: 2, total: 3, min: 0, max: 5, south: 20, north: 22, west: 110, east: 113,
  });
  assert.equal(gridSummary([[20,110,null]])?.min, null);
  assert.equal(gridSummary([]), null);
});
