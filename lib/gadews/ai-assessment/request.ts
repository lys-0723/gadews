import { z } from "zod";
import type { AiAssessmentRequest } from "./types";

const short = z.string().max(500), id = z.string().max(200), date = z.string().max(100);
const clockDate = date.refine(value => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m) return false;
  return +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= new Date(Date.UTC(+m[1],+m[2],0)).getUTCDate()
    && +m[4] <= 23 && +m[5] <= 59 && +m[6] <= 59 && (!m[7] || +m[7] <= 23 && +m[8] <= 59) && Number.isFinite(Date.parse(value));
});
const window = z.object({ startAt: date, endAt: date }).strict();
const scope = z.object({ siteId: id, unitId: id, batchId: id }).strict();
const truth = z.enum(["yes", "no", "unknown"]);
const observation = <T extends z.ZodTypeAny>(value: T) => z.object({
  id, scope: scope.nullable(), observedAt: date.nullable(), receivedAt: date.nullable(), observationWindow: window.optional(),
  quality: z.enum(["valid", "invalid", "stale", "missing"]), sourceRef: short.nullable(), value: value.nullable(),
}).strict();
const lab = z.object({ sampleId: id, pathogen: z.enum(["SAG", "SIN"]), matrix: z.enum(["fish_tissue", "environment"]), assayId: id,
  result: z.enum(["positive", "negative", "inconclusive", "invalid", "not_tested"]), controlsPassed: truth, matrixValidated: truth }).strict();
const tilapia = z.object({
  scope: scope.nullable(), assessmentWindow: window.nullable(), targetPathogens: z.array(z.enum(["SAG", "SIN"])).max(2).refine(values => new Set(values).size === values.length),
  waterTemperature: observation(z.number().finite()).optional(), dissolvedOxygen: observation(z.number().finite()).optional(),
  clinical: observation(z.object({ signsPresent: truth, persistentAbnormality: truth, respiratoryDistressObserved: truth }).strict()).optional(),
  mortality: observation(z.object({ window, deadCount: z.number().finite().nullable(), stockStartCount: z.number().finite().nullable(), abnormalityReported: truth, abnormalityPersistent: truth }).strict()).optional(),
  laboratory: z.array(observation(lab)).max(16).refine(rows => new Set(rows.map(row => row.id)).size === rows.length),
  conflicts: z.array(z.object({ id, observationIds: z.array(id).max(32), kind: z.enum(["sample_identity", "pathogen_result", "time_alignment", "other"]) }).strict()).max(32).optional(),
}).strict();
const fields = new Set(["regionOrSite", "farmOrPondId", "species", "farmingMode", "growthStage", "month", "waterTemperatureC", "ph", "pH", "farmingEnvironmentType", "pcrQpcrResult", "rapidTestResult", "ctValue", "animalQpcrQuantitativeResult", "environmentalSampleResult", "pcrQpcrResult_2", "liveFeedResult", "reducedFeeding", "abnormalSwimming", "abnormalSwimmingOrLethargy", "pondEdgeAggregation", "whiteSpots", "redBodyOrSoftShell", "redBody", "softShell", "increasedMortality", "massMortality", "birdAggregation", "pathologyResult", "histopathologyResult", "ishResult", "regionalDiseaseBackground", "localDiseaseBackground", "historicalWssvPositiveRecord"]);
const wsd = z.record(z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()])).refine(value => Object.keys(value).every(key => fields.has(key)));
const context = z.object({
  dataMode: z.enum(["manual", "example", "draft-preview"]).optional(), now: clockDate.optional(),
  observations: z.record(z.object({ observedAt: date.optional(), maxAgeHours: z.number().finite().optional(), scope: id.optional() }).strict()).optional(),
  inputProvenance: z.record(z.unknown()).optional(),
}).strict();
const schema = z.discriminatedUnion("diseaseId", [
  z.object({ diseaseId: z.literal("wsd"), standardId: z.literal("wsd-v1.0"), locale: z.enum(["zh-CN", "en"]), input: wsd, context }).strict(),
  z.object({ diseaseId: z.literal("tilapia-streptococcosis"), standardId: z.literal("tilapia-demo-score-v0.1"), locale: z.enum(["zh-CN", "en"]), input: tilapia, context }).strict(),
]);
export function parseAiAssessmentRequest(value: unknown): AiAssessmentRequest {
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }]; let size = 0, count = 0;
  while (stack.length) {
    const item = stack.pop()!; if (item.depth > 12 || ++count > 3000) throw new Error("Request structure exceeds limit");
    if (typeof item.value === "string") size += new TextEncoder().encode(item.value).byteLength;
    else if (item.value && typeof item.value === "object") for (const [key, child] of Object.entries(item.value)) {
      size += new TextEncoder().encode(key).byteLength; stack.push({ value: child, depth: item.depth + 1 });
    }
    if (size > 32768) throw new Error("Request text exceeds limit");
  }
  return schema.parse(value) as AiAssessmentRequest;
}
