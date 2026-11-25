import type { LabFinding, TilapiaAssessmentInput, TilapiaObservation } from "../tilapia-types";

export const FIXTURE_NOW = "2026-10-30T12:00:00Z";
export const FIXTURE_SCOPE = { siteId: "private-site", unitId: "private-pond", batchId: "private-batch" };
export function observation<T>(value: T, id = "obs"): TilapiaObservation<T> {
  return { id, scope: { ...FIXTURE_SCOPE }, observedAt: FIXTURE_NOW, receivedAt: FIXTURE_NOW, quality: "valid", sourceRef: "private-source", value };
}
export function lab(pathogen: "SAG" | "SIN", matrix: "fish_tissue" | "environment", result: "positive" | "negative", id = pathogen + matrix): TilapiaObservation<LabFinding> {
  return observation({ sampleId: id, pathogen, matrix, assayId: "assay", result, controlsPassed: "yes", matrixValidated: "yes" }, id);
}
export function completeTilapia(): TilapiaAssessmentInput {
  return {
    scope: { ...FIXTURE_SCOPE }, assessmentWindow: { startAt: "2026-10-30T00:00:00Z", endAt: FIXTURE_NOW }, targetPathogens: ["SAG", "SIN"],
    waterTemperature: observation(28, "temperature"), dissolvedOxygen: observation(6, "oxygen"),
    clinical: observation({ signsPresent: "no", persistentAbnormality: "no", respiratoryDistressObserved: "no" }, "clinical"),
    mortality: observation({ window: { startAt: "2026-10-30T00:00:00Z", endAt: FIXTURE_NOW }, deadCount: 0, stockStartCount: 100, abnormalityReported: "no", abnormalityPersistent: "no" }, "mortality"),
    laboratory: [lab("SAG", "fish_tissue", "negative"), lab("SIN", "fish_tissue", "negative"), lab("SAG", "environment", "negative"), lab("SIN", "environment", "negative")],
  };
}
