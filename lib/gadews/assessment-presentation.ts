import type { AssessmentLevel, AssessmentResult } from "./warning-assessment";

export type AssessmentTone = "neutral" | "low" | "medium" | "high" | "urgent";
export interface AssessmentPresentation {
  tone: AssessmentTone;
  kind: "grade" | "attention" | "unavailable" | "draft" | "outdated";
  labelKey: string;
  detailKey: string;
}

function gradeTone(level: AssessmentLevel): AssessmentTone {
  if (level.rank !== undefined && Number.isInteger(level.rank) && level.rank >= 0 && level.rank <= 3) return (["low", "medium", "high", "urgent"] as const)[level.rank];
  const id = level.id.toLowerCase();
  if (id === "urgent" || id === "extreme" || id === "very_high" || id.includes("极高")) return "urgent";
  if (id === "high" || id.startsWith("高风险")) return "high";
  if (id === "medium" || id.startsWith("中风险")) return "medium";
  if (id === "low" || id.startsWith("低风险")) return "low";
  return "neutral";
}

export function presentationForAssessment(result: AssessmentResult, outdated = false): AssessmentPresentation {
  if (outdated) return { tone: "neutral", kind: "outdated", labelKey: "Result outdated", detailKey: "Inputs changed. This result is outdated; evaluate again." };
  if (result.status === "not_configured" || result.model.state === "not_configured") return { tone: "neutral", kind: "unavailable", labelKey: "Model not configured", detailKey: "No active assessment model is available." };
  if (result.status === "draft_disabled") return { tone: "neutral", kind: "draft", labelKey: "Draft rules disabled", detailKey: "Draft rules were not evaluated." };
  if (result.status === "complete" && result.level) return { tone: gradeTone(result.level), kind: "grade", labelKey: result.level.label, detailKey: "Complete rule assessment; screening support, not confirmation." };
  const isDraft = result.status === "draft_preview" || result.dataMode === "draft-preview";
  if (result.minimumAttention !== "none") {
    const attention = result.minimumAttention;
    return {
      tone: attention === "review" ? "medium" : attention,
      kind: "attention",
      labelKey: attention === "urgent" ? "Urgent attention" : attention === "high" ? "High attention" : "Evidence review required",
      detailKey: isDraft ? "Draft example attention; not a production assessment."
        : attention === "urgent" ? "Existing evidence requires urgent attention; assessment is incomplete."
        : attention === "high" ? "Existing evidence requires high attention; assessment is incomplete."
        : "Review the existing evidence; a complete grade is not yet available.",
    };
  }
  if (isDraft) return { tone: "neutral", kind: "draft", labelKey: "Draft preview", detailKey: "Draft example only; no complete production grade." };
  return { tone: "neutral", kind: "unavailable", labelKey: "Awaiting complete assessment", detailKey: "Evidence is insufficient to determine low risk; complete or review the records." };
}
