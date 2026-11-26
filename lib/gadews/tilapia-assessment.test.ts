import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  assessTilapia,
  createExampleTilapiaInput,
  createTilapiaDraftExamplePacket,
} from "./tilapia-assessment";
import type {
  KnowledgeResource, LabFinding, ProfessionalRecord, TilapiaAssessmentContext,
  TilapiaAssessmentInput, TilapiaObservation, TimeWindow,
} from "./tilapia-types";

// Independent, small engineering fixture. No workbook candidate is adopted here.
const supported = new Set([2, 3, 7, 8, 11, 12, 14, 15, 16, 18, 20, 21, 22]);
const knowledge: KnowledgeResource = {
  schemaVersion: "1.0", resourceId: "tilapia-fixture",
  source: { workbookName: "fixture.xlsx", sha256: "fixture", bytes: 0 },
  rules: Array.from({ length: 22 }, (_, i) => ({
    id: `TST-WARN-${String(i + 1).padStart(3, "0")}`, name: `Fixture ${i + 1}`,
    pathogenIds: i === 1 || i === 15 ? ["SAG"] : ["SAG", "SIN"],
    triggerIds: [], evidenceIds: [], sourceIds: ["fixture-source"], parameterIds: [],
    logic: "fixture only", executionSupport: supported.has(i + 1) ? "deterministic" : "unsupported",
    enablement: "draft_disabled", sourceRefs: [{ sheet: "09_预警规则表", row: i + 2 }],
  })),
  triggers: [], parameters: [], evidence: [], sources: [], validationCases: [], tables: [],
};
const scope = { siteId: "fixture-site", unitId: "fixture-unit", batchId: "fixture-batch" };
const window: TimeWindow = { startAt: "2026-10-27T12:00:00Z", endAt: "2026-10-28T12:00:00Z" };
const now = "2026-10-28T12:00:00Z";
const at = "2026-10-28T11:00:00Z";
function obs<T>(id: string, value: T): TilapiaObservation<T> {
  return { id, scope: { ...scope }, observedAt: at, receivedAt: at, quality: "valid", sourceRef: "fixture-record", value };
}
function input(): TilapiaAssessmentInput {
  return { scope: { ...scope }, assessmentWindow: { ...window }, targetPathogens: ["SAG", "SIN"], laboratory: [] };
}
function preview(): TilapiaAssessmentContext {
  return { now, dataMode: "draft-preview", draftPreview: { label: "Draft simulation" } };
}
function lab(id = "lab-sag", overrides: Partial<LabFinding> = {}): TilapiaObservation<LabFinding> {
  return obs(id, { sampleId: `sample-${id}`, pathogen: "SAG", matrix: "fish_tissue", assayId: "fixture-assay", result: "positive", controlsPassed: "yes", matrixValidated: "yes", ...overrides });
}
function clinical(signs: "yes" | "no" | "unknown" = "no") {
  return obs("clinical", { signsPresent: signs, persistentAbnormality: "yes" as const, respiratoryDistressObserved: "unknown" as const });
}
function review(id = "review"): ProfessionalRecord {
  return { id, origin: "fixture", scope: { ...scope }, window: { ...window }, receivedAt: at, reviewerRef: "fixture-reviewer", signedAt: at, sourceRef: "fixture-professional-record", version: "fixture-v1", finding: { kind: "clinical-review", respiratoryDistress: "yes", compatibleClinicalOrPathology: "yes", differentialReviewed: "yes" } };
}
function confirmed(id = "confirmed"): ProfessionalRecord {
  return { ...review(id), finding: { kind: "confirmed-event", pathogen: "SAG", laboratoryIds: ["lab-sag"], clinicalReviewIds: ["review"] } };
}
function withRecords(value: TilapiaAssessmentInput, records: ProfessionalRecord[]) {
  value.reviewRecordIds = records.map((record) => record.id);
  return { ...preview(), professionalRecords: records } as TilapiaAssessmentContext;
}
function trace(result: ReturnType<typeof assessTilapia>, id: number) {
  return result.ruleTraces.find((item) => item.ruleId === `TST-WARN-${String(id).padStart(3, "0")}`)!;
}
function temperature(value = 30, duration = 24) {
  const startAt = new Date(Date.parse(now) - duration * 3_600_000).toISOString();
  const record = obs("temperature-window", { window: { startAt, endAt: now }, minimumWaterTemperatureC: value, sampleCount: 25, coverage: "complete" as const, coverageRecordRef: "fixture-coverage" });
  record.observedAt = now;
  record.receivedAt = now;
  return record;
}

for (const dataMode of ["manual", "example"] as const) {
  test(`normal ${dataMode} registers 22 rules without executing any disabled draft`, () => {
    const value = input(); value.laboratory = [lab()];
    const result = assessTilapia(value, knowledge, { now, dataMode });
    assert.equal(result.status, "draft_disabled");
    assert.equal(result.ruleTraces.length, 22);
    assert.equal(result.ruleTraces.filter((item) => item.state === "inactive").length, 13);
    assert.equal(result.ruleTraces.filter((item) => item.state === "unsupported").length, 9);
    assert.ok(result.ruleTraces.every((item) => item.truth === null));
    assert.deepEqual(result.events, []);
    assert.equal(result.riskIndex, null); assert.equal(result.score, null); assert.equal(result.level, null);
  });
}
test("runtime manual input cannot smuggle preview parameters or fixture professional confirmation", () => {
  const value = input(); value.laboratory = [lab()]; value.reviewRecordIds = ["review", "confirmed"];
  const result = assessTilapia(value, knowledge, { now, dataMode: "manual", draftPreview: { label: "Draft simulation" }, professionalRecords: [review(), confirmed()] } as unknown as TilapiaAssessmentContext);
  assert.equal(result.status, "draft_disabled"); assert.deepEqual(result.events, []);
});
test("unsupported rules are distinct from FALSE during explicit preview", () => {
  const result = assessTilapia(input(), knowledge, preview());
  assert.equal(trace(result, 13).state, "unsupported"); assert.equal(trace(result, 13).truth, null);
  assert.equal(trace(result, 2).truth, "unknown"); assert.equal(result.model.state, "draft_disabled");
  assert.ok(result.ruleTraces.every((item) => item.enablement === "draft_disabled"));
});

test("V01 [14_参数与验证 row16] cross-batch clinical and positive evidence never form a confirmation", () => {
  const value = input(); value.clinical = clinical("yes");
  const other = lab(); other.scope = { ...scope, batchId: "other-batch" }; value.laboratory = [other];
  const result = assessTilapia(value, knowledge, withRecords(value, [review(), confirmed()]));
  assert.equal(trace(result, 12).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "confirmed_event" && event.evidenceStatus === "verified_chain"));
  assert.ok(result.quality.issues.some((issue) => issue.field.includes("lab-sag") && issue.code === "scope_mismatch"));
  assert.ok(result.events.some((event) => event.type === "evidence_conflict"));
});
test("V01 time-disjoint same-batch observations cannot be combined by assessmentWindow alone", () => {
  const value = input(); value.clinical = clinical(); value.laboratory = [lab()];
  value.clinical.observedAt = "2026-10-28T10:00:00Z"; value.clinical.receivedAt = "2026-10-28T10:00:00Z";
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 7).truth, "unknown");
  assert.ok(result.events.some((event) => event.type === "pathogen_detection"));
});
test("V02 [14_参数与验证 row17] explicit 30C/24h complete window includes both exact boundaries", () => {
  const value = input(); value.temperatureWindows = [temperature()];
  const context = preview(); context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 2).truth, true);
  assert.ok(result.events.some((event) => event.type === "environment_attention" && event.pathogen === "SAG"));
});
for (const [label, mutate] of [
  ["below temperature", (value: TilapiaAssessmentInput) => { value.temperatureWindows = [temperature(29.9)]; }],
  ["short duration", (value: TilapiaAssessmentInput) => { value.temperatureWindows = [temperature(30, 23.9)]; }],
] as const) {
  test(`V02 complete observed ${label} is FALSE`, () => {
    const value = input(); mutate(value); const context = preview();
    context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
    assert.equal(trace(assessTilapia(value, knowledge, context), 2).truth, false);
  });
}
for (const label of ["missing", "single point", "stale", "gapped", "no coverage record", "missing parameter"] as const) {
  test(`V02 ${label} stays UNKNOWN rather than adopting P01`, () => {
    const value = input(); value.temperatureWindows = [temperature()]; const context = preview();
    context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
    if (label === "missing") value.temperatureWindows = [];
    if (label === "single point") { value.temperatureWindows = []; value.waterTemperature = obs("temperature", 31); }
    if (label === "stale") value.temperatureWindows[0].quality = "stale";
    if (label === "gapped") value.temperatureWindows[0].value!.coverage = "gapped";
    if (label === "no coverage record") value.temperatureWindows[0].value!.coverageRecordRef = null;
    if (label === "missing parameter") delete context.draftPreview!.highTemperature;
    assert.equal(trace(assessTilapia(value, knowledge, context), 2).truth, "unknown");
  });
}
test("SAG high temperature rule never applies SAG evidence to SIN", () => {
  const value = input(); value.targetPathogens = ["SIN"]; value.temperatureWindows = [temperature()];
  const context = preview(); context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 2).truth, false); assert.ok(!result.events.some((event) => event.type === "environment_attention"));
});
test("V03 [14_参数与验证 row18] verified respiratory distress immediately triggers independent emergency", () => {
  const value = input(); value.laboratory = [lab()];
  const result = assessTilapia(value, knowledge, withRecords(value, [review()]));
  assert.equal(trace(result, 3).truth, true);
  assert.ok(result.events.some((event) => event.type === "water_quality_emergency"));
  assert.ok(result.events.some((event) => event.type === "pathogen_detection"));
  assert.ok(!result.events.some((event) => event.type === "confirmed_event"));
});
test("low oxygen numerical path requires explicit limit and raw distress cannot impersonate professional review", () => {
  const value = input(); value.dissolvedOxygen = obs("oxygen", 1); value.clinical = clinical();
  value.clinical.value!.respiratoryDistressObserved = "yes";
  assert.equal(trace(assessTilapia(value, knowledge, preview()), 3).truth, "unknown");
  const context = preview(); context.draftPreview!.lowDissolvedOxygen = { belowMgL: 2 };
  assert.equal(trace(assessTilapia(value, knowledge, context), 3).truth, true);
  value.dissolvedOxygen.value = 2;
  assert.equal(trace(assessTilapia(value, knowledge, context), 3).truth, "unknown");
});
for (const pathogen of ["SAG", "SIN"] as const) {
  test(`V04 [14_参数与验证 row19] asymptomatic ${pathogen} fish detection never creates clinical confirmation`, () => {
    const value = input(); value.clinical = clinical(); value.laboratory = [lab("fish", { pathogen })];
    const result = assessTilapia(value, knowledge, preview());
    assert.equal(trace(result, 7).truth, true);
    assert.ok(result.events.some((event) => event.type === "pathogen_detection" && event.pathogen === pathogen));
    assert.ok(!result.events.some((event) => event.type === "confirmed_event"));
    assert.equal(trace(result, 12).truth, "unknown");
  });
}
test("unknown clinical inspection retains independent fish detection without inventing no signs", () => {
  const value = input(); value.laboratory = [lab()];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 7).truth, "unknown");
  assert.ok(result.events.some((event) => event.type === "pathogen_detection"));
});
for (const [matrixValidated, expected] of [["yes", "environmental_clue"], ["no", "environmental_research"], ["unknown", "environmental_research"]] as const) {
  test(`V05 [14_参数与验证 row20] environmental matrix=${matrixValidated} yields ${expected} only`, () => {
    const value = input(); value.laboratory = [lab("water", { matrix: "environment", matrixValidated })];
    const result = assessTilapia(value, knowledge, preview());
    assert.ok(result.events.some((event) => event.type === expected));
    assert.ok(!result.events.some((event) => event.type === "pathogen_detection" || event.type === "confirmed_event"));
  });
}
test("V06 [14_参数与验证 row21] bad QC only invalidates that laboratory record", () => {
  const value = input(); value.clinical = clinical(); value.laboratory = [lab("bad", { controlsPassed: "no" }), lab("good", { pathogen: "SIN" })];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 14).truth, true);
  assert.ok(result.events.some((event) => event.type === "invalid_detection" && event.evidenceIds.includes("bad")));
  assert.ok(result.events.some((event) => event.type === "pathogen_detection" && event.evidenceIds.includes("good")));
  assert.ok(!result.events.some((event) => event.type === "pathogen_detection" && event.evidenceIds.includes("bad")));
  assert.equal(value.laboratory[0].value!.result, "positive");
});
test("unknown laboratory controls never count as valid positivity", () => {
  const value = input(); value.laboratory = [lab("unknown-controls", { controlsPassed: "unknown" })];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 14).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "pathogen_detection"));
});
test("V07 [14_参数与验证 row22] one negative cannot clear persistent abnormality", () => {
  const value = input(); value.clinical = clinical("yes"); value.laboratory = [lab("negative", { result: "negative" })];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 15).truth, true);
  assert.ok(result.events.some((event) => event.type === "suspected_case"));
});
for (const sequenceType of [null, "283"] as const) {
  test(`V08 [14_参数与验证 row23] serotype III with ST=${sequenceType} does not substitute missing typing provenance`, () => {
    const value = input(); value.laboratory = [lab("typed", { typing: { serotype: "III", sequenceType, schemeId: null, quality: "valid", sourceRef: null } })];
    assert.ok(!assessTilapia(value, knowledge, preview()).events.some((event) => event.type === "public_health_communication"));
  });
}
test("reliable ST283 on the same SAG finding creates communication without human infection conclusion", () => {
  const value = input(); value.laboratory = [lab("typed", { typing: { serotype: null, sequenceType: "283", schemeId: "fixture-MLST", quality: "valid", sourceRef: "fixture-typing" } })];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 16).truth, true);
  assert.ok(result.events.some((event) => event.type === "public_health_communication"));
  value.laboratory[0].value!.typing!.quality = "invalid";
  assert.ok(!assessTilapia(value, knowledge, preview()).events.some((event) => event.type === "public_health_communication"));
});
test("V09 [14_参数与验证 row24] vaccinated fish still enter abnormal-case review", () => {
  const value = input(); value.clinical = clinical("yes");
  value.vaccination = obs("vaccination", { status: "vaccinated", productRef: "fixture-vaccine", administeredAt: "2026-10-01T00:00:00Z", coveredPathogens: null });
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 18).truth, true); assert.ok(result.events.some((event) => event.type === "vaccination_review"));
  delete value.vaccination;
  assert.equal(trace(assessTilapia(value, knowledge, preview()), 18).truth, "unknown");
});
test("V10 [14_参数与验证 row25] missing sensor preserves existing professional confirmation as not recomputed", () => {
  const value = input(); value.waterTemperature = { ...obs("temperature", 30), quality: "missing", value: null };
  const result = assessTilapia(value, knowledge, withRecords(value, [confirmed()]));
  assert.equal(trace(result, 20).truth, true);
  assert.ok(result.events.some((event) => event.type === "confirmed_event" && event.evidenceStatus === "not_recomputed"));
  assert.ok(result.quality.issues.some((issue) => issue.code === "missing"));
  assert.notEqual(result.quality.state, "complete");
});
for (const denominator of [null, 0, 100] as const) {
  test(`V11 [14_参数与验证 row26] denominator=${denominator} yields only a valid same-batch mortality rate`, () => {
    const value = input(); value.mortality = obs("mortality", { window: { ...window, endAt: at }, deadCount: 5, stockStartCount: denominator, abnormalityReported: "yes", abnormalityPersistent: "yes" });
    const result = assessTilapia(value, knowledge, preview());
    assert.equal(trace(result, 11).truth, true); assert.equal(result.mortalityRate, denominator === 100 ? 0.05 : null);
    assert.ok(result.events.some((event) => event.type === "mortality_investigation"));
  });
}
test("invalid mortality counts cannot manufacture a rate or a numeric abnormality threshold", () => {
  const value = input(); value.mortality = obs("mortality", { window: { ...window }, deadCount: 101, stockStartCount: 100, abnormalityReported: "unknown", abnormalityPersistent: "unknown" });
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(result.mortalityRate, null); assert.equal(trace(result, 11).truth, "unknown");
});
function regional(precision: "country_centroid" | "site" = "country_centroid") {
  return obs("regional", { eventId: "fixture-regional", pathogen: "SAG" as const, eventWindow: { ...window }, locationPrecision: precision, eventVerified: "yes" as const, contact: { path: "water_flow" as const, verified: "yes" as const, recordRef: "fixture-contact" } });
}
test("V12 [14_参数与验证 row27] country centroid is regional background even when a contact flag is supplied", () => {
  const value = input(); const event = regional(); event.scope = null; value.regionalEvents = [event];
  const result = assessTilapia(value, knowledge, preview());
  assert.ok(result.events.some((item) => item.type === "regional_background"));
  assert.ok(!result.events.some((item) => item.type === "targeted_surveillance" || item.type === "pathogen_detection"));
  assert.equal(trace(result, 21).truth, "unknown");
});
test("no regional report or no target coverage remains UNKNOWN", () => {
  const value = input(); assert.equal(trace(assessTilapia(value, knowledge, preview()), 21).truth, "unknown");
  value.targetPathogens = ["SIN"]; value.regionalEvents = [regional()];
  assert.equal(trace(assessTilapia(value, knowledge, preview()), 21).truth, "unknown");
});
test("real regional contact requires explicit P09 window and records", () => {
  const value = input(); value.regionalEvents = [regional("site")];
  assert.equal(trace(assessTilapia(value, knowledge, preview()), 21).truth, "unknown");
  const context = preview(); context.draftPreview!.regionalEventValidityHours = 24;
  assert.equal(trace(assessTilapia(value, knowledge, context), 21).truth, true);
  value.regionalEvents[0].value!.contact.recordRef = null;
  assert.equal(trace(assessTilapia(value, knowledge, context), 21).truth, "unknown");
});
test("complete attributable professional chain is shown as existing confirmation rather than invented from a positive", () => {
  const value = input(); value.clinical = clinical("yes"); value.laboratory = [lab()];
  const context = withRecords(value, [review(), confirmed()]);
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 12).truth, true);
  assert.ok(result.events.some((event) => event.type === "confirmed_event" && event.recordId === "confirmed" && event.evidenceStatus === "verified_chain" && event.simulation));
});
test("unresolved conflict is not outvoted by repeated positives and only a linked resolution can resolve it", () => {
  const value = input(); value.laboratory = [lab(), lab("repeat-1"), lab("repeat-2")]; value.clinical = clinical("yes");
  value.conflicts = [{ id: "conflict", observationIds: ["lab-sag"], kind: "pathogen_result", resolutionRecordId: "resolution" }];
  let context = withRecords(value, [review(), confirmed()]);
  let result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 22).truth, true); assert.equal(trace(result, 12).truth, "unknown");
  const resolution: ProfessionalRecord = { ...review("resolution"), finding: { kind: "conflict-resolution", conflictIds: ["conflict"], evidenceObservationIds: ["lab-sag"] } };
  context = withRecords(value, [review(), confirmed(), resolution]); result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 22).truth, false); assert.equal(trace(result, 12).truth, true);
});
test("same sample same target same time opposing results create conflict without mutating evidence", () => {
  const value = input(); value.laboratory = [lab("positive", { sampleId: "same-sample" }), lab("negative", { sampleId: "same-sample", result: "negative" })];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 22).truth, true);
  assert.ok(result.events.some((event) => event.type === "evidence_conflict"));
});
test("different pathogens and later negative are not automatically diagnostic conflicts", () => {
  const value = input(); const later = lab("later", { result: "negative" }); later.observedAt = now; later.receivedAt = now;
  value.laboratory = [lab(), lab("sin", { pathogen: "SIN", result: "negative" }), later];
  assert.equal(trace(assessTilapia(value, knowledge, preview()), 22).truth, false);
});
test("metadata rejects future receipt, no timezone, blank identity, and duplicate observation IDs", () => {
  for (const mutate of [
    (record: TilapiaObservation<LabFinding>) => { record.receivedAt = "2026-10-28T13:00:00Z"; },
    (record: TilapiaObservation<LabFinding>) => { record.observedAt = "2026-10-28T11:00:00"; },
    (record: TilapiaObservation<LabFinding>) => { record.scope!.batchId = ""; },
  ]) {
    const value = input(); const record = lab(); mutate(record); value.laboratory = [record];
    const result = assessTilapia(value, knowledge, preview());
    assert.ok(!result.events.some((event) => event.type === "pathogen_detection")); assert.ok(result.quality.issues.length > 0);
  }
  const value = input(); value.laboratory = [lab(), lab()];
  assert.ok(!assessTilapia(value, knowledge, preview()).events.some((event) => event.type === "pathogen_detection"));
});
test("explicit TTL expires only its dependent evidence and no P12 default is invented", () => {
  const value = input(); value.laboratory = [lab()];
  assert.ok(assessTilapia(value, knowledge, preview()).events.some((event) => event.type === "pathogen_detection"));
  const context = preview(); context.draftPreview!.maxAgeHours = { laboratory: 0.5 };
  const result = assessTilapia(value, knowledge, context);
  assert.ok(!result.events.some((event) => event.type === "pathogen_detection"));
  assert.ok(result.quality.issues.some((issue) => issue.field.includes("lab-sag") && issue.code === "stale"));
});
test("draft helper explicitly labels all professional example records as fixtures", () => {
  const value = createExampleTilapiaInput();
  assert.equal(assessTilapia(value, knowledge, { now }).status, "draft_disabled");
  const packet = createTilapiaDraftExamplePacket();
  assert.equal(packet.context.dataMode, "draft-preview"); assert.equal(packet.context.draftPreview!.label, "Draft simulation");
  assert.ok(packet.context.professionalRecords!.every((item) => item.origin === "fixture"));
  assert.equal(assessTilapia(packet.input, knowledge, packet.context).status, "draft_preview");
});
test("published knowledge integration preserves source SHA, 22/13/9 registry and validation origins", { skip: !existsSync("public/data/knowledge/tilapia-streptococcosis.json") }, () => {
  const actual = JSON.parse(readFileSync("public/data/knowledge/tilapia-streptococcosis.json", "utf8")) as KnowledgeResource;
  const result = assessTilapia(input(), actual, preview());
  assert.equal(actual.source.sha256, "a13f014303048d75e87340e17b30b7d4cdf0de30c56d0d56082754d2fa629f6b");
  assert.equal(result.ruleTraces.length, 22); assert.equal(result.unsupportedRules.length, 9);
  assert.equal(result.ruleTraces.filter((item) => item.execution === "evaluated").length, 13);
  assert.equal(actual.validationCases.length, 12);
  assert.ok(result.ruleTraces.every((item) => item.sourceRefs.length > 0));
});

test("runtime unknown IDs cannot borrow a supported numeric suffix", () => {
  const mutated = structuredClone(knowledge);
  mutated.rules = [{ ...mutated.rules[1], id: "UNTRUSTED-WARN-002" }];
  const value = input(); value.temperatureWindows = [temperature()];
  const context = preview(); context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  const result = assessTilapia(value, mutated, context);
  assert.equal(result.ruleTraces[0].state, "unsupported");
  assert.equal(result.ruleTraces[0].truth, null);
  assert.deepEqual(result.events, []);
});
test("runtime resource enablement mutation cannot activate a draft rule even in preview", () => {
  const mutated = structuredClone(knowledge);
  (mutated.rules[1] as unknown as { enablement: string }).enablement = "approved";
  const value = input(); value.temperatureWindows = [temperature()];
  const context = preview(); context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  const result = assessTilapia(value, mutated, context);
  assert.equal(trace(result, 2).state, "inactive");
  assert.equal(trace(result, 2).truth, null);
  assert.ok(!result.events.some((event) => event.type === "environment_attention"));
});
test("professional chain cannot consume laboratory evidence observed after its signature", () => {
  const value = input(); const later = lab(); later.observedAt = now; later.receivedAt = now;
  value.laboratory = [later];
  const result = assessTilapia(value, knowledge, withRecords(value, [review(), confirmed()]));
  assert.equal(trace(result, 12).truth, "unknown");
  assert.ok(result.events.some((event) => event.type === "confirmed_event" && event.evidenceStatus === "not_recomputed"));
});
test("vaccine administered after the clinical abnormality cannot be called disease after vaccination", () => {
  const value = input(); value.clinical = clinical("yes");
  value.vaccination = obs("vaccination", { status: "vaccinated", productRef: "fixture-product", administeredAt: "2026-10-28T11:30:00Z", coveredPathogens: null });
  value.vaccination.observedAt = now; value.vaccination.receivedAt = now;
  assert.notEqual(trace(assessTilapia(value, knowledge, preview()), 18).truth, true);
});
test("same-scope professional chain requires clinical review signature no later than confirmation", () => {
  const value = input(); value.laboratory = [lab()];
  const laterReview = review(); laterReview.signedAt = now; laterReview.receivedAt = now;
  const result = assessTilapia(value, knowledge, withRecords(value, [laterReview, confirmed()]));
  assert.equal(trace(result, 12).truth, "unknown");
});

test("historical same-batch professional confirmation survives a narrower current assessment as not recomputed", () => {
  const value = input(); value.assessmentWindow = { startAt: "2026-10-28T11:30:00Z", endAt: now };
  const result = assessTilapia(value, knowledge, withRecords(value, [confirmed()]));
  assert.ok(result.events.some((event) => event.type === "confirmed_event" && event.evidenceStatus === "not_recomputed"));
  assert.equal(trace(result, 12).truth, "unknown");
});
test("mortality count window cannot include time after the count was observed", () => {
  const value = input(); value.mortality = obs("mortality", { window: { ...window }, deadCount: 5, stockStartCount: 100, abnormalityReported: "yes", abnormalityPersistent: "yes" });
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(result.mortalityRate, null);
  assert.equal(trace(result, 11).truth, "unknown");
  assert.ok(result.quality.issues.some((issue) => issue.field === "mortality.window"));
});
test("temperature and regional scope mismatches are included in the late conflict trace", () => {
  const value = input(); const high = temperature(); high.scope = { ...scope, unitId: "other-unit" }; value.temperatureWindows = [high];
  const context = preview(); context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 22).truth, true);
  assert.ok(result.events.some((event) => event.type === "evidence_conflict" && event.evidenceIds.includes("temperature-window")));
});
test("three-valued OR becomes FALSE only when both oxygen and professional distress are explicitly FALSE", () => {
  const value = input(); value.dissolvedOxygen = obs("oxygen", 3);
  const record = review(); if (record.finding.kind === "clinical-review") record.finding.respiratoryDistress = "no";
  const context = withRecords(value, [record]); context.draftPreview!.lowDissolvedOxygen = { belowMgL: 2 };
  assert.equal(trace(assessTilapia(value, knowledge, context), 3).truth, false);
});
test("known false vaccination branch is FALSE even when clinical evidence is UNKNOWN", () => {
  const value = input(); value.vaccination = obs("vaccination", { status: "not_vaccinated", productRef: null, administeredAt: null, coveredPathogens: null });
  assert.equal(trace(assessTilapia(value, knowledge, preview()), 18).truth, false);
});

for (const invalid of [null, undefined, "untyped-json", [], { laboratory: null, targetPathogens: [] }] as const) {
  test(`invalid root input ${JSON.stringify(invalid)} fails closed without throwing or running draft rules`, () => {
    const result = assessTilapia(invalid as unknown as TilapiaAssessmentInput, knowledge, preview());
    assert.ok(result.quality.issues.some((issue) => issue.field === "input" && issue.code === "invalid"));
    assert.ok(!result.events.some((event) => event.type === "confirmed_event" || event.type === "pathogen_detection"));
    assert.ok(result.ruleTraces.filter((item) => item.execution === "evaluated").every((item) => item.truth === "unknown"));
  });
}
for (const timestamp of ["2026-10-27T24:00:00Z", "2026-10-28T11:60:00Z", "2026-10-28T11:00:60Z", "2026-10-28T11:00:00+24:00", "2026-10-28T11:00:00+00:60", "2026-02-30T11:00:00Z"] as const) {
  test(`invalid real calendar/clock timestamp ${timestamp} is rejected without normalization`, () => {
    const value = input(); const record = lab(); record.observedAt = timestamp; record.receivedAt = now;
    value.laboratory = [record];
    const result = assessTilapia(value, knowledge, preview());
    assert.ok(!result.events.some((event) => event.type === "pathogen_detection"));
    assert.ok(result.quality.issues.some((issue) => issue.field.includes("observedAt")));
  });
}

test("unspecified targetPathogens keeps SAG applicability UNKNOWN and reports the missing target", () => {
  const value = input(); value.targetPathogens = []; value.temperatureWindows = [temperature()];
  value.laboratory = [lab("typed", { typing: { serotype: null, sequenceType: "283", schemeId: "fixture-MLST", quality: "valid", sourceRef: "fixture-typing" } })];
  value.dissolvedOxygen = obs("oxygen", 1);
  const context = preview(); context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  context.draftPreview!.lowDissolvedOxygen = { belowMgL: 2 };
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 2).truth, "unknown");
  assert.equal(trace(result, 16).truth, "unknown");
  assert.ok(result.quality.issues.some((issue) => issue.field === "targetPathogens" && issue.code === "missing"));
  assert.equal(trace(result, 3).truth, true);
  assert.ok(result.events.some((event) => event.type === "water_quality_emergency"));
  assert.ok(!result.events.some((event) => event.type === "environment_attention" || event.type === "public_health_communication"));
});
test("015 cannot borrow persistent abnormality and time alignment from different source observations", () => {
  const value = input(); value.clinical = clinical("yes");
  value.clinical.observedAt = "2026-10-28T10:00:00Z"; value.clinical.receivedAt = "2026-10-28T10:00:00Z";
  value.laboratory = [lab("negative", { result: "negative" }), lab("independent-positive", { pathogen: "SIN" })];
  value.mortality = obs("mortality", { window: { startAt: at, endAt: at }, deadCount: 0, stockStartCount: 100, abnormalityReported: "no", abnormalityPersistent: "no" });
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 15).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "suspected_case"));
  assert.ok(result.events.some((event) => event.type === "pathogen_detection" && event.evidenceIds.includes("independent-positive")));
});
test("015 cannot consume a mortality window already rejected by 011", () => {
  const value = input(); value.laboratory = [lab("negative", { result: "negative" })];
  value.mortality = obs("mortality", { window: { startAt: "2026-10-28T10:00:00Z", endAt: now }, deadCount: 1, stockStartCount: 100, abnormalityReported: "yes", abnormalityPersistent: "yes" });
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 11).truth, "unknown");
  assert.equal(trace(result, 15).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "suspected_case"));
});
test("007 unresolved clinical conflict blocks asymptomatic inference while preserving fish detection", () => {
  const value = input(); value.clinical = clinical(); value.laboratory = [lab()];
  value.conflicts = [{ id: "clinical-unresolved", observationIds: ["clinical"], kind: "time_alignment" }];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 7).truth, "unknown");
  assert.equal(trace(result, 22).truth, true);
  const detection = result.events.find((event) => event.type === "pathogen_detection");
  assert.ok(detection);
  assert.ok(detection.evidenceIds.includes("lab-sag"));
  assert.ok(!detection.explanation.includes("explicitly negative clinical inspection"));
});
test("015 unresolved clinical conflict cannot establish persistent abnormality", () => {
  const value = input(); value.clinical = clinical("yes"); value.laboratory = [lab("negative", { result: "negative" })];
  value.conflicts = [{ id: "clinical-unresolved", observationIds: ["clinical"], kind: "time_alignment" }];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 15).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "suspected_case"));
});
test("resolved clinical conflict restores 007 only with the linked professional resolution", () => {
  const value = input(); value.clinical = clinical(); value.laboratory = [lab()];
  value.conflicts = [{ id: "clinical-unresolved", observationIds: ["clinical"], kind: "time_alignment", resolutionRecordId: "resolution" }];
  const resolution: ProfessionalRecord = { ...review("resolution"), finding: { kind: "conflict-resolution", conflictIds: ["clinical-unresolved"], evidenceObservationIds: ["clinical"] } };
  const result = assessTilapia(value, knowledge, withRecords(value, [resolution]));
  assert.equal(trace(result, 7).truth, true);
  assert.equal(trace(result, 22).truth, false);
});
test("015 keeps mortality persistence and its actual compatible window paired", () => {
  const value = input(); value.laboratory = [lab("negative", { result: "negative" })];
  value.mortality = obs("mortality", { window: { startAt: "2026-10-28T10:00:00Z", endAt: at }, deadCount: 1, stockStartCount: 100, abnormalityReported: "yes", abnormalityPersistent: "yes" });
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 15).truth, true);
  assert.ok(result.events.some((event) => event.type === "suspected_case"));
});

test("unresolved oxygen conflict cannot establish a numeric water-quality emergency", () => {
  const value = input(); value.dissolvedOxygen = obs("oxygen", 1); value.laboratory = [lab()];
  value.conflicts = [{ id: "oxygen-unresolved", observationIds: ["oxygen"], kind: "other" }];
  const context = preview(); context.draftPreview!.lowDissolvedOxygen = { belowMgL: 2 };
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 3).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "water_quality_emergency"));
  assert.ok(result.events.some((event) => event.type === "pathogen_detection"));
});
test("independent professional respiratory review still acts when numeric oxygen is conflicted", () => {
  const value = input(); value.dissolvedOxygen = obs("oxygen", 1);
  value.conflicts = [{ id: "oxygen-unresolved", observationIds: ["oxygen"], kind: "other" }];
  const result = assessTilapia(value, knowledge, withRecords(value, [review()]));
  assert.equal(trace(result, 3).truth, true);
  assert.ok(result.events.some((event) => event.type === "water_quality_emergency"));
});
test("unresolved temperature-window conflict cannot establish high-temperature exposure", () => {
  const value = input(); value.temperatureWindows = [temperature()];
  value.conflicts = [{ id: "temperature-unresolved", observationIds: ["temperature-window"], kind: "other" }];
  const context = preview(); context.draftPreview!.highTemperature = { thresholdC: 30, minimumDurationHours: 24 };
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 2).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "environment_attention"));
});
test("unresolved mortality conflict cannot establish abnormal mortality or persistence", () => {
  const value = input(); value.laboratory = [lab("negative", { result: "negative" })];
  value.mortality = obs("mortality", { window: { startAt: "2026-10-28T10:00:00Z", endAt: at }, deadCount: 1, stockStartCount: 100, abnormalityReported: "yes", abnormalityPersistent: "yes" });
  value.conflicts = [{ id: "mortality-unresolved", observationIds: ["mortality"], kind: "other" }];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 11).truth, "unknown"); assert.equal(trace(result, 15).truth, "unknown");
  assert.equal(result.mortalityRate, null);
  assert.ok(!result.events.some((event) => event.type === "mortality_investigation" || event.type === "suspected_case"));
});
test("unresolved vaccination conflict cannot establish post-vaccination case review", () => {
  const value = input(); value.clinical = clinical("yes");
  value.vaccination = obs("vaccination", { status: "vaccinated", productRef: "fixture-product", administeredAt: "2026-10-01T00:00:00Z", coveredPathogens: null });
  value.conflicts = [{ id: "vaccination-unresolved", observationIds: ["vaccination"], kind: "other" }];
  const result = assessTilapia(value, knowledge, preview());
  assert.equal(trace(result, 18).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "vaccination_review"));
});
test("unresolved regional contact conflict cannot establish targeted surveillance", () => {
  const value = input(); value.regionalEvents = [regional("site")];
  value.conflicts = [{ id: "regional-unresolved", observationIds: ["regional"], kind: "other" }];
  const context = preview(); context.draftPreview!.regionalEventValidityHours = 24;
  const result = assessTilapia(value, knowledge, context);
  assert.equal(trace(result, 21).truth, "unknown");
  assert.ok(!result.events.some((event) => event.type === "targeted_surveillance"));
});
