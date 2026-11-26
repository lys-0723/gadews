import type { InputQuality, LabFinding, LabResult, TilapiaAssessmentInput, TilapiaObservation, TilapiaPathogen, Truth } from "@/lib/gadews/tilapia-types";
import type { QualityIssue } from "@/lib/gadews/warning-assessment";

export interface ObservationDraft {
  id: string;
  observedAt: string;
  receivedAt: string;
  sourceRef: string;
  quality: InputQuality | "";
}
export interface LaboratoryDraft extends ObservationDraft {
  sampleId: string;
  pathogen: TilapiaPathogen | "";
  matrix: LabFinding["matrix"] | "";
  assayId: string;
  result: LabResult | "";
  controlsPassed: Truth;
  matrixValidated: Truth;
}
export interface TilapiaFormState {
  siteId: string;
  unitId: string;
  batchId: string;
  assessmentWindow: { startAt: string; endAt: string };
  targetPathogens: TilapiaPathogen[];
  waterTemperature: ObservationDraft & { value: string };
  dissolvedOxygen: ObservationDraft & { value: string };
  clinical: ObservationDraft & { signsPresent: Truth; persistentAbnormality: Truth; respiratoryDistressObserved: Truth };
  mortality: ObservationDraft & { deadCount: string; stockStartCount: string; startAt: string; endAt: string; abnormalityReported: Truth; abnormalityPersistent: Truth };
  laboratory: LaboratoryDraft[];
}
const metadata = (id: string): ObservationDraft => ({ id, observedAt: "", receivedAt: "", sourceRef: "", quality: "" });
export function createTilapiaLabRow(id: string): LaboratoryDraft {
  return { ...metadata(id), sampleId: "", pathogen: "", matrix: "", assayId: "", result: "", controlsPassed: "unknown", matrixValidated: "unknown" };
}
export function createEmptyTilapiaForm(): TilapiaFormState {
  return {
    siteId: "", unitId: "", batchId: "", assessmentWindow: { startAt: "", endAt: "" }, targetPathogens: [],
    waterTemperature: { ...metadata("manual-temperature"), value: "" },
    dissolvedOxygen: { ...metadata("manual-oxygen"), value: "" },
    clinical: { ...metadata("manual-clinical"), signsPresent: "unknown", persistentAbnormality: "unknown", respiratoryDistressObserved: "unknown" },
    mortality: { ...metadata("manual-mortality"), deadCount: "", stockStartCount: "", startAt: "", endAt: "", abnormalityReported: "unknown", abnormalityPersistent: "unknown" },
    laboratory: [],
  };
}
const nullable = (value: string) => value.trim() ? value : null;
const number = (value: string) => !value.trim() ? null : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) ? Number(value) : NaN;
function hasRecord(draft: ObservationDraft, values: string[]) {
  return [draft.observedAt, draft.receivedAt, draft.sourceRef, draft.quality, ...values].some((value) => value !== "" && value !== "unknown");
}
function labComplete(row: LaboratoryDraft) {
  return !!row.sampleId.trim() && ["SAG", "SIN"].includes(row.pathogen) && ["fish_tissue", "environment"].includes(row.matrix)
    && !!row.assayId.trim() && ["positive", "negative", "inconclusive", "invalid", "not_tested"].includes(row.result);
}
export function tilapiaFormToInput(state: TilapiaFormState): TilapiaAssessmentInput {
  const scope = [state.siteId, state.unitId, state.batchId].some((value) => value.trim()) ? { siteId: state.siteId, unitId: state.unitId, batchId: state.batchId } : null;
  function observation<T>(draft: ObservationDraft, value: T | null): TilapiaObservation<T> {
    return { id: draft.id, scope: scope ? { ...scope } : null, observedAt: nullable(draft.observedAt), receivedAt: nullable(draft.receivedAt), sourceRef: nullable(draft.sourceRef), quality: draft.quality || "missing", value };
  }
  return {
    scope, assessmentWindow: state.assessmentWindow.startAt || state.assessmentWindow.endAt ? { ...state.assessmentWindow } : null,
    targetPathogens: [...state.targetPathogens],
    ...(hasRecord(state.waterTemperature, [state.waterTemperature.value]) ? { waterTemperature: observation(state.waterTemperature, number(state.waterTemperature.value)) } : {}),
    ...(hasRecord(state.dissolvedOxygen, [state.dissolvedOxygen.value]) ? { dissolvedOxygen: observation(state.dissolvedOxygen, number(state.dissolvedOxygen.value)) } : {}),
    ...(hasRecord(state.clinical, [state.clinical.signsPresent, state.clinical.persistentAbnormality, state.clinical.respiratoryDistressObserved]) ? { clinical: observation(state.clinical, { signsPresent: state.clinical.signsPresent, persistentAbnormality: state.clinical.persistentAbnormality, respiratoryDistressObserved: state.clinical.respiratoryDistressObserved }) } : {}),
    ...(hasRecord(state.mortality, [state.mortality.deadCount, state.mortality.stockStartCount, state.mortality.startAt, state.mortality.endAt, state.mortality.abnormalityReported, state.mortality.abnormalityPersistent]) ? { mortality: observation(state.mortality, { window: { startAt: state.mortality.startAt, endAt: state.mortality.endAt }, deadCount: number(state.mortality.deadCount), stockStartCount: number(state.mortality.stockStartCount), abnormalityReported: state.mortality.abnormalityReported, abnormalityPersistent: state.mortality.abnormalityPersistent }) } : {}),
    laboratory: state.laboratory.map((row) => {
      const complete = labComplete(row);
      const value: LabFinding | null = complete ? { sampleId: row.sampleId, pathogen: row.pathogen as TilapiaPathogen, matrix: row.matrix as LabFinding["matrix"], assayId: row.assayId, result: row.result as LabResult, controlsPassed: row.controlsPassed, matrixValidated: row.matrixValidated } : null;
      return { ...observation(row, value), ...(!complete ? { quality: "missing" as const } : {}) };
    }),
  };
}

function draftMetadata(record: TilapiaObservation<unknown>): ObservationDraft {
  return { id: record.id, observedAt: record.observedAt ?? "", receivedAt: record.receivedAt ?? "", sourceRef: record.sourceRef ?? "", quality: record.quality };
}
export function tilapiaExampleToForm(input: TilapiaAssessmentInput): TilapiaFormState {
  const form = createEmptyTilapiaForm();
  if (input.scope) Object.assign(form, input.scope);
  if (input.assessmentWindow) form.assessmentWindow = { ...input.assessmentWindow };
  form.targetPathogens = [...input.targetPathogens];
  for (const key of ["waterTemperature", "dissolvedOxygen"] as const) {
    const record = input[key]; if (record) form[key] = { ...draftMetadata(record), value: record.value === null ? "" : String(record.value) };
  }
  if (input.clinical) form.clinical = { ...form.clinical, ...draftMetadata(input.clinical), ...input.clinical.value };
  if (input.mortality) form.mortality = { ...form.mortality, ...draftMetadata(input.mortality), deadCount: input.mortality.value?.deadCount == null ? "" : String(input.mortality.value.deadCount), stockStartCount: input.mortality.value?.stockStartCount == null ? "" : String(input.mortality.value.stockStartCount), startAt: input.mortality.value?.window.startAt ?? "", endAt: input.mortality.value?.window.endAt ?? "", abnormalityReported: input.mortality.value?.abnormalityReported ?? "unknown", abnormalityPersistent: input.mortality.value?.abnormalityPersistent ?? "unknown" };
  form.laboratory = input.laboratory.map((record) => ({ ...createTilapiaLabRow(record.id), ...draftMetadata(record), ...(record.value ? { sampleId: record.value.sampleId, pathogen: record.value.pathogen, matrix: record.value.matrix, assayId: record.value.assayId, result: record.value.result, controlsPassed: record.value.controlsPassed, matrixValidated: record.value.matrixValidated } : {}) }));
  return form;
}

function validTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59 && (!offsetHour || Number(offsetHour) <= 23 && Number(offsetMinute) <= 59) && Number.isFinite(Date.parse(value));
}
/** Basic form checks only. These do not execute disabled knowledge rules. */
export function tilapiaFormIssues(state: TilapiaFormState): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const add = (field: string, code: QualityIssue["code"], message: string) => issues.push({ field, code, message: `Input check: ${message}` });
  function required(field: string, value: string) { if (!value.trim()) add(field, "missing", "Provide the actual value; none was supplied."); }
  function date(field: string, value: string, optional = false) {
    if (!value.trim()) { if (!optional) add(field, "missing", "Provide an ISO 8601 time including its timezone."); }
    else if (!validTime(value)) add(field, "invalid", "Use a valid ISO 8601 time with Z or a timezone offset; local time is not inferred.");
  }
  function window(field: string, start: string, end: string) {
    date(`${field}.startAt`, start); date(`${field}.endAt`, end);
    if (validTime(start) && validTime(end) && Date.parse(start) > Date.parse(end)) add(field, "invalid", "Start must not be after end.");
  }
  if (![state.siteId, state.unitId, state.batchId].every((value) => value.trim())) add("scope", "missing", "Site, unit and batch are all required to identify observations.");
  if (!state.assessmentWindow.startAt && !state.assessmentWindow.endAt) add("assessmentWindow", "missing", "Provide the actual assessment start and end.");
  else window("assessmentWindow", state.assessmentWindow.startAt, state.assessmentWindow.endAt);
  if (!state.targetPathogens.length) add("targetPathogens", "missing", "Select the pathogens being assessed.");
  function record(field: string, row: ObservationDraft) {
    date(`${field}.observedAt`, row.observedAt); date(`${field}.receivedAt`, row.receivedAt, true);
    required(`${field}.sourceRef`, row.sourceRef);
    if (!row.quality || row.quality === "missing") add(`${field}.quality`, "missing", "Observation quality has not been established.");
    else if (row.quality === "invalid" || row.quality === "stale") add(`${field}.quality`, row.quality, `Observation was marked ${row.quality}; it is not fresh valid evidence.`);
    else if (row.quality !== "valid") add(`${field}.quality`, "invalid", "Unknown quality value.");
  }
  function numeric(field: string, raw: string, kind: "finite" | "nonnegative" | "count" | "stock") {
    if (!raw.trim()) { add(field, "missing", "No measured number was supplied."); return; }
    const value = number(raw)!;
    if (!Number.isFinite(value) || (kind !== "finite" && value < 0) || ((kind === "count" || kind === "stock") && !Number.isInteger(value)) || kind === "stock" && value <= 0) add(field, "invalid", "Supply a finite measurement or a valid non-negative whole count; starting stock must be positive.");
  }
  const input = tilapiaFormToInput(state);
  for (const key of ["waterTemperature", "dissolvedOxygen"] as const) if (input[key]) { record(key, state[key]); numeric(`${key}.value`, state[key].value, key === "waterTemperature" ? "finite" : "nonnegative"); }
  if (input.clinical) {
    record("clinical", state.clinical);
    for (const key of ["signsPresent", "persistentAbnormality", "respiratoryDistressObserved"] as const) if (state.clinical[key] === "unknown") add(`clinical.${key}`, "unknown", "This clinical observation remains unknown; it is not a negative finding.");
  }
  if (input.mortality) {
    record("mortality", state.mortality); window("mortality.window", state.mortality.startAt, state.mortality.endAt);
    numeric("mortality.deadCount", state.mortality.deadCount, "count"); numeric("mortality.stockStartCount", state.mortality.stockStartCount, "stock");
    if (Number(state.mortality.deadCount) > Number(state.mortality.stockStartCount) && state.mortality.stockStartCount.trim()) add("mortality.deadCount", "invalid", "Deaths cannot exceed starting stock.");
  }
  for (const row of state.laboratory) {
    const field = `laboratory.${row.id}`; record(field, row);
    for (const key of ["sampleId", "pathogen", "matrix", "assayId", "result"] as const) required(`${field}.${key}`, row[key]);
    if (row.controlsPassed === "unknown") add(`${field}.controlsPassed`, "unknown", "Laboratory control status is unknown.");
    else if (row.controlsPassed === "no") add(`${field}.controlsPassed`, "invalid", "Laboratory controls failed.");
    if (row.matrixValidated === "unknown") add(`${field}.matrixValidated`, "unknown", "Validation for this sample matrix is unknown.");
    else if (row.matrixValidated === "no") add(`${field}.matrixValidated`, "invalid", "The assay is not validated for this matrix.");
    if (row.result === "inconclusive" || row.result === "invalid" || row.result === "not_tested") add(`${field}.result`, row.result, "Keep this laboratory status distinct from a negative finding.");
  }
  return issues;
}
