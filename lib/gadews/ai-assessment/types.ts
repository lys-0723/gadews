import type { AssessmentContext, AssessmentDataMode, AssessmentLevel, MinimumAttention, QualityIssue } from "../warning-assessment";
import type { TilapiaAssessmentInput } from "../tilapia-types";
import type { WsdWarningInput } from "../wsd-warning-model";

export interface ScoringBranch { id: string; label: string; score: number; condition: string; }
export interface ScoringItem {
  id: string; field: string; label: string; module: string; maxScore: number;
  branches: ScoringBranch[]; sourceRefs: string[]; supported: boolean;
  optional?: boolean;
  sourceRules?: Record<string, unknown>[];
}
export interface ScoringSource { id: string; title: string; href: string; }
export interface ScoringRubric {
  id: string; version: string; title: string; titleEn: string; status: "prototype" | "project-defined";
  scientificallyValidated: false; hash: string; items: ScoringItem[];
  modules: { id: string; title: string; maxScore: number }[]; sources: ScoringSource[];
  thresholds?: { temperatureC: number; oxygenLow: number; oxygenHigh: number };
}
export type ItemStatus = "matched" | "unknown" | "conflict" | "unsupported";
export interface BaselineItem {
  itemId: string; module: string; label: string; status: ItemStatus; branchId: string | null;
  score: number | null; reason: string; inputFields: string[]; sourceRefs: string[];
}
export interface ComparisonBaseline {
  items: BaselineItem[]; knownSubtotal: number; completeScore: number | null;
  maxScore: number; level: AssessmentLevel | null; dataMode: AssessmentDataMode;
  quality: { state: "complete" | "partial" | "insufficient_data"; issues: QualityIssue[] };
  minimumAttention: MinimumAttention; evaluatedCount: number; totalCount: number;
  metrics?: { mortalityRate: number | null };
}
export interface ScoringProposalItem { itemId: string; branchId: string | null; status: ItemStatus; score: number | null; reason: string; }
export interface ScoringProposal { items: ScoringProposalItem[]; generalSupplement: string; }
export interface ScoringDifference { itemId: string; code: string; message: string; }
export interface ProposalValidation {
  state: "consistent" | "partial" | "needs_review"; knownSubtotal: number;
  completeScore: number | null; level: AssessmentLevel | null;
}
export type AiAssessmentRequest = {
  diseaseId: "wsd"; locale: "zh-CN" | "en"; standardId: "wsd-v1.0";
  input: WsdWarningInput; context: AssessmentContext;
} | {
  diseaseId: "tilapia-streptococcosis"; locale: "zh-CN" | "en"; standardId: "tilapia-demo-score-v0.1";
  input: TilapiaAssessmentInput; context: AssessmentContext;
};
export interface ComparisonReport {
  reportType: "gadews-ai-assessment-comparison"; schemaVersion: "1.0";
  diseaseId: AiAssessmentRequest["diseaseId"]; inputSnapshot: Record<string, unknown>; contextSnapshot: Record<string, unknown>;
  inputHash: string; assessedAt: string; standard: Pick<ScoringRubric, "id" | "version" | "title" | "titleEn" | "status" | "scientificallyValidated" | "hash">;
  model: { id: string; protocol: string }; baseline: ComparisonBaseline; proposal: ScoringProposal;
  validation: ProposalValidation; differences: ScoringDifference[]; sources: ScoringSource[];
}
