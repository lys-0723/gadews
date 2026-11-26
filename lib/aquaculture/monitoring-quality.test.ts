import assert from "node:assert/strict";
import test from "node:test";
import { buildMonitoringSnapshot } from "./monitoring-quality";
import { parseMonitoringSnapshot, type MonitoringFeed } from "./monitoring-types";

const feed: MonitoringFeed = { id: "synthetic", label: "Synthetic pond", siteId: "site-a", pondId: "pond-a", maxAgeHours: 2, unitVerificationRef: "Synthetic verification" };
const now = new Date("2026-10-29T10:00:00Z");
const record = { observedAt: "2026-10-29T09:00:00Z", ingestedAt: "2026-10-29T09:01:00Z", waterTemperatureC: 0, dissolvedOxygenMgL: 0, ph: 0, qualityFlags: [] };
const get = (changes: Record<string, unknown> = {}, selectedFeed = feed) => buildMonitoringSnapshot(selectedFeed, { ...record, ...changes }, now);

test("quality preserves zero and exact engineering endpoints as usable", () => {
  for (const values of [{ waterTemperatureC: -5, dissolvedOxygenMgL: 0, ph: 0 }, { waterTemperatureC: 50, dissolvedOxygenMgL: 30, ph: 14 }, {}]) {
    const parsed = parseMonitoringSnapshot(get(values));
    assert.equal(parsed.observation?.metrics.waterTemperatureC.state, "usable");
    assert.equal(parsed.observation?.metrics.dissolvedOxygenMgL.state, "usable");
    assert.equal(parsed.observation?.metrics.ph.state, "usable");
  }
});

test("a missing or invalid single metric does not block independent metrics", () => {
  for (const value of [null, undefined, "", Number.NaN, Number.POSITIVE_INFINITY, "12", -6, 51]) {
    const snapshot = get({ waterTemperatureC: value });
    const metrics = snapshot.observation!.metrics;
    assert.equal(metrics.waterTemperatureC.state, value === null || value === undefined ? "missing" : "invalid");
    assert.equal(metrics.ph.state, "usable");
    assert.equal(metrics.dissolvedOxygenMgL.state, "usable");
    if (typeof value !== "number" || !Number.isFinite(value)) assert.equal(metrics.waterTemperatureC.value, null);
  }
});

test("known quality flags affect only their metric and contradictions are rejected", () => {
  const local = get({ ph: null, qualityFlags: ["missing_ph"] }).observation!.metrics;
  assert.equal(local.ph.state, "missing");
  assert.equal(local.waterTemperatureC.state, "usable");
  assert.equal(get({ qualityFlags: ["missing_ph"] }).observation!.metrics.ph.state, "invalid");
  assert.ok(get({ qualityFlags: ["missing_ph"] }).observation!.metrics.ph.issues.includes("contradictory_quality_flag"));
  assert.equal(get({ qualityFlags: ["ph_out_of_range"] }).observation!.metrics.ph.state, "invalid");
  assert.equal(get({ ph: 15, qualityFlags: [] }).observation!.metrics.ph.state, "invalid");
  assert.equal(get({ waterTemperatureC: null, qualityFlags: [] }).observation!.metrics.ph.state, "usable");
});

test("absent or unknown quality flags conservatively block all without revealing the flag", () => {
  for (const qualityFlags of [undefined, null, "private", ["PRIVATE_UPSTREAM_FLAG"], [7]]) {
    const snapshot = get({ qualityFlags });
    assert.deepEqual(Object.values(snapshot.observation!.metrics).map((metric) => metric.state), ["quality_unknown", "quality_unknown", "quality_unknown"]);
    assert.ok(!JSON.stringify(snapshot).includes("PRIVATE"));
  }
});

test("unit verification is explicit and unverified finite values remain display-only", () => {
  const snapshot = get({}, { ...feed, unitVerificationRef: null });
  assert.equal(snapshot.observation?.metrics.waterTemperatureC.value, 0);
  assert.equal(snapshot.observation?.metrics.ph.state, "unit_unverified");
  assert.ok(snapshot.observation?.metrics.ph.issues.includes("unit_unverified"));
});

test("freshness includes the endpoint and excludes older observations", () => {
  assert.equal(get({ observedAt: "2026-10-29T08:00:00Z" }).observation?.metrics.ph.state, "usable");
  assert.equal(get({ observedAt: "2026-10-29T07:59:59.999Z" }).observation?.metrics.ph.state, "stale");
});

test("invalid original timestamps remain null, never synthesized from the fetch clock", () => {
  for (const observedAt of [null, undefined, "2026-02-30T09:00:00Z", "2026-10-29T09:00:00", "private-time"]) {
    const snapshot = get({ observedAt });
    assert.equal(snapshot.observation?.observedAt, null);
    assert.equal(snapshot.observation?.reference, "monitoring:synthetic:invalid-time");
    assert.ok(Object.values(snapshot.observation!.metrics).every((metric) => metric.state !== "usable" && metric.issues.includes("invalid_time")));
    parseMonitoringSnapshot(snapshot);
  }
  const noIngestion = get({ ingestedAt: "bad" });
  assert.equal(noIngestion.observation?.ingestedAt, null);
  assert.equal(noIngestion.observation?.metrics.ph.state, "invalid");
});

test("future or reversed timestamps block every metric while missing stays missing", () => {
  for (const changes of [{ observedAt: "2026-10-29T10:01:00Z", ingestedAt: "2026-10-29T10:02:00Z" }, { ingestedAt: "2026-10-29T10:01:00Z" }, { ingestedAt: "2026-10-29T08:00:00Z" }]) {
    const snapshot = get({ ...changes, ph: null, qualityFlags: ["missing_ph"] });
    assert.equal(snapshot.observation?.metrics.waterTemperatureC.state, "invalid");
    assert.equal(snapshot.observation?.metrics.ph.state, "missing");
    assert.ok(snapshot.observation?.metrics.ph.issues.some((issue) => issue === "future_time" || issue === "reversed_time"));
  }
  assert.throws(() => buildMonitoringSnapshot(feed, record, new Date(Number.NaN)), /Invalid monitoring clock/);
});
