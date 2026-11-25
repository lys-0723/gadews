import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import type { WsdAssessmentContext, WsdWarningInput } from "./wsd-warning-model";
import { applyMonitoringToWsd, clearWsdMonitoringField, clearWsdMonitoringIdentity, type WsdMonitoringProvenance } from "./wsd-monitoring";
import { assessWsd, type WsdWarningModelConfig } from "./wsd-warning-model";
import { serializeAssessmentReport } from "./assessment-report";

const now = new Date("2026-10-29T12:00:00Z");
function snapshot(id = "synthetic-a"): MonitoringSnapshot {
  return { schemaVersion: "1.0", feed: { id, label: `Synthetic ${id}`, siteId: "site-a", pondId: "pond-a", maxAgeHours: 2, unitVerificationRef: "Synthetic unit verification" }, fetchedAt: now.toISOString(), observation: { observedAt: "2026-10-29T11:00:00Z", ingestedAt: "2026-10-29T11:01:00Z", reference: `monitoring:${id}:2026-10-29T11:00:00Z`, metrics: { waterTemperatureC: { value: 28, unit: "°C", state: "usable", issues: [] }, dissolvedOxygenMgL: { value: 5, unit: "mg/L", state: "usable", issues: [] }, ph: { value: 8, unit: "pH", state: "usable", issues: [] } } } };
}
const scope: WsdWarningInput = { regionOrSite: " site-a ", farmOrPondId: "pond-a" };
const provenance = (context: WsdAssessmentContext) => context.inputProvenance?.monitoring as WsdMonitoringProvenance;

test("manual matching pond applies only blank usable WSD fields and stores pond metadata", () => {
  const result = applyMonitoringToWsd(scope, { dataMode: "manual" }, snapshot(), now);
  assert.equal(result.input.waterTemperatureC, 28); assert.equal(result.input.ph, 8);
  assert.deepEqual(result.appliedFields, ["waterTemperatureC", "ph"]);
  assert.equal(result.input.dissolvedOxygenMgL, undefined);
  assert.deepEqual(result.context.observations?.ph, { observedAt: "2026-10-29T11:00:00Z", maxAgeHours: 2, scope: "pond" });
  assert.equal(provenance(result.context).ph?.appliedAt, "2026-10-29T12:00:00.000Z");
});

test("filled zero and legacy pH alias are never overwritten", () => {
  const result = applyMonitoringToWsd({ ...scope, waterTemperatureC: 0, pH: 0 }, {}, snapshot(), now);
  assert.deepEqual(result.appliedFields, []); assert.equal(result.input.waterTemperatureC, 0); assert.equal(result.input.pH, 0); assert.equal(result.input.ph, undefined);
});

test("application rejects examples and mismatched or missing user identity without filling identity", () => {
  for (const [input, context] of [[scope, { dataMode: "example" }], [{ ...scope, regionOrSite: "SITE-A" }, {}], [{ ...scope, farmOrPondId: "other" }, {}], [{}, {}]] as [WsdWarningInput, WsdAssessmentContext][]) {
    const result = applyMonitoringToWsd(input, context, snapshot(), now);
    assert.equal(result.input.waterTemperatureC, undefined); assert.deepEqual(result.appliedFields, []); assert.ok(result.reason);
    assert.deepEqual(result.input, input);
  }
});

test("application rechecks client time, unit verification, metric units and quality", () => {
  for (const invalid of ["stale", "future", "reversed", "invalid-time", "unit", "verification", "quality", "range", "clock"] as const) {
    const data = snapshot(); let clock = now;
    if (invalid === "stale") clock = new Date("2026-10-29T13:00:00.001Z");
    if (invalid === "future") clock = new Date("2026-10-29T10:59:59Z");
    if (invalid === "reversed") data.observation!.ingestedAt = "2026-10-29T10:00:00Z";
    if (invalid === "invalid-time") data.observation!.observedAt = null;
    if (invalid === "unit") data.observation!.metrics.waterTemperatureC.unit = "mg/L";
    if (invalid === "verification") data.feed.unitVerificationRef = null;
    if (invalid === "quality") data.observation!.metrics.waterTemperatureC.issues = ["unknown_quality_flag"];
    if (invalid === "range") data.observation!.metrics.waterTemperatureC.value = 51;
    if (invalid === "clock") clock = new Date(NaN);
    const result = applyMonitoringToWsd(scope, {}, data, clock);
    assert.equal(result.input.waterTemperatureC, undefined, invalid);
  }
  assert.equal(applyMonitoringToWsd(scope, {}, snapshot(), new Date("2026-10-29T13:00:00Z")).input.waterTemperatureC, 28);
});

test("temperature from A and pH from B retain independent immutable snapshots", () => {
  const a = snapshot("synthetic-a"); a.observation!.metrics.ph = { value: null, unit: "pH", state: "missing", issues: ["missing_value"] };
  const first = applyMonitoringToWsd(scope, { inputProvenance: { manualNote: { text: "keep" } } }, a, now);
  const b = snapshot("synthetic-b"); b.observation!.metrics.waterTemperatureC.state = "invalid";
  const second = applyMonitoringToWsd(first.input, first.context, b, now);
  assert.deepEqual(second.appliedFields, ["ph"]);
  assert.equal(provenance(second.context).waterTemperatureC?.snapshot.feed.id, "synthetic-a");
  assert.equal(provenance(second.context).ph?.snapshot.feed.id, "synthetic-b");
  a.feed.label = "mutated"; b.observation!.metrics.ph.value = 1; first.input.waterTemperatureC = 1;
  (first.context.inputProvenance!.manualNote as { text: string }).text = "mutated";
  assert.equal(second.input.waterTemperatureC, 28); assert.equal(provenance(second.context).ph?.snapshot.observation?.metrics.ph.value, 8);
  assert.equal(provenance(second.context).waterTemperatureC?.snapshot.feed.label, "Synthetic synthetic-a");
  assert.deepEqual(second.context.inputProvenance?.manualNote, { text: "keep" });
});

test("manual edit removes only that field linkage and identity edit clears all imported values", () => {
  const applied = applyMonitoringToWsd({ ...scope, month: 10 }, {}, snapshot(), now);
  const edited = clearWsdMonitoringField(applied.input, applied.context, "ph");
  assert.equal(edited.input.ph, 8); assert.equal(edited.context.observations?.ph, undefined); assert.equal(provenance(edited.context).ph, undefined);
  assert.ok(provenance(edited.context).waterTemperatureC);
  edited.input.ph = 7.8;
  const changed = clearWsdMonitoringIdentity(edited.input, edited.context);
  assert.equal(changed.input.waterTemperatureC, undefined); assert.equal(changed.input.ph, 7.8); assert.equal(changed.input.month, 10);
  assert.equal(changed.context.inputProvenance?.monitoring, undefined); assert.equal(changed.context.observations?.waterTemperatureC, undefined);
  assert.equal(applied.input.waterTemperatureC, 28);
});

function demoSnapshot(): MonitoringSnapshot {
  const data = snapshot("demo-usable");
  data.feed.siteId = "demo-site";
  data.feed.pondId = "demo-pond";
  return data;
}
const demoScope = { regionOrSite: "demo-site", farmOrPondId: "demo-pond" };
const demoOrigin = { kind: "demo" as const, scenarioId: "demo-usable", generatedAt: now.toISOString() };

test("explicit demo evidence enters only the matching example session and exports its immutable origin", () => {
  const data = demoSnapshot();
  const origin = { ...demoOrigin };
  const context: WsdAssessmentContext = { dataMode: "example", now, inputProvenance: { demoSession: { ...origin } } };
  const applied = applyMonitoringToWsd(demoScope, context, data, now, origin);
  assert.deepEqual(applied.appliedFields, ["waterTemperatureC", "ph"]);
  assert.equal(applied.context.dataMode, "example");
  assert.deepEqual(provenance(applied.context).ph?.origin, demoOrigin);
  const config = JSON.parse(readFileSync("public/data/models/wsd-warning-model.json", "utf8")) as WsdWarningModelConfig;
  const assessed = assessWsd(applied.input, config, applied.context);
  const report = JSON.parse(serializeAssessmentReport(assessed, false));
  assert.equal(report.result.dataMode, "example");
  assert.equal(report.result.inputSnapshot.waterTemperatureC, 28);
  assert.deepEqual(report.result.contextSnapshot.inputProvenance.monitoring.ph.origin, demoOrigin);
  assert.equal(report.result.prediction.probability, null);
  assert.equal(report.result.score, null);
  data.feed.label = "changed"; origin.scenarioId = "demo-stale";
  applied.input.ph = 1;
  assert.deepEqual(provenance(applied.context).ph?.origin, demoOrigin);
  assert.equal(report.result.contextSnapshot.inputProvenance.monitoring.ph.snapshot.feed.label, "Synthetic demo-usable");
  assert.equal(report.result.contextSnapshot.inputProvenance.monitoring.ph.origin.scenarioId, "demo-usable");
  assert.equal(assessed.inputSnapshot.ph, 8);
});

test("demo origin cannot cross into manual or bypass controlled scenario and generation identity", () => {
  const cases = [
    { context: { dataMode: "manual" as const }, origin: demoOrigin },
    { context: {}, origin: demoOrigin },
    { context: { dataMode: "example" as const }, origin: { ...demoOrigin, scenarioId: "demo-stale" } },
    { context: { dataMode: "example" as const }, origin: { ...demoOrigin, generatedAt: "2026-10-29T11:59:59Z" } },
    { context: { dataMode: "example" as const }, origin: { kind: "published" as const } },
  ];
  for (const { context, origin } of cases) {
    const result = applyMonitoringToWsd(demoScope, context, demoSnapshot(), now, origin);
    assert.deepEqual(result.appliedFields, []);
    assert.deepEqual(result.input, demoScope);
    assert.ok(result.reason);
  }
  const uncontrolled = demoSnapshot(); uncontrolled.feed.id = "demo-invented";
  assert.deepEqual(applyMonitoringToWsd(demoScope, { dataMode: "example" }, uncontrolled, now, { ...demoOrigin, scenarioId: "demo-invented" }).appliedFields, []);
});

test("demo keeps the same identity blank-field freshness and verification restrictions", () => {
  const wrongScope = applyMonitoringToWsd({ ...demoScope, farmOrPondId: "other" }, { dataMode: "example" }, demoSnapshot(), now, demoOrigin);
  assert.deepEqual(wrongScope.appliedFields, []);
  const filled = applyMonitoringToWsd({ ...demoScope, waterTemperatureC: 0, pH: 0 }, { dataMode: "example" }, demoSnapshot(), now, demoOrigin);
  assert.deepEqual(filled.appliedFields, []);
  assert.equal(filled.input.waterTemperatureC, 0);
  assert.deepEqual(applyMonitoringToWsd(demoScope, { dataMode: "example" }, demoSnapshot(), new Date("2026-10-29T13:00:00.001Z"), demoOrigin).appliedFields, []);
  const unverified = demoSnapshot(); unverified.feed.unitVerificationRef = null;
  for (const metric of Object.values(unverified.observation!.metrics)) { metric.state = "unit_unverified"; metric.issues = ["unit_unverified"]; }
  assert.deepEqual(applyMonitoringToWsd(demoScope, { dataMode: "example" }, unverified, now, demoOrigin).appliedFields, []);
});

test("editing demo evidence clears field links while keeping example and draft scenario provenance", () => {
  const applied = applyMonitoringToWsd(demoScope, { dataMode: "example", inputProvenance: { demoSession: { ...demoOrigin } } }, demoSnapshot(), now, demoOrigin);
  const edited = clearWsdMonitoringField(applied.input, applied.context, "ph");
  assert.equal(provenance(edited.context).ph, undefined);
  assert.deepEqual(provenance(edited.context).waterTemperatureC?.origin, demoOrigin);
  const changed = clearWsdMonitoringIdentity(edited.input, edited.context);
  assert.equal(changed.context.dataMode, "example");
  assert.deepEqual(changed.context.inputProvenance?.demoSession, demoOrigin);
  assert.equal(changed.context.inputProvenance?.monitoring, undefined);
});
