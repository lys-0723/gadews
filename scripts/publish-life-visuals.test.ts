import assert from "node:assert/strict";
import test from "node:test";
import { encodeLifePointData } from "./publish-life-visuals.mjs";

test("publication has fixed little endian bytes and never adds or deforms photographic coordinates", () => {
  const fixture = { tilapia: { count: 1, stride: 5, points: [-1, 0.5, 0, 0.8, 1] }, shrimp: { count: 1, stride: 5, points: [1, -0.5, 0, 0.4, 0] } };
  const actual = encodeLifePointData(fixture);
  assert.deepEqual([...actual], [71, 76, 70, 49, 1, 0, 8, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 224, 0, 16, 0, 0, 204, 255, 0, 32, 0, 240, 0, 0, 102, 0]);
  assert.deepEqual(encodeLifePointData(fixture), actual);
  assert.throws(() => encodeLifePointData({ ...fixture, shrimp: { ...fixture.shrimp, count: 2 } }));
  assert.throws(() => encodeLifePointData({ ...fixture, tilapia: { ...fixture.tilapia, points: [NaN, 0.5, 0, 0.8, 1] } }));
});
