export type AssessmentStatus =
  | "complete" | "partial" | "insufficient_data"
  | "draft_disabled" | "draft_preview" | "not_configured";
export type AssessmentDataMode = "manual" | "example" | "draft-preview";
export type MinimumAttention = "none" | "review" | "high" | "urgent";
export type QualityIssueCode =
  | "missing" | "unknown" | "not_tested" | "inconclusive" | "invalid"
  | "stale" | "scope_mismatch" | "rule_conflict" | "rule_uncovered"
  | "ambiguous_legacy";

export interface QualityIssue {
  field: string;
  code: QualityIssueCode;
  message: string;
  ruleId?: string;
}

/** Scope describes the kind of observation, never an inferred pond/site identity. */
export interface ObservationMetadata {
  observedAt?: string | Date;
  maxAgeHours?: number;
  scope?: string;
}

export interface AssessmentContext {
  dataMode?: AssessmentDataMode;
  now?: string | Date;
  observations?: Record<string, ObservationMetadata>;
  inputProvenance?: Record<string, unknown>;
}

/** Copy caller-owned evidence; dates remain readable even when they are invalid. */
export function snapshotAssessmentRecord(value: object): Record<string, unknown> {
  function copy(item: unknown): unknown {
    if (item instanceof Date) return Number.isFinite(item.getTime()) ? item.toISOString() : { $date: "Invalid Date" };
    if (Array.isArray(item)) return item.map(copy);
    if (item !== null && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, copy(child)]));
    return item;
  }
  return copy(value) as Record<string, unknown>;
}

export interface AssessmentDriver {
  ruleId: string;
  label: string;
  explanation: string;
  score: number;
  sourceRefs: string[];
}

export interface AssessmentLevel {
  id: string;
  label: string;
  rank?: number;
}

export interface RuleEvaluation {
  ruleId: string;
  field: string;
  state: "matched" | "not_matched" | "rule_conflict" | "rule_uncovered";
  score: number | null;
  matchedOptions: string[];
  sourceRefs: string[];
}

export interface AssessmentResult {
  schemaVersion: "1.0";
  diseaseId: "wsd" | "tilapia-streptococcosis";
  dataMode: AssessmentDataMode;
  assessedAt: string;
  inputSnapshot: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  status: AssessmentStatus;
  model: {
    id: string;
    version: string;
    state: "prototype" | "draft_disabled" | "approved" | "not_configured";
    source: string[];
    warnings: string[];
  };
  quality: {
    state: "complete" | "partial" | "insufficient_data";
    observedFields: string[];
    expectedFields: string[];
    issues: QualityIssue[];
  };
  knownScore: number | null;
  maxScore: number | null;
  score: number | null;
  riskIndex: number | null;
  level: AssessmentLevel | null;
  minimumAttention: MinimumAttention;
  drivers: AssessmentDriver[];
  actions: string[];
  unsupportedRules: string[];
  prediction: {
    state: "not_configured";
    probability: null;
    horizonHours: null;
  };
  ruleEvaluations?: RuleEvaluation[];
}
