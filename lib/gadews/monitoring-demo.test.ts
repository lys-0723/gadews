import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseMonitoringFeeds, parseMonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import { createDemoMonitoringSource } from "./monitoring-demo";
import { applyMonitoringToWsd } from "./wsd-monitoring";
import { assessWsd, type WsdWarningModelConfig } from "./wsd-warning-model";
import { serializeAssessmentReport } from "./assessment-report";

const clock = new Date("2026-10-29T12:00:00Z");
const ids = ["demo-usable", "demo-partial", "demo-stale", "demo-unverified"];

test("demo uses four fixed fictional feeds and generates only on explicit reads without HTTP", async () => {
  let ticks = 0; let fetches = 0; const original = globalThis.fetch;
  globalThis.fetch = async () => { fetches += 1; throw new Error("Demo must stay offline"); };
  try {
    const source = createDemoMonitoringSource({ now: () => { ticks += 1; return clock; } });
    assert.equal(source.kind, "demo");
    assert.equal(ticks, 0);
    const feeds = await source.listFeeds();
    assert.equal(ticks, 0);
    assert.deepEqual(feeds.map((feed) => feed.id), ids);
    assert.deepEqual(parseMonitoringFeeds({ schemaVersion: "1.0", feeds }).map((feed) => feed.id), ids);
    for (const feed of feeds) { assert.equal(feed.siteId, "demo-site"); assert.equal(feed.pondId, "demo-pond"); assert.match(feed.label, /demo|synthetic/i); }
    for (const id of ids) assert.equal(parseMonitoringSnapshot(await source.readLatest(id)).feed.id, id);
    assert.equal(ticks, 4);
    assert.equal(fetches, 0);
  } finally { globalThis.fetch = original; }
});

test("usable demo preserves metric values, units and explicit synthetic time offsets", async () => {
  const snapshot = await createDemoMonitoringSource({ now: () => clock }).readLatest("demo-usable");
  assert.equal(snapshot.fetchedAt, "2026-10-29T12:00:00.000Z");
  assert.equal(snapshot.observation?.observedAt, "2026-10-29T11:50:00.000Z");
  assert.equal(snapshot.observation?.ingestedAt, "2026-10-29T11:51:00.000Z");
  assert.equal(snapshot.feed.unitVerificationRef, "Demo fixture only");
  assert.deepEqual(snapshot.observation?.metrics, {
    waterTemperatureC: { value: 29, unit: "°C", state: "usable", issues: [] },
    dissolvedOxygenMgL: { value: 5.2, unit: "mg/L", state: "usable", issues: [] },
    ph: { value: 8.2, unit: "pH", state: "usable", issues: [] },
  });
});

test("partial demo keeps only temperature usable and missing flags remain independent", async () => {
  const snapshot = await createDemoMonitoringSource({ now: () => clock }).readLatest("demo-partial");
  assert.deepEqual(snapshot.observation?.metrics.waterTemperatureC, { value: 29, unit: "°C", state: "usable", issues: [] });
  for (const key of ["dissolvedOxygenMgL", "ph"] as const) {
    assert.equal(snapshot.observation?.metrics[key].value, null);
    assert.equal(snapshot.observation?.metrics[key].state, "missing");
    assert.deepEqual(snapshot.observation?.metrics[key].issues, ["missing_value"]);
  }
  const result = applyMonitoringToWsd({ regionOrSite: "demo-site", farmOrPondId: "demo-pond" }, { dataMode: "example" }, snapshot, clock, { kind: "demo", scenarioId: snapshot.feed.id, generatedAt: snapshot.fetchedAt });
  assert.deepEqual(result.appliedFields, ["waterTemperatureC"]);
  assert.equal(result.input.ph, undefined);
});

test("stale and unit-unverified cases keep readable values but cannot enter WSD", async () => {
  const source = createDemoMonitoringSource({ now: () => clock });
  for (const [id, state, issue] of [["demo-stale", "stale", "stale"], ["demo-unverified", "unit_unverified", "unit_unverified"]]) {
    const snapshot = await source.readLatest(id);
    assert.equal(snapshot.observation?.metrics.waterTemperatureC.value, 29);
    for (const metric of Object.values(snapshot.observation!.metrics)) { assert.equal(metric.state, state); assert.deepEqual(metric.issues, [issue]); }
    if (id === "demo-stale") {
      assert.equal(snapshot.feed.maxAgeHours, 1);
      assert.equal(snapshot.observation?.observedAt, "2026-10-29T09:00:00.000Z");
    } else assert.equal(snapshot.feed.unitVerificationRef, null);
    const result = applyMonitoringToWsd({ regionOrSite: "demo-site", farmOrPondId: "demo-pond" }, { dataMode: "example" }, snapshot, clock, { kind: "demo", scenarioId: id, generatedAt: snapshot.fetchedAt });
    assert.deepEqual(result.appliedFields, []);
    assert.ok(result.reason);
    assert.equal(result.context.dataMode, "example");
  }
});

test("refresh produces independent fresh snapshots and cannot mutate previous adopted evidence", async () => {
  let now = clock;
  const source = createDemoMonitoringSource({ now: () => now });
  const first = await source.readLatest("demo-usable");
  const adopted = applyMonitoringToWsd({ regionOrSite: "demo-site", farmOrPondId: "demo-pond" }, { dataMode: "example" }, first, clock, { kind: "demo", scenarioId: first.feed.id, generatedAt: first.fetchedAt });
  now = new Date("2026-10-29T12:30:00Z");
  const next = await source.readLatest("demo-usable"); next.feed.label = "changed"; next.observation!.metrics.ph.value = 1;
  const feeds = await source.listFeeds(); feeds[0].maxAgeHours = 100;
  assert.equal((await source.listFeeds())[0].maxAgeHours, 1);
  assert.equal(first.observation?.observedAt, "2026-10-29T11:50:00.000Z");
  assert.equal((await source.readLatest("demo-usable")).observation?.observedAt, "2026-10-29T12:20:00.000Z");
  assert.equal(adopted.context.inputProvenance?.monitoring && JSON.stringify(adopted.context.inputProvenance.monitoring).includes("11:50:00.000Z"), true);
  assert.equal(first.observation?.metrics.ph.value, 8.2);
});

test("generated demo goes through the actual WSD engine and report without claiming a complete probability", async () => {
  const snapshot = await createDemoMonitoringSource({ now: () => clock }).readLatest("demo-usable");
  const origin = { kind: "demo" as const, scenarioId: "demo-usable", generatedAt: snapshot.fetchedAt };
  const applied = applyMonitoringToWsd({ regionOrSite: "demo-site", farmOrPondId: "demo-pond" }, { dataMode: "example", now: clock, inputProvenance: { demoSession: { ...origin } } }, snapshot, clock, origin);
  const config = JSON.parse(readFileSync("public/data/models/wsd-warning-model.json", "utf8")) as WsdWarningModelConfig;
  const result = assessWsd(applied.input, config, applied.context);
  snapshot.observation!.metrics.ph.value = 1;
  const report = JSON.parse(serializeAssessmentReport(result, false));
  assert.equal(report.result.dataMode, "example");
  assert.equal(report.result.inputSnapshot.waterTemperatureC, 29);
  assert.equal(report.result.inputSnapshot.ph, 8.2);
  assert.deepEqual(report.result.contextSnapshot.inputProvenance.monitoring.ph.origin, origin);
  assert.equal(report.result.contextSnapshot.inputProvenance.monitoring.ph.snapshot.observation.metrics.ph.value, 8.2);
  assert.equal(report.result.contextSnapshot.inputProvenance.monitoring.ph.appliedAt, "2026-10-29T12:00:00.000Z");
  assert.equal(report.result.score, null);
  assert.equal(report.result.prediction.probability, null);
});

test("demo rejects unknown IDs and invalid clocks without clock calls during catalog reads", async () => {
  let ticks = 0;
  const source = createDemoMonitoringSource({ now: () => { ticks += 1; return new Date(NaN); } });
  await source.listFeeds();
  await assert.rejects(source.readLatest("unknown"), /unknown.*scenario/i);
  assert.equal(ticks, 0);
  await assert.rejects(source.readLatest("demo-usable"), /invalid.*clock/i);
  assert.equal(ticks, 1);
  await assert.rejects(createDemoMonitoringSource({ now: () => { throw new Error("clock failed"); } }).readLatest("demo-usable"), /clock/i);
});

test("demo honors cancellation before catalog or snapshot work and while the injected clock runs", async () => {
  let ticks = 0; const source = createDemoMonitoringSource({ now: () => { ticks += 1; return clock; } });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(source.listFeeds(controller.signal), { name: "AbortError" });
  await assert.rejects(source.readLatest("demo-usable", controller.signal), { name: "AbortError" });
  assert.equal(ticks, 0);
  const during = new AbortController();
  const cancelling = createDemoMonitoringSource({ now: () => { during.abort(); return clock; } });
  await assert.rejects(cancelling.readLatest("demo-usable", during.signal), { name: "AbortError" });
});
