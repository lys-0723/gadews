import assert from "node:assert/strict";
import test from "node:test";
import { createTilapiaDraftExamplePacket } from "@/lib/gadews/tilapia-assessment";
import { createEmptyTilapiaForm, createTilapiaLabRow, tilapiaExampleToForm, tilapiaFormIssues, tilapiaFormToInput } from "./tilapia-form";

test("empty manual draft supplies no scope, dates, observations, target or laboratory negatives", () => {
  const form = createEmptyTilapiaForm();
  const input = tilapiaFormToInput(form);
  assert.equal(input.scope, null);
  assert.equal(input.assessmentWindow, null);
  assert.deepEqual(input.targetPathogens, []);
  assert.deepEqual(input.laboratory, []);
  assert.equal(input.clinical, undefined);
  assert.equal(input.waterTemperature, undefined);
  assert.ok(tilapiaFormIssues(form).some((issue) => issue.field === "scope" && issue.code === "missing"));
  assert.ok(tilapiaFormIssues(form).some((issue) => issue.field === "assessmentWindow" && issue.code === "missing"));
});

test("partial scope and time stay explicit, zero survives, and absent metadata is never supplied", () => {
  const form = createEmptyTilapiaForm();
  form.siteId = "site-only"; form.assessmentWindow.startAt = "2026-10-28T10:00:00";
  form.waterTemperature.value = "0";
  const input = tilapiaFormToInput(form);
  assert.deepEqual(input.scope, { siteId: "site-only", unitId: "", batchId: "" });
  assert.deepEqual(input.assessmentWindow, { startAt: "2026-10-28T10:00:00", endAt: "" });
  assert.equal(input.waterTemperature?.value, 0);
  assert.equal(input.waterTemperature?.observedAt, null);
  assert.equal(input.waterTemperature?.receivedAt, null);
  assert.equal(input.waterTemperature?.quality, "missing");
  assert.equal(input.waterTemperature?.sourceRef, null);
  assert.equal(input.waterTemperature?.observationWindow, undefined);
  assert.ok(tilapiaFormIssues(form).some((issue) => issue.field === "assessmentWindow.startAt" && issue.code === "invalid"));
});

test("invalid lexical numbers and impossible counts remain invalid rather than becoming missing or zero", () => {
  const form = createEmptyTilapiaForm();
  form.waterTemperature.value = "12abc"; form.dissolvedOxygen.value = "-1";
  form.mortality.deadCount = "1.5"; form.mortality.stockStartCount = "0";
  const input = tilapiaFormToInput(form);
  assert.ok(Number.isNaN(input.waterTemperature?.value));
  assert.equal(input.dissolvedOxygen?.value, -1);
  assert.equal(input.mortality?.value?.deadCount, 1.5);
  assert.equal(input.mortality?.value?.stockStartCount, 0);
  for (const field of ["waterTemperature.value", "dissolvedOxygen.value", "mortality.deadCount", "mortality.stockStartCount"]) {
    assert.ok(tilapiaFormIssues(form).some((issue) => issue.field === field && issue.code === "invalid"), field);
  }
  assert.equal(form.waterTemperature.value, "12abc");
});

test("clinical unknown and missing laboratory enums never imply absent disease or a SAG negative", () => {
  const form = createEmptyTilapiaForm(); form.clinical.sourceRef = "inspection";
  form.laboratory = [{ ...createTilapiaLabRow("lab-7"), sampleId: "sample-7", result: "negative", quality: "valid" }];
  const input = tilapiaFormToInput(form);
  assert.equal(input.clinical?.value?.signsPresent, "unknown");
  assert.equal(input.clinical?.value?.persistentAbnormality, "unknown");
  assert.equal(input.laboratory[0].id, "lab-7");
  assert.equal(input.laboratory[0].value, null);
  assert.equal(input.laboratory[0].quality, "missing");
  assert.ok(tilapiaFormIssues(form).some((issue) => issue.field === "laboratory.lab-7.pathogen" && issue.code === "missing"));
});

test("distinct SAG fish and SIN environment findings preserve identity and independent QC", () => {
  const form = createEmptyTilapiaForm();
  form.laboratory = [
    { ...createTilapiaLabRow("lab-2"), sampleId: "fish-a", pathogen: "SAG", matrix: "fish_tissue", assayId: "pcr-a", result: "positive", controlsPassed: "yes", matrixValidated: "yes", observedAt: "2026-10-28T10:00:00Z", sourceRef: "report-a", quality: "valid" },
    { ...createTilapiaLabRow("lab-9"), sampleId: "water-b", pathogen: "SIN", matrix: "environment", assayId: "pcr-b", result: "negative", controlsPassed: "no", matrixValidated: "unknown", observedAt: "2026-10-28T11:00:00Z", sourceRef: "report-b", quality: "invalid" },
  ];
  const labs = tilapiaFormToInput(form).laboratory;
  assert.equal(labs[0].value?.sampleId, "fish-a"); assert.equal(labs[0].value?.pathogen, "SAG");
  assert.equal(labs[1].id, "lab-9"); assert.equal(labs[1].value?.pathogen, "SIN");
  assert.equal(labs[1].value?.matrix, "environment"); assert.equal(labs[1].value?.controlsPassed, "no");
  assert.equal(labs[0].sourceRef, "report-a"); assert.equal(labs[1].sourceRef, "report-b");
});

test("rebuilding an edited example retains visible observations but strips professional references and hidden fixtures", () => {
  const packet = createTilapiaDraftExamplePacket();
  packet.input.vaccination = { ...packet.input.clinical!, value: { status: "vaccinated", productRef: "fixture-vaccine", administeredAt: "2026-10-01T00:00:00Z", coveredPathogens: null } };
  const form = tilapiaExampleToForm(packet.input); form.unitId = "edited-unit";
  const input = tilapiaFormToInput(form);
  assert.equal("unitId" in input, false);
  assert.equal(input.scope?.unitId, "edited-unit");
  assert.equal(input.laboratory[0].id, "fixture-lab-sag");
  assert.equal(input.clinical?.id, "fixture-clinical");
  assert.equal(input.reviewRecordIds, undefined);
  assert.equal(input.vaccination, undefined);
  assert.equal(input.temperatureWindows, undefined);
  assert.equal(input.conflicts, undefined);
});

test("non-decimal lexical measurements remain invalid and cannot become a usable reading", () => {
  const form = createEmptyTilapiaForm(); form.waterTemperature.value = "0x20";
  assert.ok(Number.isNaN(tilapiaFormToInput(form).waterTemperature?.value));
  assert.ok(tilapiaFormIssues(form).some((issue) => issue.field === "waterTemperature.value" && issue.code === "invalid"));
});
