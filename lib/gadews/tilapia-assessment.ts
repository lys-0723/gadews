import type { QualityIssue, QualityIssueCode } from "./warning-assessment";
import { snapshotAssessmentRecord } from "./warning-assessment";
import type {
  EvidenceConflict, KnowledgeResource, MonitoringScope,
  ProfessionalRecord, TilapiaAssessmentContext, TilapiaAssessmentInput,
  TilapiaAssessmentResult, TilapiaEvent, TilapiaEventType, TilapiaObservation,
  TilapiaPathogen, TilapiaPreviewParameters, TilapiaRuleTrace, TilapiaRuleTruth,
  TimeWindow, Truth,
} from "./tilapia-types";
import { predictTilapia } from "./tilapia-prediction";

export type * from "./tilapia-types";

const SUPPORTED = new Set([2, 3, 7, 8, 11, 12, 14, 15, 16, 18, 20, 21, 22]);
type Interval = { start: number; end: number };
type Observation = TilapiaObservation<unknown>;
type AgeKey = keyof NonNullable<TilapiaPreviewParameters["maxAgeHours"]>;
const ruleId = (number: number) => `TST-WARN-${String(number).padStart(3, "0")}`;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const truth = (value: Truth | undefined): TilapiaRuleTruth => value === "yes" ? true : value === "no" ? false : "unknown";
function and(...values: TilapiaRuleTruth[]): TilapiaRuleTruth {
  return values.includes(false) ? false : values.length > 0 && values.every((value) => value === true) ? true : "unknown";
}
function or(...values: TilapiaRuleTruth[]): TilapiaRuleTruth {
  return values.includes(true) ? true : values.length > 0 && values.every((value) => value === false) ? false : "unknown";
}
function time(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  if (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59 || (match[7] && (Number(match[8]) > 23 || Number(match[9]) > 59))) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function interval(value: TimeWindow | null | undefined): Interval | null {
  const start = time(value?.startAt); const end = time(value?.endAt);
  return start !== null && end !== null && start <= end ? { start, end } : null;
}
function observationInterval(value: Observation | undefined): Interval | null {
  if (!value) return null;
  if (value.observationWindow) return interval(value.observationWindow);
  const at = time(value.observedAt);
  return at === null ? null : { start: at, end: at };
}
function validScope(value: MonitoringScope | null | undefined): value is MonitoringScope {
  return !!value && text(value.siteId) && text(value.unitId) && text(value.batchId);
}
function sameScope(left: MonitoringScope | null | undefined, right: MonitoringScope | null | undefined): boolean {
  return validScope(left) && validScope(right) && left.siteId === right.siteId && left.unitId === right.unitId && left.batchId === right.batchId;
}
function contains(parent: Interval | null, child: Interval | null): boolean {
  return !!parent && !!child && parent.start <= child.start && parent.end >= child.end;
}
function overlaps(left: Interval | null, right: Interval | null): boolean {
  return !!left && !!right && Math.max(left.start, right.start) <= Math.min(left.end, right.end);
}

/**
 * Runs only explicit engineering previews. Professional records belong to a trusted
 * caller adapter; form input can reference IDs but cannot supply or sign records.
 * No real adapter is installed by this module. Fixture records are preview-only.
 */
export function assessTilapia(
  input: TilapiaAssessmentInput,
  knowledge: KnowledgeResource,
  context?: TilapiaAssessmentContext,
): TilapiaAssessmentResult {
  const rootValid = !!input && typeof input === "object" && !Array.isArray(input) && Array.isArray(input.laboratory) && Array.isArray(input.targetPathogens);
  const rawInput = input;
  if (!rootValid) input = { scope: null, assessmentWindow: null, targetPathogens: [], laboratory: [] };
  const parsedNow = context?.now instanceof Date ? context.now.getTime() : time(context?.now);
  const now = parsedNow !== null && Number.isFinite(parsedNow) ? parsedNow : Date.now();
  const dataMode = context?.dataMode === "example" ? "example" : context?.dataMode === "draft-preview" ? "draft-preview" : "manual";
  const assessedAt = new Date(now).toISOString();
  const contextSnapshot = snapshotAssessmentRecord({ ...context, requestedNow: context?.now, now: assessedAt, dataMode });
  const inputSnapshot = snapshotAssessmentRecord(rootValid ? input : { invalidInput: rawInput });
  const preview = dataMode === "draft-preview" && context?.draftPreview?.label === "Draft simulation";
  const parameters = preview ? context!.draftPreview : undefined;
  const rules = knowledge.rules;
  const ruleTraces: TilapiaRuleTrace[] = rules.map((rule) => {
    const number = Number(rule.id.slice(-3));
    const support = rule.id === ruleId(number) && SUPPORTED.has(number) && rule.executionSupport === "deterministic" ? "deterministic" : "unsupported";
    const executable = preview && rule.enablement === "draft_disabled";
    return {
      ruleId: rule.id, name: rule.name, support, enablement: "draft_disabled",
      execution: support === "unsupported" ? "unsupported" : executable ? "evaluated" : "disabled",
      state: support === "unsupported" ? "unsupported" : executable ? "active" : "inactive",
      truth: null, reasons: support === "unsupported" ? ["This draft rule is registered but not implemented."] : preview ? [] : ["Draft disabled outside explicit Draft simulation."],
      evidenceIds: [], sourceRefs: rule.sourceRefs.map((ref) => ({ ...ref })),
    };
  });
  const issues: QualityIssue[] = [];
  const expected = new Set<string>();
  const observed = new Set<string>();
  const events: TilapiaEvent[] = [];
  const actions = new Set<string>(["Prediction model not configured."]);
  const prediction = predictTilapia(input);
  const result: TilapiaAssessmentResult = {
    schemaVersion: "1.0", diseaseId: "tilapia-streptococcosis", dataMode,
    assessedAt, inputSnapshot, contextSnapshot,
    status: preview ? "draft_preview" : "draft_disabled",
    model: { id: knowledge.resourceId, version: knowledge.schemaVersion, state: "draft_disabled", source: [knowledge.source.workbookName, knowledge.source.sha256], warnings: ["Draft simulation only; no scientific parameter approval or production warning.", prediction.reason] },
    quality: { state: "insufficient_data", observedFields: [], expectedFields: [], issues },
    knownScore: null, maxScore: null, score: null, riskIndex: null, level: null,
    minimumAttention: "none", drivers: [], actions: [], unsupportedRules: ruleTraces.filter((item) => item.support === "unsupported").map((item) => item.ruleId),
    prediction: { state: prediction.state, probability: prediction.probability, horizonHours: prediction.horizonHours },
    ruleTraces, events, mortalityRate: null,
  };
  if (!rootValid) {
    issues.push({ field: "input", code: "invalid", message: "Input must be an assessment object with targetPathogens and laboratory arrays; no draft rule was run." });
    for (const trace of ruleTraces.filter((item) => item.execution === "evaluated")) {
      trace.truth = "unknown"; trace.state = "insufficient_data"; trace.reasons = ["Invalid root input; evaluation was not attempted."];
    }
    result.actions = [...actions];
    return result;
  }
  if (!preview) { result.actions = [...actions]; return result; }

  function issue(field: string, code: QualityIssueCode, message: string, number?: number) {
    const id = number ? ruleId(number) : undefined;
    if (!issues.some((value) => value.field === field && value.code === code && value.ruleId === id && value.message === message)) {
      issues.push({ field, code, message, ...(id ? { ruleId: id } : {}) });
    }
  }
  function finish(number: number, value: TilapiaRuleTruth, reasons: string[], ids: readonly string[] = []) {
    const item = ruleTraces.find((trace) => trace.ruleId === ruleId(number));
    if (!item || item.execution !== "evaluated") return;
    item.truth = value;
    item.state = value === true ? "matched" : value === false ? "not_matched" : "insufficient_data";
    item.reasons = reasons;
    item.evidenceIds = [...new Set(ids)];
    if (value === "unknown") issue(`rules.${ruleId(number)}`, "unknown", reasons.join(" "), number);
  }
  function addEvent(number: number, type: TilapiaEventType, label: string, explanation: string, ids: readonly string[] = [], pathogen: TilapiaPathogen | null = null, extra: Partial<TilapiaEvent> = {}) {
    const rule = rules.find((item) => item.id === ruleId(number));
    if (!rule || !ruleTraces.some((item) => item.ruleId === rule.id && item.execution === "evaluated")) return;
    events.push({ id: `${ruleId(number)}:${type}:${events.length + 1}`, type, ruleId: ruleId(number), label, explanation, pathogen, evidenceIds: [...new Set(ids)], simulation: true, sourceRefs: rule.sourceRefs.map((ref) => ({ ...ref })), ...extra });
  }
  const assessmentInterval = interval(input.assessmentWindow);
  const automaticConflicts: EvidenceConflict[] = [];
  const observationCandidates: (Observation | undefined)[] = [
    input.waterTemperature, ...(input.temperatureWindows ?? []), input.dissolvedOxygen,
    input.clinical, input.mortality, ...input.laboratory, input.vaccination, ...(input.regionalEvents ?? []),
  ];
  const allObservations = observationCandidates.filter((value): value is Observation => !!value);
  const idCounts = new Map<string, number>();
  for (const record of allObservations) idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
  function conflictFor(field: string, record: Observation, kind: EvidenceConflict["kind"]) {
    const id = `auto:${kind}:${record.id}`;
    if (!automaticConflicts.some((conflict) => conflict.id === id)) automaticConflicts.push({ id, observationIds: [record.id], kind });
    issue(field, kind === "sample_identity" ? "scope_mismatch" : "rule_conflict", kind === "sample_identity" ? "Observation does not belong to this site, unit and batch." : "Observation time does not fit its assessment or declared window.", 22);
  }
  const validity = new Map<string, boolean>();
  function validObservation(record: Observation | undefined, field: string, ageKey: AgeKey, regionalBackground = false): boolean {
    expected.add(field);
    if (!record) { issue(field, "missing", "Required observation is missing."); return false; }
    observed.add(field);
    const cacheKey = `${field}:${regionalBackground}`;
    if (validity.has(cacheKey)) return validity.get(cacheKey)!;
    let valid = true;
    function bad(suffix: string, code: QualityIssueCode, message: string) { valid = false; issue(`${field}${suffix}`, code, message); }
    if (!text(record.id) || idCounts.get(record.id)! > 1) bad(".id", "invalid", "Observation ID is missing or duplicated.");
    if (record.quality !== "valid") bad(".quality", ["invalid", "stale", "missing"].includes(record.quality) ? record.quality : "invalid", "Observation quality is not valid.");
    if (record.value === null || record.value === undefined) bad(".value", "missing", "Observation value is missing.");
    if (!text(record.sourceRef)) bad(".sourceRef", "missing", "Observation source reference is missing.");
    if (!regionalBackground && !sameScope(record.scope, input.scope)) { valid = false; conflictFor(`${field}.scope`, record, "sample_identity"); }
    const at = time(record.observedAt); const received = time(record.receivedAt); const span = observationInterval(record);
    if (at === null) bad(".observedAt", "missing", "Observation time must be valid ISO8601 with timezone.");
    if (received === null) bad(".receivedAt", "missing", "Receipt time must be valid ISO8601 with timezone.");
    if (at !== null && received !== null && (received < at || received > now || at > now)) bad(".receivedAt", "invalid", "Receipt must follow observation and must not be in the future.");
    if (!regionalBackground && (!assessmentInterval || !span || !contains(assessmentInterval, span) || (at !== null && span.end !== at))) {
      valid = false; conflictFor(`${field}.observationWindow`, record, "time_alignment");
    }
    const maximumAge = parameters?.maxAgeHours?.[ageKey];
    if (maximumAge !== undefined) {
      if (!finite(maximumAge) || maximumAge < 0) bad(".maxAgeHours", "invalid", "An explicit maximum age must be a non-negative finite number.");
      else if (at !== null && now - at > maximumAge * 3_600_000) bad(".observedAt", "stale", "Observation exceeds its explicitly supplied preview age.");
    }
    validity.set(cacheKey, valid);
    return valid;
  }
  if (!validScope(input.scope)) issue("scope", "missing", "Assessment site, unit and batch are required.");
  if (!assessmentInterval) issue("assessmentWindow", "missing", "Assessment window must be valid, ordered ISO8601 timestamps.");
  const targetSpecified = input.targetPathogens.length > 0;
  if (!targetSpecified) issue("targetPathogens", "missing", "Target pathogens are unspecified; pathogen-specific applicability remains UNKNOWN.");
  const target = (pathogen: TilapiaPathogen) => input.targetPathogens.includes(pathogen);

  // Resolve professional IDs only against the trusted caller context. A raw form
  // cannot install records. The module installs no production adapter itself.
  const records: ProfessionalRecord[] = [];
  for (const id of input.reviewRecordIds ?? []) {
    const candidates = (context?.professionalRecords ?? []).filter((record) => record.id === id);
    const record = candidates.length === 1 ? candidates[0] : undefined;
    if (!record) { issue(`reviewRecords.${id}`, "missing", "Professional record ID cannot be uniquely resolved."); continue; }
    const received = time(record.receivedAt); const signed = time(record.signedAt);
    const recordInterval = interval(record.window);
    if (![record.id, record.reviewerRef, record.sourceRef, record.version].every(text) || received === null || signed === null || signed > received || received > now || !recordInterval || recordInterval.end > now || (record.finding.kind !== "confirmed-event" && !contains(assessmentInterval, recordInterval)) || !sameScope(record.scope, input.scope) || !["verified-source", "fixture"].includes(record.origin)) {
      issue(`reviewRecords.${id}`, "invalid", "Professional provenance, scope, signature/version or window is invalid.");
      continue;
    }
    if (record.finding.kind === "confirmed-event" && !contains(assessmentInterval, recordInterval)) issue(`reviewRecords.${id}.window`, "unknown", "Historical professional confirmation is retained; its window is outside the current assessment and cannot be recomputed.", 12);
    records.push(record);
  }
  const clinicalReviews = records.filter((record) => record.finding.kind === "clinical-review");
  const confirmations = records.filter((record) => record.finding.kind === "confirmed-event" && target(record.finding.pathogen));

  const clinicalValid = validObservation(input.clinical, "clinical", "clinical");
  const mortalityValid = validObservation(input.mortality, "mortality", "mortality");
  const oxygenValid = validObservation(input.dissolvedOxygen, "dissolvedOxygen", "oxygen");
  const vaccinationValid = validObservation(input.vaccination, "vaccination", "vaccination");
  if (input.waterTemperature) validObservation(input.waterTemperature, "waterTemperature", "temperature");
  const labStatus = new Map<string, "valid" | "invalid" | "unknown">();
  const labMeta = new Map<string, boolean>();
  for (const record of input.laboratory) {
    const field = `laboratory.${record.id}`;
    const valid = validObservation(record, field, "laboratory");
    labMeta.set(record.id, valid);
    const value = record.value;
    let state: "valid" | "invalid" | "unknown" = "unknown";
    if (record.quality === "invalid" || value?.controlsPassed === "no" || value?.result === "invalid") {
      state = "invalid"; issue(`${field}.controlsPassed`, "invalid", "Only this detection is excluded because its quality or controls failed.", 14);
      addEvent(14, "invalid_detection", "Invalid laboratory finding", "Raw result is retained; this finding cannot support a positive or negative branch.", [record.id], value?.pathogen ?? null);
    } else if (valid && value && text(value.sampleId) && text(value.assayId) && ["SAG", "SIN"].includes(value.pathogen) && ["fish_tissue", "environment"].includes(value.matrix) && ["positive", "negative"].includes(value.result) && value.controlsPassed === "yes") {
      state = "valid";
    } else {
      const code = value?.result === "not_tested" ? "not_tested" : value?.result === "inconclusive" ? "inconclusive" : "unknown";
      issue(field, code, "A valid test requires sample/method identity, metadata, passed controls and a determinate result.", 14);
    }
    labStatus.set(record.id, state);
  }
  if (!input.laboratory.length) issue("laboratory", "missing", "No laboratory observations were supplied.");

  // Conflicting results are compared only for one sample/target and overlapping
  // actual observation windows. Different targets or serial results are distinct.
  for (let i = 0; i < input.laboratory.length; i++) {
    for (let j = i + 1; j < input.laboratory.length; j++) {
      const left = input.laboratory[i]; const right = input.laboratory[j];
      const a = left.value; const b = right.value;
      if (labStatus.get(left.id) === "valid" && labStatus.get(right.id) === "valid" && a && b && sameScope(left.scope, right.scope) && a.sampleId === b.sampleId && a.pathogen === b.pathogen && a.matrix === b.matrix && a.result !== b.result && overlaps(observationInterval(left), observationInterval(right))) {
        automaticConflicts.push({ id: `auto:pathogen_result:${[left.id, right.id].sort().join(":")}`, observationIds: [left.id, right.id], kind: "pathogen_result" });
      }
    }
  }
  const allConflicts = [...(input.conflicts ?? []), ...automaticConflicts];
  function resolved(conflict: EvidenceConflict) {
    return records.some((record) => record.finding.kind === "conflict-resolution" && (!conflict.resolutionRecordId || record.id === conflict.resolutionRecordId) && record.finding.conflictIds.includes(conflict.id) && conflict.observationIds.length > 0 && conflict.observationIds.every((id) => record.finding.kind === "conflict-resolution" && record.finding.evidenceObservationIds.includes(id)));
  }
  let unresolved = allConflicts.filter((conflict) => !resolved(conflict));
  const conflictedIds = new Set(unresolved.flatMap((conflict) => [...conflict.observationIds]));
  const unconflicted = (record: Observation | undefined) => !!record && !conflictedIds.has(record.id);
  const clinicalUsable = clinicalValid && unconflicted(input.clinical);
  const mortality = input.mortality?.value;
  const mortalityWindow = interval(mortality?.window);
  const mortalityObservedAt = time(input.mortality?.observedAt);
  const mortalityWindowValid = mortalityValid && contains(assessmentInterval, mortalityWindow) && mortalityObservedAt !== null && mortalityWindow!.start <= mortalityObservedAt && mortalityWindow!.end <= mortalityObservedAt;
  const mortalityUsable = mortalityWindowValid && unconflicted(input.mortality);
  const oxygenUsable = oxygenValid && unconflicted(input.dissolvedOxygen);
  const vaccinationUsable = vaccinationValid && unconflicted(input.vaccination);
  function fish(pathogen: TilapiaPathogen, finding: "positive" | "negative") {
    return input.laboratory.filter((record) => {
      const value = record.value;
      return value && value.pathogen === pathogen && target(pathogen) && value.matrix === "fish_tissue" && value.result === finding && value.matrixValidated === "yes" && labStatus.get(record.id) === "valid" && !conflictedIds.has(record.id);
    });
  }
  function anyFish(pathogen: TilapiaPathogen, finding: "positive" | "negative"): TilapiaRuleTruth {
    if (!target(pathogen)) return targetSpecified ? false : "unknown";
    if (fish(pathogen, finding).length) return true;
    const candidates = input.laboratory.filter((record) => record.value?.pathogen === pathogen && record.value.matrix === "fish_tissue");
    if (!candidates.length || candidates.some((record) => labStatus.get(record.id) !== "valid" || record.value?.matrixValidated !== "yes" || conflictedIds.has(record.id))) return "unknown";
    return false;
  }
  const pathogens = (["SAG", "SIN"] as const).filter(target);

  // 002: only a source-proven complete water-temperature window, never a point.
  const temperatureResults: TilapiaRuleTruth[] = [];
  const high = parameters?.highTemperature;
  if (!targetSpecified) temperatureResults.push("unknown");
  else if (!target("SAG")) temperatureResults.push(false);
  else if (!high || !finite(high.thresholdC) || !finite(high.minimumDurationHours) || high.minimumDurationHours <= 0) {
    issue("draftPreview.highTemperature", "missing", "No approved/default P01 is adopted; explicit preview threshold and duration are required.", 2);
    temperatureResults.push("unknown");
  } else {
    for (const record of input.temperatureWindows ?? []) {
      const valid = validObservation(record, `temperatureWindows.${record.id}`, "temperature");
      const value = record.value; const span = interval(value?.window);
      if (!valid || !unconflicted(record) || !value || !span || !contains(assessmentInterval, span) || time(record.observedAt) !== span.end || !Number.isInteger(value.sampleCount) || value.sampleCount <= 1 || value.coverage !== "complete" || !text(value.coverageRecordRef) || !finite(value.minimumWaterTemperatureC)) {
        issue(`temperatureWindows.${record.id}`, "unknown", "A source-proven complete, same-scope temperature window is required.", 2);
        temperatureResults.push("unknown");
      } else {
        temperatureResults.push(value.minimumWaterTemperatureC >= high.thresholdC && (span.end - span.start) / 3_600_000 >= high.minimumDurationHours);
      }
    }
    if (!temperatureResults.length) { temperatureResults.push("unknown"); issue("temperatureWindows", "missing", "A point reading cannot prove continuous exposure.", 2); }
  }
  const highTruth = or(...temperatureResults);
  finish(2, highTruth, [highTruth === true ? "Explicit preview temperature and duration are both met by a complete source window." : highTruth === false ? "SAG is outside the target or the complete measured window does not meet the explicit preview condition." : "Temperature coverage or explicit P01 preview parameters are incomplete."], (input.temperatureWindows ?? []).map((record) => record.id));
  if (highTruth === true) addEvent(2, "environment_attention", "SAG environmental attention", "Draft simulation: complete water-temperature exposure meets the explicit candidate; this is not a disease probability.", (input.temperatureWindows ?? []).map((record) => record.id), "SAG");

  // 003: confirmed respiratory distress is independent of numeric DO/duration.
  const respiratory = or(...clinicalReviews.map((record) => record.finding.kind === "clinical-review" ? truth(record.finding.respiratoryDistress) : "unknown"));
  const oxygenLimit = parameters?.lowDissolvedOxygen?.belowMgL;
  let lowOxygen: TilapiaRuleTruth = "unknown";
  if (oxygenUsable && finite(input.dissolvedOxygen?.value) && input.dissolvedOxygen.value >= 0 && finite(oxygenLimit) && oxygenLimit >= 0) lowOxygen = input.dissolvedOxygen.value < oxygenLimit;
  else if (respiratory !== true) issue("draftPreview.lowDissolvedOxygen", "missing", "Numeric DO requires an explicit management limit; no P03 value is invented.", 3);
  const emergency = or(lowOxygen, respiratory);
  finish(3, emergency, [emergency === true ? "Low oxygen or an attributable professional respiratory-distress record supports immediate water-quality response; no duration is required." : "DO limit/evidence or professional respiratory review is incomplete."], [...(input.dissolvedOxygen ? [input.dissolvedOxygen.id] : []), ...clinicalReviews.map((record) => record.id)]);
  if (emergency === true) {
    addEvent(3, "water_quality_emergency", "Immediate water-quality response", "Respond to water-quality danger now; retain disease investigation separately. No SIN disease causality is inferred.", [...(input.dissolvedOxygen ? [input.dissolvedOxygen.id] : []), ...clinicalReviews.map((record) => record.id)]);
    actions.add("Immediately check aeration and water quality and seek qualified assistance.");
  } else if (clinicalUsable && input.clinical?.value?.respiratoryDistressObserved === "yes") actions.add("Observed respiratory distress: immediately remeasure water quality and seek professional assistance; professional confirmation is unavailable.");

  // 007: detection survives unknown clinical state, without creating confirmation.
  const asymptomatic: TilapiaRuleTruth[] = [];
  for (const pathogen of pathogens) {
    const positive = fish(pathogen, "positive");
    let noSigns: TilapiaRuleTruth = clinicalUsable ? truth(input.clinical?.value?.signsPresent) : "unknown";
    noSigns = noSigns === "unknown" ? "unknown" : !noSigns;
    let aligned: TilapiaRuleTruth = positive.length && clinicalUsable ? positive.some((record) => overlaps(observationInterval(record), observationInterval(input.clinical))) : "unknown";
    if (positive.length && clinicalUsable && aligned === false) {
      issue(`clinical.observationWindow`, "rule_conflict", "Clinical and laboratory observations do not overlap; the assessment window is not a matching tolerance.", 7);
      aligned = "unknown";
    }
    asymptomatic.push(and(anyFish(pathogen, "positive"), noSigns, aligned));
    for (const record of positive) addEvent(7, "pathogen_detection", `${pathogen} fish-tissue detection`, noSigns === true && aligned === true ? "Valid fish-tissue detection with an explicitly negative clinical inspection; not clinical confirmation." : "Valid fish-tissue detection is retained; clinical compatibility or timing requires separate review.", [record.id], pathogen);
  }
  finish(7, or(...asymptomatic), ["Requires independently valid fish-tissue positivity plus an overlapping explicit no-signs inspection; detection itself is retained separately."], input.laboratory.filter((record) => record.value?.matrix === "fish_tissue").map((record) => record.id));

  // 008: unvalidated environmental matrices remain research evidence only.
  const environmental: TilapiaRuleTruth[] = [];
  for (const record of input.laboratory.filter((record) => record.value?.matrix === "environment" && target(record.value.pathogen))) {
    const value = record.value!;
    if (labStatus.get(record.id) !== "valid" || conflictedIds.has(record.id)) { environmental.push("unknown"); continue; }
    if (value.result === "negative") { environmental.push(false); continue; }
    const matrix = truth(value.matrixValidated); environmental.push(matrix);
    addEvent(8, matrix === true ? "environmental_clue" : "environmental_research", matrix === true ? "Environmental DNA clue" : "Environmental research result", matrix === true ? "Matrix-validated environmental DNA clue; it does not confirm infection in fish." : "Environmental matrix is unvalidated or unknown; retain as a research result, not a fish infection finding.", [record.id], value.pathogen);
    if (matrix === "unknown") issue(`laboratory.${record.id}.matrixValidated`, "unknown", "Environmental matrix validation is unknown.", 8);
  }
  finish(8, or(...environmental), ["Environmental findings require separate matrix validation and never establish fish infection."], input.laboratory.filter((record) => record.value?.matrix === "environment").map((record) => record.id));

  // 011: a source-backed report is independent of an unavailable rate/baseline.
  const reported: TilapiaRuleTruth = mortalityUsable ? truth(mortality?.abnormalityReported) : "unknown";
  if (mortalityValid && mortality) {
    if (!mortalityWindowValid) {
      issue("mortality.window", "rule_conflict", "Mortality count window must be attributable to the current scope and assessment.", 11);
    } else if (mortalityUsable) {
      const dead = mortality.deadCount; const stock = mortality.stockStartCount;
      if (Number.isInteger(dead) && dead !== null && dead >= 0 && Number.isInteger(stock) && stock !== null && stock > 0 && dead <= stock) result.mortalityRate = dead / stock;
      else issue("mortality.stockStartCount", stock === null ? "missing" : "invalid", "Rate needs non-negative integer deaths and a positive same-batch denominator no smaller than the death count.", 11);
    }
  }
  finish(11, reported, ["A source-backed abnormal mortality report triggers investigation; no P11 numeric baseline is invented."], input.mortality ? [input.mortality.id] : []);
  if (reported === true) addEvent(11, "mortality_investigation", "Investigate abnormal mortality", "Retain the mortality event even when a valid denominator is unavailable; verify counts and cause.", [input.mortality!.id]);

  // 012: display existing records only; never manufacture a confirmation.
  const confirmationTruth: TilapiaRuleTruth[] = [];
  for (const record of confirmations) {
    if (record.finding.kind !== "confirmed-event") continue;
    const finding = record.finding;
    const linkedLabs = finding.laboratoryIds.map((id) => input.laboratory.find((item) => item.id === id));
    const linkedReviews = finding.clinicalReviewIds.map((id) => records.find((item) => item.id === id));
    const completeLabs = linkedLabs.length > 0 && linkedLabs.every((item) => item && fish(finding.pathogen, "positive").includes(item) && contains(interval(record.window), observationInterval(item)) && time(item.observedAt)! <= time(record.signedAt)! && time(item.receivedAt)! <= time(record.receivedAt)!);
    const completeReview = linkedReviews.length > 0 && linkedReviews.every((item) => item && item.finding.kind === "clinical-review" && item.finding.compatibleClinicalOrPathology === "yes" && item.finding.differentialReviewed === "yes" && contains(interval(record.window), interval(item.window)) && time(item.signedAt)! <= time(record.signedAt)! && time(item.receivedAt)! <= time(record.receivedAt)!);
    const ids = [...finding.laboratoryIds, ...finding.clinicalReviewIds];
    const conflict = unresolved.some((item) => item.observationIds.some((id) => ids.includes(id)));
    const chain = contains(assessmentInterval, interval(record.window)) && completeLabs && completeReview && !conflict;
    confirmationTruth.push(chain ? true : "unknown");
    addEvent(12, "confirmed_event", "Existing professional confirmation", chain ? "The existing professional record has a complete attributable evidence chain in this preview; this engine did not create the diagnosis." : "Existing professional record retained; current evidence cannot recompute its chain. Missing or conflicting data do not erase that historical record.", [record.id, ...ids], finding.pathogen, { recordId: record.id, evidenceStatus: chain ? "verified_chain" : "not_recomputed" });
  }
  finish(12, or(...confirmationTruth), [confirmations.length ? "Existing professional records are retained separately from evidence-chain recomputation." : "No attributable existing professional confirmation record is available; detection cannot create one."], confirmations.map((record) => record.id));

  finish(14, input.laboratory.length ? or(...input.laboratory.map((record) => labStatus.get(record.id) === "invalid" ? true : labStatus.get(record.id) === "valid" ? false : "unknown")) : "unknown", ["QC is evaluated per laboratory observation; an invalid detection never suppresses independent valid findings."], input.laboratory.filter((record) => labStatus.get(record.id) !== "valid").map((record) => record.id));

  // 015: negative evidence does not clear ongoing abnormalities.
  const persistent: TilapiaRuleTruth[] = [];
  for (const pathogen of pathogens) {
    const negatives = fish(pathogen, "negative");
    // Keep the abnormality flag paired with its own valid observation/window.
    // A different record cannot supply the time match for an earlier abnormality.
    const pairedPersistence = negatives.map((record) => or(
      clinicalUsable ? and(truth(input.clinical?.value?.persistentAbnormality), overlaps(observationInterval(record), observationInterval(input.clinical)) ? true : "unknown") : "unknown",
      mortalityUsable ? and(truth(mortality?.abnormalityPersistent), overlaps(observationInterval(record), mortalityWindow) ? true : "unknown") : "unknown",
    ));
    const state = and(anyFish(pathogen, "negative"), or(...pairedPersistence));
    persistent.push(state);
    if (state === true) addEvent(15, "suspected_case", "Persistent abnormality despite negative test", "Retain suspected or unexplained disease investigation and obtain qualified repeat sampling/differentials; no default sampling interval is set.", negatives.map((record) => record.id), pathogen);
  }
  finish(15, or(...persistent), ["An attributable negative finding with ongoing abnormality prompts repeat investigation, never automatic clearance."], input.laboratory.filter((record) => record.value?.result === "negative").map((record) => record.id));

  // 016: sequence type is an independent qualified finding, not serotype III.
  const typingStates: TilapiaRuleTruth[] = [];
  for (const record of fish("SAG", "positive")) {
    const typing = record.value?.typing;
    if (!typing || typing.quality !== "valid" || !text(typing.sequenceType) || !text(typing.schemeId) || !text(typing.sourceRef)) {
      typingStates.push("unknown"); issue(`laboratory.${record.id}.typing`, "unknown", "Serotype III is not ST283; independent sequence type, scheme, source and typing QC are required.", 16);
    } else {
      const is283 = typing.sequenceType === "283"; typingStates.push(is283);
      if (is283) addEvent(16, "public_health_communication", "ST283 communication task", "Reliable SAG ST283 typing supports a public-health risk communication task; no human infection is inferred.", [record.id], "SAG");
    }
  }
  finish(16, target("SAG") ? and(anyFish("SAG", "positive"), or(...typingStates)) : targetSpecified ? false : "unknown", ["Only reliable ST283 on the same qualified SAG finding supports this task; generic SAG or serotype III is insufficient."], fish("SAG", "positive").map((record) => record.id));

  // 018: immunity never removes an independent abnormal-case investigation.
  const vaccinated: TilapiaRuleTruth = vaccinationUsable ? input.vaccination?.value?.status === "vaccinated" ? true : input.vaccination?.value?.status === "not_vaccinated" ? false : "unknown" : "unknown";
  const clinicalAbnormal = or(clinicalUsable ? truth(input.clinical?.value?.signsPresent) : "unknown", ...clinicalReviews.map((record) => record.finding.kind === "clinical-review" ? truth(record.finding.compatibleClinicalOrPathology) : "unknown"), confirmations.length > 0 ? true : "unknown");
  let vaccinationAligned: TilapiaRuleTruth = "unknown";
  if (vaccinationUsable && input.vaccination) {
    const administered = time(input.vaccination.value?.administeredAt);
    const abnormalTimes = [
      ...(clinicalUsable && input.clinical?.value?.signsPresent === "yes" ? [time(input.clinical.observedAt)!] : []),
      ...clinicalReviews.filter((record) => record.finding.kind === "clinical-review" && record.finding.compatibleClinicalOrPathology === "yes").map((record) => time(record.signedAt)!),
      ...confirmations.map((record) => time(record.signedAt)!),
    ];
    if (administered !== null && administered <= now && administered <= time(input.vaccination.observedAt)! && abnormalTimes.length > 0 && administered <= Math.min(...abnormalTimes) && text(input.vaccination.value?.productRef)) vaccinationAligned = true;
    else issue("vaccination.administeredAt", "unknown", "Vaccination provenance requires product and a valid non-future administration time.", 18);
  }
  const vaccineReview = and(vaccinated, clinicalAbnormal, vaccinationAligned);
  finish(18, vaccineReview, ["A valid vaccination record and abnormal clinical/professional evidence still require product, regimen and coverage review."], input.vaccination ? [input.vaccination.id] : []);
  if (vaccineReview === true) addEvent(18, "vaccination_review", "Review disease after vaccination", "Investigate the case and verify vaccine product, regimen and actual coverage; neither protection nor vaccine failure is inferred.", [input.vaccination!.id]);

  // 021: country centroids never enter the local exposure branch.
  const regionalStates: TilapiaRuleTruth[] = [];
  for (const record of input.regionalEvents ?? []) {
    const value = record.value;
    if (!value || value.pathogen === "unknown" || !target(value.pathogen)) continue;
    if (value.locationPrecision === "country_centroid") {
      if (validObservation(record, `regionalEvents.${record.id}`, "regionalEvent", true) && unconflicted(record)) addEvent(21, "regional_background", "Regional background only", "Country-centroid event is regional context; it does not establish local exposure, infection, or absence.", [record.id], value.pathogen);
      regionalStates.push("unknown"); continue;
    }
    const valid = validObservation(record, `regionalEvents.${record.id}`, "regionalEvent");
    const span = interval(value.eventWindow); const validityHours = parameters?.regionalEventValidityHours;
    let matchingTime: TilapiaRuleTruth = "unknown";
    if (finite(validityHours) && validityHours >= 0 && span && span.end <= now && overlaps(span, assessmentInterval)) matchingTime = now - span.end <= validityHours * 3_600_000;
    else issue(`regionalEvents.${record.id}.eventWindow`, "unknown", "A valid actual event window and explicit P09 preview validity are required.", 21);
    const contact: TilapiaRuleTruth = value.contact.path !== "unknown" && text(value.contact.recordRef) ? truth(value.contact.verified) : "unknown";
    const state = and(valid && unconflicted(record) ? true : "unknown", truth(value.eventVerified), contact, matchingTime, value.locationPrecision === "site" || value.locationPrecision === "unit" ? true : "unknown");
    regionalStates.push(state);
    if (state === true) addEvent(21, "targeted_surveillance", "Targeted monitoring for linked event", "Same-pathogen, verified contact and explicit actual time window support targeted monitoring; this is not local infection confirmation.", [record.id], value.pathogen);
  }
  finish(21, or(...regionalStates), ["Only verified same-pathogen contact with an explicit event validity window supports targeted monitoring; no report is UNKNOWN."], (input.regionalEvents ?? []).map((record) => record.id));

  // Late metadata checks (temperature and regional branches) may add conflicts.
  unresolved = [...(input.conflicts ?? []), ...automaticConflicts].filter((conflict) => !resolved(conflict));
  // Late combination conflicts stay independent; never use a majority vote.
  const combinationConflict = issues.filter((value) => value.code === "rule_conflict" && value.ruleId === ruleId(7));
  finish(22, unresolved.length > 0 || combinationConflict.length > 0, [unresolved.length ? "Unresolved evidence identity/result/time conflicts require review; records were not overwritten or outvoted." : "No unresolved attributable conflict was detected; this is not proof that missing evidence agrees."], unresolved.flatMap((conflict) => [...conflict.observationIds]));
  for (const conflict of unresolved) addEvent(22, "evidence_conflict", "Evidence requires review", `${conflict.id}: ${conflict.kind}; preserve each original finding and resolve through a linked professional record.`, conflict.observationIds);
  for (const conflict of combinationConflict) addEvent(22, "evidence_conflict", "Evidence time alignment requires review", conflict.message, input.clinical ? [input.clinical.id] : []);

  // 020 is evaluated after other dependencies so all local UNKNOWNs stay visible.
  const incomplete = issues.length > 0;
  finish(20, incomplete, [incomplete ? "Missing, invalid, stale or unresolved branch dependencies are listed individually; other events remain present." : "All dependencies used by supported branches have valid explicit evidence."], []);
  if (incomplete) addEvent(20, "data_quality", "Data quality and missing evidence", "Review specific missing, stale, invalid and ambiguous fields; this notice does not erase other events.");
  for (const item of ruleTraces.filter((item) => item.execution === "evaluated" && item.truth === null)) {
    item.truth = "unknown"; item.state = "insufficient_data"; item.reasons = ["No determinate supported branch could be evaluated."];
  }
  result.quality.observedFields = [...observed]; result.quality.expectedFields = [...expected];
  result.quality.state = observed.size === 0 ? "insufficient_data" : incomplete ? "partial" : "complete";
  result.minimumAttention = events.some((event) => event.type === "water_quality_emergency") ? "urgent" : events.some((event) => !["data_quality", "regional_background"].includes(event.type)) ? "review" : "none";
  for (const event of events) if (!["data_quality", "regional_background"].includes(event.type)) actions.add(event.explanation);
  result.actions = [...actions];
  return result;
}

/** Synthetic fixture input. Calling this does not opt into draft rule execution. */
export function createExampleTilapiaInput(): TilapiaAssessmentInput {
  const scope = { siteId: "fixture-site", unitId: "fixture-unit", batchId: "fixture-batch" };
  const at = "2026-10-28T11:00:00Z";
  return {
    scope, assessmentWindow: { startAt: "2026-10-27T12:00:00Z", endAt: "2026-10-28T12:00:00Z" }, targetPathogens: ["SAG", "SIN"],
    laboratory: [{ id: "fixture-lab-sag", scope: { ...scope }, observedAt: at, receivedAt: at, quality: "valid", sourceRef: "fixture-laboratory-report", value: { sampleId: "fixture-sample", pathogen: "SAG", matrix: "fish_tissue", assayId: "fixture-assay", result: "positive", controlsPassed: "yes", matrixValidated: "yes" } }],
    clinical: { id: "fixture-clinical", scope: { ...scope }, observedAt: at, receivedAt: at, quality: "valid", sourceRef: "fixture-inspection", value: { signsPresent: "yes", persistentAbnormality: "yes", respiratoryDistressObserved: "yes" } },
  };
}

/** Explicit Draft simulation packet; these records are fixtures, never signatures. */
export function createTilapiaDraftExamplePacket(): { input: TilapiaAssessmentInput; context: TilapiaAssessmentContext } {
  const input = createExampleTilapiaInput();
  const shared = { origin: "fixture" as const, scope: { ...input.scope! }, window: { ...input.assessmentWindow! }, receivedAt: "2026-10-28T12:00:00Z", reviewerRef: "fixture-reviewer", signedAt: "2026-10-28T12:00:00Z", sourceRef: "fixture-professional-record", version: "fixture-v1" };
  const records: ProfessionalRecord[] = [
    { ...shared, id: "fixture-review", finding: { kind: "clinical-review", respiratoryDistress: "yes", compatibleClinicalOrPathology: "yes", differentialReviewed: "yes" } },
    { ...shared, id: "fixture-confirmation", finding: { kind: "confirmed-event", pathogen: "SAG", laboratoryIds: ["fixture-lab-sag"], clinicalReviewIds: ["fixture-review"] } },
  ];
  input.reviewRecordIds = records.map((record) => record.id);
  return { input, context: { now: "2026-10-28T12:00:00Z", dataMode: "draft-preview", draftPreview: { label: "Draft simulation" }, professionalRecords: records } };
}
