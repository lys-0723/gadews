import resource from "@/public/data/demo/tilapia-demo-score-v0.1.json";
import type { AssessmentContext, AssessmentLevel, QualityIssue } from "../warning-assessment";
import type { LabFinding, TilapiaAssessmentInput, TilapiaObservation, TimeWindow } from "../tilapia-types";
import type { BaselineItem, ComparisonBaseline, ItemStatus, ScoringRubric } from "./types";

export const tilapiaScoringRubric = resource as ScoringRubric;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
function epoch(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min, sec, , oh, om] = match;
  if (+m < 1 || +m > 12 || +d < 1 || +d > new Date(Date.UTC(+y, +m, 0)).getUTCDate() || +h > 23 || +min > 59 || +sec > 59 || (oh && (+oh > 23 || +om > 59))) return null;
  return Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
}
function interval(window: TimeWindow | null | undefined): [number, number] | null {
  const start = epoch(window?.startAt), end = epoch(window?.endAt);
  return start !== null && end !== null && start <= end ? [start, end] : null;
}
function span(record: TilapiaObservation<unknown>): [number, number] | null {
  const time = epoch(record.observedAt);
  return record.observationWindow ? interval(record.observationWindow) : time === null ? null : [time, time];
}
export function classifyTilapiaScore(score: number): AssessmentLevel {
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Invalid project score");
  const rank = score < 25 ? 0 : score < 50 ? 1 : score < 75 ? 2 : 3;
  return { id: ["low", "medium", "high", "very-high"][rank], label: ["低关注", "中关注", "高关注", "很高关注"][rank], rank };
}
export function evaluateTilapiaDemo(input: TilapiaAssessmentInput, context: AssessmentContext = {}, rubric = tilapiaScoringRubric): ComparisonBaseline {
  const issues: QualityIssue[] = [];
  const add = (field: string, code: QualityIssue["code"], message: string) => {
    if (!issues.some(issue => issue.field === field && issue.code === code)) issues.push({ field, code, message });
  };
  const now = epoch(context.now ?? new Date());
  const window = interval(input.assessmentWindow);
  const scope = input.scope;
  const validScope = !!scope && [scope.siteId, scope.unitId, scope.batchId].every(text);
  const validWindow = !!window && now !== null && window[1] <= now;
  if (!validScope) add("scope", "missing", "Site, unit and batch are required.");
  if (!validWindow) add("assessmentWindow", "invalid", "An attributable assessment window and current time are required.");
  function usable(record: TilapiaObservation<unknown> | undefined, field: string): boolean {
    if (!record) { add(field, "missing", "No observation was supplied."); return false; }
    if (!validScope || !record.scope || !scope || record.scope.siteId !== scope.siteId || record.scope.unitId !== scope.unitId || record.scope.batchId !== scope.batchId) { add(field, "scope_mismatch", "Observation scope differs from the selected site, unit or batch."); return false; }
    if (record.quality !== "valid") { add(field, record.quality === "stale" ? "stale" : record.quality === "missing" ? "missing" : "invalid", "Observation quality is not valid."); return false; }
    const range = span(record), at = epoch(record.observedAt), received = record.receivedAt === null ? at : epoch(record.receivedAt);
    if (!validWindow || !window || !range || at === null || received === null || now === null || range[0] < window[0] || range[1] > window[1] || at < range[0] || at > range[1] || received < at || received > now) { add(field, "stale", "Observation time does not fit the assessment or receipt time."); return false; }
    if (!text(record.id) || !text(record.sourceRef) || record.value === null) { add(field, "missing", "Observation identity, source and value are required."); return false; }
    return true;
  }
  const targets = new Set(input.targetPathogens.filter(value => value === "SAG" || value === "SIN"));
  if (!targets.size) add("targetPathogens", "missing", "Select the pathogens being assessed.");
  const conflicts = new Set((input.conflicts ?? []).flatMap(conflict => [...conflict.observationIds]));
  const validLabs = input.laboratory.filter(record => {
    const value = record.value;
    if (!value || !targets.has(value.pathogen)) return false;
    if (!usable(record, "laboratory." + record.id)) return false;
    if (!["fish_tissue", "environment"].includes(value.matrix) || !text(value.sampleId) || !text(value.assayId) || value.controlsPassed !== "yes" || value.matrixValidated !== "yes" || !["positive", "negative"].includes(value.result)) {
      add("laboratory." + record.id, value.result === "not_tested" ? "not_tested" : value.result === "inconclusive" ? "inconclusive" : "invalid", "A qualified target, matrix, result and passed controls are required."); return false;
    }
    return true;
  });
  for (const a of validLabs) for (const b of validLabs) {
    if (a === b) continue;
    const av = a.value!, bv = b.value!, ar = span(a)!, br = span(b)!;
    if (av.sampleId === bv.sampleId && av.pathogen === bv.pathogen && av.matrix === bv.matrix && av.result !== bv.result && Math.max(ar[0], br[0]) <= Math.min(ar[1], br[1])) { conflicts.add(a.id); conflicts.add(b.id); }
  }
  for (const id of conflicts) add("conflicts." + id, "rule_conflict", "Unresolved evidence conflict; independent valid positive findings are retained.");
  function make(index: number, suffix: string | null, reason: string, state: ItemStatus = "unknown"): BaselineItem {
    const item = rubric.items[index], branch = item.branches.find(value => value.id === item.id + ":" + suffix);
    return { itemId: item.id, label: item.label, module: item.module, status: branch ? "matched" : state, branchId: branch?.id ?? null, score: branch?.score ?? null, reason, inputFields: [item.field], sourceRefs: [...item.sourceRefs] };
  }
  function numeric(index: number, record: TilapiaObservation<number> | undefined, choose: (value: number) => string) {
    const field = rubric.items[index].field;
    if (!usable(record, field) || conflicts.has(record!.id)) return make(index, null, "Observation is missing, invalid or conflicting.");
    const value = record!.value;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (index === 0 && value > 60) || (index === 1 && value > 50)) { add(field, "invalid", "A finite applicable water measurement is required."); return make(index, null, "Invalid water measurement."); }
    return make(index, choose(value), "Qualified point observation evaluated against the project standard.");
  }
  function finding(index: number, matrix: LabFinding["matrix"]) {
    const candidates = validLabs.filter(record => record.value!.matrix === matrix);
    if (candidates.some(record => !conflicts.has(record.id) && record.value!.result === "positive")) return make(index, "positive", "At least one independent qualified target positive; counted once.");
    if (targets.size && !candidates.some(record => conflicts.has(record.id)) && [...targets].every(target => candidates.some(record => !conflicts.has(record.id) && record.value!.pathogen === target && record.value!.result === "negative"))) return make(index, "negative", "Every selected target has an independent qualified negative finding.");
    add(rubric.items[index].field, candidates.some(record => conflicts.has(record.id)) ? "rule_conflict" : "unknown", "One or more selected targets are untested, unqualified or conflicting.");
    return make(index, null, "Selected target findings remain unknown.", candidates.some(record => conflicts.has(record.id)) ? "conflict" : "unknown");
  }
  const clinicalValid = usable(input.clinical, "clinical") && !conflicts.has(input.clinical!.id);
  let mortalityValid = usable(input.mortality, "mortality") && !conflicts.has(input.mortality!.id);
  const mortality = input.mortality?.value;
  const mortalityWindow = interval(mortality?.window);
  if (mortalityValid && (!mortalityWindow || !window || mortalityWindow[0] < window[0] || mortalityWindow[1] > window[1] || epoch(input.mortality?.observedAt)! < mortalityWindow[1])) { mortalityValid = false; add("mortality.window", "invalid", "Mortality window must match the observations."); }
  let mortalityRate: number | null = null;
  if (mortalityValid && mortality) {
    const { deadCount, stockStartCount } = mortality;
    if (typeof deadCount === "number" && Number.isInteger(deadCount) && deadCount >= 0 && typeof stockStartCount === "number" && Number.isInteger(stockStartCount) && stockStartCount > 0 && deadCount <= stockStartCount) mortalityRate = deadCount / stockStartCount;
    else add("mortality.counts", "missing", "Valid deaths and starting stock are required for a mortality rate.");
  }
  function reported(index: number, value: unknown, valid: boolean) {
    if (!valid || (value !== "yes" && value !== "no")) { add(rubric.items[index].field, "unknown", "An explicit usable yes or no is required."); return make(index, null, "Reported state remains unknown."); }
    return make(index, value, value === "yes" ? "Explicit abnormality reported." : "Explicit absence reported.");
  }
  const thresholds = rubric.thresholds!;
  const items = [
    numeric(0, input.waterTemperature, value => value >= thresholds.temperatureC ? "above" : "below"),
    numeric(1, input.dissolvedOxygen, value => value >= thresholds.oxygenHigh ? "normal" : value >= thresholds.oxygenLow ? "middle" : "low"),
    finding(2, "fish_tissue"), finding(3, "environment"),
    reported(4, input.clinical?.value?.signsPresent, clinicalValid), reported(5, input.clinical?.value?.persistentAbnormality, clinicalValid),
    reported(6, mortality?.abnormalityReported, mortalityValid), reported(7, mortality?.abnormalityPersistent, mortalityValid),
  ];
  const evaluatedCount = items.filter(item => item.score !== null).length, knownSubtotal = items.reduce((sum, item) => sum + (item.score ?? 0), 0);
  const complete = evaluatedCount === 8 && issues.length === 0;
  return { items, knownSubtotal, completeScore: complete ? knownSubtotal : null, maxScore: 100, level: complete ? classifyTilapiaScore(knownSubtotal) : null,
    quality: { state: complete ? "complete" : evaluatedCount ? "partial" : "insufficient_data", issues }, minimumAttention: clinicalValid && input.clinical!.value!.respiratoryDistressObserved === "yes" ? "urgent" : items[2].score === 35 ? "review" : "none",
    evaluatedCount, totalCount: 8, dataMode: context.dataMode ?? "manual", metrics: { mortalityRate } };
}
