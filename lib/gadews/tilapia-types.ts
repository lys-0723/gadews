import type { AssessmentContext, AssessmentResult } from "./warning-assessment";

export type TilapiaPathogen = "SAG" | "SIN";
export type Truth = "yes" | "no" | "unknown";
export type InputQuality = "valid" | "invalid" | "stale" | "missing";
export type LabResult = "positive" | "negative" | "inconclusive" | "invalid" | "not_tested";
export interface MonitoringScope { siteId: string; unitId: string; batchId: string; }
export interface TimeWindow { startAt: string; endAt: string; }

export interface TilapiaObservation<T> {
  id: string;
  scope: MonitoringScope | null;
  observedAt: string | null;
  observationWindow?: TimeWindow;
  receivedAt: string | null;
  quality: InputQuality;
  sourceRef: string | null;
  value: T | null;
}

export interface LabFinding {
  sampleId: string;
  pathogen: TilapiaPathogen;
  matrix: "fish_tissue" | "environment";
  assayId: string;
  result: LabResult;
  controlsPassed: Truth;
  matrixValidated: Truth;
  typing?: {
    serotype: string | null;
    sequenceType: string | null;
    schemeId: string | null;
    quality: InputQuality;
    sourceRef: string | null;
  };
}

export interface TemperatureWindow {
  window: TimeWindow;
  minimumWaterTemperatureC: number;
  sampleCount: number;
  coverage: "complete" | "gapped" | "unknown";
  coverageRecordRef: string | null;
}

export interface RegionalEvent {
  eventId: string;
  pathogen: TilapiaPathogen | "unknown";
  eventWindow: TimeWindow | null;
  locationPrecision: "unit" | "site" | "country_centroid" | "unknown";
  eventVerified: Truth;
  contact: {
    path: "water_flow" | "stock_source" | "equipment" | "other" | "unknown";
    verified: Truth;
    recordRef: string | null;
  };
}

export interface EvidenceConflict {
  id: string;
  observationIds: readonly string[];
  kind: "sample_identity" | "pathogen_result" | "time_alignment" | "other";
  resolutionRecordId?: string;
}

export interface TilapiaAssessmentInput {
  scope: MonitoringScope | null;
  assessmentWindow: TimeWindow | null;
  targetPathogens: readonly TilapiaPathogen[];
  waterTemperature?: TilapiaObservation<number>;
  temperatureWindows?: readonly TilapiaObservation<TemperatureWindow>[];
  dissolvedOxygen?: TilapiaObservation<number>;
  clinical?: TilapiaObservation<{
    signsPresent: Truth;
    persistentAbnormality: Truth;
    respiratoryDistressObserved: Truth;
  }>;
  mortality?: TilapiaObservation<{
    window: TimeWindow;
    deadCount: number | null;
    stockStartCount: number | null;
    abnormalityReported: Truth;
    abnormalityPersistent: Truth;
  }>;
  laboratory: readonly TilapiaObservation<LabFinding>[];
  vaccination?: TilapiaObservation<{
    status: "vaccinated" | "not_vaccinated" | "unknown";
    productRef: string | null;
    administeredAt: string | null;
    coveredPathogens: readonly TilapiaPathogen[] | null;
  }>;
  regionalEvents?: readonly TilapiaObservation<RegionalEvent>[];
  reviewRecordIds?: readonly string[];
  conflicts?: readonly EvidenceConflict[];
}

export interface ProfessionalRecord {
  id: string;
  origin: "verified-source" | "fixture";
  scope: MonitoringScope;
  window: TimeWindow;
  receivedAt: string;
  reviewerRef: string;
  signedAt: string;
  sourceRef: string;
  version: string;
  finding:
    | { kind: "clinical-review"; respiratoryDistress: Truth; compatibleClinicalOrPathology: Truth; differentialReviewed: Truth }
    | { kind: "confirmed-event"; pathogen: TilapiaPathogen; laboratoryIds: readonly string[]; clinicalReviewIds: readonly string[] }
    | { kind: "conflict-resolution"; conflictIds: readonly string[]; evidenceObservationIds: readonly string[] };
}

export interface TilapiaPreviewParameters {
  label: "Draft simulation";
  highTemperature?: { thresholdC: number; minimumDurationHours: number };
  lowDissolvedOxygen?: { belowMgL: number };
  regionalEventValidityHours?: number;
  maxAgeHours?: Partial<Record<"temperature" | "oxygen" | "clinical" | "mortality" | "laboratory" | "vaccination" | "regionalEvent", number>>;
}

export type TilapiaAssessmentContext = Omit<AssessmentContext, "dataMode" | "observations"> & {
  professionalRecords?: readonly ProfessionalRecord[];
} & (
  | { dataMode?: "manual" | "example"; draftPreview?: never }
  | { dataMode: "draft-preview"; draftPreview: TilapiaPreviewParameters }
);

export interface KnowledgeSourceRef { sheet: string; row: number; }
export interface KnowledgeRule {
  id: string;
  name: string;
  pathogenIds: string[];
  triggerIds: string[];
  evidenceIds: string[];
  sourceIds: string[];
  parameterIds: string[];
  logic: string;
  executionSupport: "deterministic" | "unsupported";
  enablement: "draft_disabled";
  sourceRefs: KnowledgeSourceRef[];
  original?: unknown;
}
export interface KnowledgeParameter {
  id: string;
  relatedIds: string[];
  candidateValue: string | number | null;
  candidateDurationHours: string | number | null;
  adoptedValue: string | number | null;
  signedBy: string | null;
  signedAt: string | null;
  sourceRefs: KnowledgeSourceRef[];
  original?: unknown;
}
export interface KnowledgeTable {
  name: string;
  headers: Record<string, string>;
  rows: { row: number; cells: Record<string, unknown>; hyperlinks: Record<string, string> }[];
}
export interface KnowledgeResource {
  schemaVersion: "1.0";
  resourceId: string;
  source: { workbookName: string; sha256: string; bytes: number };
  rules: KnowledgeRule[];
  triggers: unknown[];
  parameters: KnowledgeParameter[];
  evidence: unknown[];
  sources: unknown[];
  validationCases: unknown[];
  tables: KnowledgeTable[];
}

export type TilapiaRuleTruth = boolean | "unknown";
export interface TilapiaRuleTrace {
  ruleId: string;
  name: string;
  support: "deterministic" | "unsupported";
  enablement: "draft_disabled";
  execution: "evaluated" | "disabled" | "unsupported";
  state: "active" | "inactive" | "unsupported" | "insufficient_data" | "matched" | "not_matched";
  truth: TilapiaRuleTruth | null;
  reasons: string[];
  evidenceIds: string[];
  sourceRefs: KnowledgeSourceRef[];
}
export type TilapiaEventType =
  | "environment_attention" | "water_quality_emergency" | "pathogen_detection"
  | "environmental_clue" | "environmental_research" | "mortality_investigation"
  | "confirmed_event" | "invalid_detection" | "suspected_case"
  | "public_health_communication" | "vaccination_review" | "data_quality"
  | "regional_background" | "targeted_surveillance" | "evidence_conflict";
export interface TilapiaEvent {
  id: string;
  type: TilapiaEventType;
  ruleId: string;
  label: string;
  explanation: string;
  pathogen: TilapiaPathogen | null;
  evidenceIds: string[];
  recordId?: string;
  evidenceStatus?: "verified_chain" | "not_recomputed";
  simulation: true;
  sourceRefs: KnowledgeSourceRef[];
}
export interface TilapiaAssessmentResult extends AssessmentResult {
  diseaseId: "tilapia-streptococcosis";
  ruleTraces: TilapiaRuleTrace[];
  events: TilapiaEvent[];
  /** Fraction in [0,1], never a fabricated percentage or an abnormality cutoff. */
  mortalityRate: number | null;
}
