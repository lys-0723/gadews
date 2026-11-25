import assert from "node:assert/strict";
import test from "node:test";
import type { AssessmentResult } from "./warning-assessment";
import { presentationForAssessment } from "./assessment-presentation";

function result(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    schemaVersion: "1.0", diseaseId: "wsd", dataMode: "manual", assessedAt: "2026-10-30T08:00:00Z", inputSnapshot: {},
    status: "partial", model: { id: "wsd", version: "1", state: "prototype", source: ["source"], warnings: [] },
    quality: { state: "partial", observedFields: ["ph"], expectedFields: ["ph", "pcr"], issues: [] },
    knownScore: 315, maxScore: 500, score: null, riskIndex: null, level: null, minimumAttention: "none",
    drivers: [], actions: [], unsupportedRules: [], prediction: { state: "not_configured", probability: null, horizonHours: null }, ...overrides,
  };
}
test("partial urgent evidence stays red while the absent complete grade and original score remain unchanged", () => {
  const input = result({ minimumAttention: "urgent" });
  const before = JSON.stringify(input);
  assert.deepEqual(presentationForAssessment(input), { tone: "urgent", kind: "attention", labelKey: "Urgent attention", detailKey: "Existing evidence requires urgent attention; assessment is incomplete." });
  assert.equal(JSON.stringify(input), before);
  assert.equal(input.level, null);
  assert.equal(input.knownScore, 315);
});
test("complete grades use their existing rank and do not require a configured prediction service", () => {
  for (const [rank, tone] of [[0, "low"], [1, "medium"], [2, "high"], [3, "urgent"]] as const) {
    const display = presentationForAssessment(result({ status: "complete", score: 30, riskIndex: 6, level: { id: "grade-" + rank, label: "Existing grade", rank } }));
    assert.equal(display.tone, tone); assert.equal(display.kind, "grade"); assert.equal(display.labelKey, "Existing grade");
  }
});
test("missing and partial none never turn green even if a stale legacy level is present", () => {
  for (const status of ["partial", "insufficient_data"] as const) {
    const display = presentationForAssessment(result({ status, minimumAttention: "none", level: { id: "low", label: "Low", rank: 0 } }));
    assert.equal(display.tone, "neutral"); assert.equal(display.kind, "unavailable");
  }
});
test("review and high attention have distinct tones and are not promoted to full grades", () => {
  assert.equal(presentationForAssessment(result({ minimumAttention: "review" })).tone, "medium");
  assert.equal(presentationForAssessment(result({ minimumAttention: "high" })).tone, "high");
  assert.equal(presentationForAssessment(result({ minimumAttention: "high" })).kind, "attention");
});
test("disabled, unconfigured and outdated states do not imply a current risk classification", () => {
  assert.equal(presentationForAssessment(result({ status: "draft_disabled", minimumAttention: "urgent" })).kind, "draft");
  assert.equal(presentationForAssessment(result({ status: "draft_disabled" })).tone, "neutral");
  assert.equal(presentationForAssessment(result({ status: "not_configured" })).tone, "neutral");
  assert.equal(presentationForAssessment(result({ minimumAttention: "urgent" }), true).kind, "outdated");
  assert.equal(presentationForAssessment(result({ minimumAttention: "urgent" }), true).tone, "neutral");
});
test("explicit draft preview can show simulated urgent attention while retaining draft qualification", () => {
  const display = presentationForAssessment(result({ diseaseId: "tilapia-streptococcosis", status: "draft_preview", dataMode: "draft-preview", minimumAttention: "urgent" }));
  assert.equal(display.tone, "urgent"); assert.equal(display.kind, "attention");
  assert.equal(display.detailKey, "Draft example attention; not a production assessment.");
});
