import assert from "node:assert/strict";
import test from "node:test";
import { getRegionalDemoSummary } from "./regional-monitoring-demo";

test("3 km and 5 km include points on the boundary, using unrounded distances", () => {
  const near = getRegionalDemoSummary("A", 3000);
  const wider = getRegionalDemoSummary("A", 5000);
  assert.deepEqual(near.records.map(record => record.id), ["A-01", "A-02", "A-03"]);
  assert.deepEqual(wider.records.map(record => record.id), ["A-01", "A-02", "A-03", "A-04", "A-05"]);
  assert.ok(Math.abs(near.records[2].distanceMeters - 3000) < 0.000001);
  assert.ok(wider.records[3].distanceMeters > 3000 && wider.records[3].distanceMeters < 3001);
  assert.ok(Math.abs(wider.records[4].distanceMeters - 5000) < 0.000001);
  assert.ok(!wider.records.some(record => record.id === "A-06"));
});

test("assumed same system, nearby other system and unverified system are counted separately", () => {
  const summary = getRegionalDemoSummary("A", 5000);
  const groupIds = (group: "same" | "other" | "unknown") =>
    summary.records.filter(record => record.group === group).map(record => record.id);
  assert.deepEqual(groupIds("same"), ["A-01", "A-04"]);
  assert.deepEqual(groupIds("other"), ["A-02", "A-05"]);
  assert.deepEqual(groupIds("unknown"), ["A-03"]);
  assert.deepEqual(summary.counts, { same: 2, other: 2, unknown: 1 });
  assert.deepEqual(getRegionalDemoSummary("A", 3000).counts, { same: 1, other: 1, unknown: 1 });
});

test("the second pilot is evaluated about its own centre and assumed water system", () => {
  const near = getRegionalDemoSummary("B", 3000);
  const wider = getRegionalDemoSummary("B", 5000);
  assert.equal(wider.site.id, "B");
  assert.equal(wider.site.waterSystem, "W2");
  assert.equal(wider.radiusMeters, 5000);
  assert.deepEqual(near.counts, { same: 1, other: 1, unknown: 1 });
  assert.deepEqual(wider.counts, { same: 2, other: 2, unknown: 2 });
  assert.deepEqual(wider.records.map(record => record.id), ["B-01", "B-02", "B-03", "B-04", "B-06", "B-05"]);
  assert.deepEqual(wider.records.filter(record => record.group === "same").map(record => record.waterSystem), ["W2", "W2"]);
});
