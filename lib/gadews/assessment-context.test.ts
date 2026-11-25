import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessWsd, type WsdAssessmentContext, type WsdWarningInput, type WsdWarningModelConfig } from "./wsd-warning-model";
import { assessTilapia, createTilapiaDraftExamplePacket } from "./tilapia-assessment";
import type { KnowledgeResource } from "./tilapia-types";

const wsdConfig = JSON.parse(readFileSync("public/data/models/wsd-warning-model.json", "utf8")) as WsdWarningModelConfig;
const knowledge = JSON.parse(readFileSync("public/data/knowledge/tilapia-streptococcosis.json", "utf8")) as KnowledgeResource;

test("WSD report retains stale alias metadata and effective example clock after caller mutation", () => {
  const observedAt = new Date("2026-10-26T12:00:00Z");
  const context: WsdAssessmentContext = {
    now: new Date("2026-10-28T12:00:00Z"), dataMode: "example",
    observations: { pcrQpcrResult_2: { observedAt, maxAgeHours: 24, scope: "environment" }, pathologyResult: { scope: "environment" } },
    inputProvenance: { formDraft: { value: "positive", history: ["original"] } },
  };
  const input: WsdWarningInput = { pcrQpcrResult_2: "positive", pathologyResult: "typical" };
  const result = assessWsd(input, wsdConfig, context);
  assert.ok(result.quality.issues.some((issue) => issue.field === "environmentalSampleResult" && issue.code === "stale"));
  assert.ok(result.quality.issues.some((issue) => issue.field === "pathologyResult" && issue.code === "scope_mismatch"));
  input.pcrQpcrResult_2 = "negative";
  observedAt.setUTCFullYear(2030);
  context.observations!.pcrQpcrResult_2.maxAgeHours = 1;
  (context.inputProvenance!.formDraft as { value: string; history: string[] }).history.push("changed");
  assert.equal(result.inputSnapshot.pcrQpcrResult_2, "positive");
  assert.equal(result.contextSnapshot?.now, "2026-10-28T12:00:00.000Z");
  assert.equal(result.contextSnapshot?.dataMode, "example");
  assert.deepEqual(result.contextSnapshot?.observations, {
    pcrQpcrResult_2: { observedAt: "2026-10-26T12:00:00.000Z", maxAgeHours: 24, scope: "environment" },
    pathologyResult: { scope: "environment" },
  });
  assert.deepEqual(result.contextSnapshot?.inputProvenance, { formDraft: { value: "positive", history: ["original"] } });
});

test("WSD default context records the actual assessment clock and manual mode", () => {
  const result = assessWsd({}, wsdConfig);
  assert.equal(result.contextSnapshot?.now, result.assessedAt);
  assert.equal(result.contextSnapshot?.dataMode, "manual");
  assert.equal(Number.isFinite(Date.parse(result.assessedAt)), true);
});

test("WSD nested input and context Dates normalize without hiding invalid Dates or nonfinite numbers", () => {
  const invalidDate = new Date(NaN);
  const nested = { when: new Date("2026-10-28T10:00:00Z"), invalidDate, values: [NaN, Infinity, -Infinity] };
  const input = { ph: NaN, note: nested } as unknown as WsdWarningInput;
  const result = assessWsd(input, wsdConfig, { now: invalidDate, inputProvenance: { nested } });
  assert.ok(result.quality.issues.some((issue) => issue.field === "assessedAt" && issue.code === "invalid"));
  nested.values[1] = 0;
  nested.when.setUTCFullYear(2030);
  const snapshot = result.inputSnapshot.note as typeof nested;
  assert.equal(snapshot.when, "2026-10-28T10:00:00.000Z");
  assert.deepEqual(snapshot.invalidDate, { $date: "Invalid Date" });
  assert.deepEqual(snapshot.values, [NaN, Infinity, -Infinity]);
  assert.deepEqual(result.contextSnapshot?.requestedNow, { $date: "Invalid Date" });
  assert.equal(result.contextSnapshot?.now, result.assessedAt);
  assert.ok(Number.isNaN(result.inputSnapshot.ph));
});

test("Tilapia report preserves preview parameters and professional fixture records independently", () => {
  const packet = createTilapiaDraftExamplePacket();
  packet.context.now = new Date("2026-10-28T12:00:00Z");
  packet.context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  packet.context.inputProvenance = { formDraft: { temperature: "invalid raw number" }, validationIssues: [{ field: "temperature", code: "invalid" }] };
  const result = assessTilapia(packet.input, knowledge, packet.context);
  packet.context.draftPreview!.highTemperature.thresholdC = 99;
  packet.context.professionalRecords![0].scope.batchId = "changed";
  packet.input.scope!.batchId = "changed";
  (packet.context.inputProvenance.formDraft as { temperature: string }).temperature = "30";
  assert.equal(result.contextSnapshot?.now, "2026-10-28T12:00:00.000Z");
  assert.equal(result.contextSnapshot?.dataMode, "draft-preview");
  assert.deepEqual(result.contextSnapshot?.draftPreview, { label: "Draft simulation", highTemperature: { thresholdC: 30, minimumDurationHours: 24 } });
  const records = result.contextSnapshot?.professionalRecords as { origin: string; scope: { batchId: string }; sourceRef: string }[];
  assert.equal(records[0].scope.batchId, "fixture-batch");
  assert.equal(records[0].origin, "fixture");
  assert.equal(records[0].sourceRef, "fixture-professional-record");
  assert.equal((result.inputSnapshot.scope as { batchId: string }).batchId, "fixture-batch");
  assert.deepEqual(result.contextSnapshot?.inputProvenance, { formDraft: { temperature: "invalid raw number" }, validationIssues: [{ field: "temperature", code: "invalid" }] });
  assert.equal(result.events.some((event) => event.type === "confirmed_event"), true);
});

test("Tilapia manual context normalizes invalid requested clock and nested Date provenance", () => {
  const packet = createTilapiaDraftExamplePacket();
  const result = assessTilapia(packet.input, knowledge, {
    now: new Date(NaN), inputProvenance: { dates: [new Date("2026-10-28T11:00:00Z"), new Date(NaN)] },
  });
  assert.equal(result.status, "draft_disabled");
  assert.equal(result.contextSnapshot?.dataMode, "manual");
  assert.equal(result.contextSnapshot?.now, result.assessedAt);
  assert.deepEqual(result.contextSnapshot?.requestedNow, { $date: "Invalid Date" });
  assert.deepEqual(result.contextSnapshot?.inputProvenance, { dates: ["2026-10-28T11:00:00.000Z", { $date: "Invalid Date" }] });
});
