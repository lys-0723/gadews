import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessWsd, type WsdWarningModelConfig } from "./wsd-warning-model";
import { assessTilapia, createTilapiaDraftExamplePacket } from "./tilapia-assessment";
import type { KnowledgeResource } from "./tilapia-types";

const wsdConfig = JSON.parse(readFileSync("public/data/models/wsd-warning-model.json", "utf8")) as WsdWarningModelConfig;
const knowledge = JSON.parse(readFileSync("public/data/knowledge/tilapia-streptococcosis.json", "utf8")) as KnowledgeResource;
async function serializer() {
  const api = await import("./assessment-report").catch((error: Error) => assert.fail(`Report serializer is unavailable: ${error.message}`));
  assert.equal(typeof api.serializeAssessmentReport, "function");
  return api.serializeAssessmentReport;
}

test("local report rejects empty and outdated assessment snapshots", async () => {
  const serialize = await serializer();
  assert.throws(() => serialize(null, false), /no assessment|no result/i);
  assert.throws(() => serialize(null, true), /no assessment|no result/i);
  const result = assessWsd({ ph: 8 }, wsdConfig);
  assert.throws(() => serialize(result, true), /outdated|evaluate again/i);
});

test("local report contains the complete current WSD result and does not accept input overrides", async () => {
  const serialize = await serializer();
  const result = assessWsd({ ph: 8.5 }, wsdConfig, {
    now: "2026-10-28T12:00:00Z", dataMode: "example",
    observations: { ph: { observedAt: "2026-10-28T11:00:00Z", maxAgeHours: 24, scope: "pond" } },
  });
  const report = JSON.parse(serialize(result, false));
  assert.equal(report.reportType, "gadews-assessment");
  assert.equal(report.schemaVersion, "1.0");
  assert.equal(report.result.diseaseId, "wsd");
  assert.equal(report.result.dataMode, "example");
  assert.equal(report.result.contextSnapshot.now, "2026-10-28T12:00:00.000Z");
  assert.equal(report.result.inputSnapshot.ph, 8.5);
  assert.deepEqual(report.result.ruleEvaluations, result.ruleEvaluations);
  assert.ok(report.result.quality.issues.some((issue: { code: string }) => issue.code === "rule_conflict"));
  assert.deepEqual(report.result, JSON.parse(JSON.stringify(result)));
  const runtime = serialize as (...args: unknown[]) => string;
  assert.equal(JSON.parse(runtime(result, false, { dataMode: "manual", inputSnapshot: { ph: 7 } })).result.dataMode, "example");
});

test("report encodes every nonfinite value distinctly without changing null or original snapshots", async () => {
  const serialize = await serializer();
  const result = assessWsd({ waterTemperatureC: NaN, ph: Infinity, ctValue: -Infinity }, wsdConfig, {
    inputProvenance: { raw: { number: "not-a-number", empty: null }, nested: [NaN, Infinity, -Infinity, 0, null] },
  });
  const report = JSON.parse(serialize(result, false));
  assert.deepEqual(report.result.inputSnapshot, { waterTemperatureC: { $number: "NaN" }, ph: { $number: "Infinity" }, ctValue: { $number: "-Infinity" } });
  assert.deepEqual(report.result.contextSnapshot.inputProvenance.nested, [{ $number: "NaN" }, { $number: "Infinity" }, { $number: "-Infinity" }, 0, null]);
  assert.deepEqual(report.result.contextSnapshot.inputProvenance.raw, { number: "not-a-number", empty: null });
  assert.equal(report.result.score, null);
  assert.ok(Number.isNaN(result.inputSnapshot.waterTemperatureC));
  assert.equal(result.inputSnapshot.ph, Infinity);
});

test("draft report retains all 22 traces, independent events, fixture provenance and prediction boundary", async () => {
  const serialize = await serializer();
  const packet = createTilapiaDraftExamplePacket();
  const result = assessTilapia(packet.input, knowledge, packet.context);
  const report = JSON.parse(serialize(result, false));
  assert.equal(report.result.ruleTraces.length, 22);
  assert.deepEqual(report.result.ruleTraces, result.ruleTraces);
  assert.deepEqual(report.result.events, result.events);
  assert.equal(report.result.events.some((event: { type: string }) => event.type === "confirmed_event"), true);
  assert.equal(report.result.contextSnapshot.draftPreview.label, "Draft simulation");
  assert.equal(report.result.contextSnapshot.professionalRecords[0].origin, "fixture");
  assert.equal(report.result.dataMode, "draft-preview");
  assert.equal(report.result.model.state, "draft_disabled");
  assert.deepEqual(report.result.prediction, { state: "not_configured", probability: null, horizonHours: null });
  assert.deepEqual(report.result, JSON.parse(JSON.stringify(result)));
});
