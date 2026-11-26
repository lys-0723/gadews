import type { ComparisonReport } from "./types";

export function serializeComparisonReport(report: ComparisonReport, outdated: boolean): string {
  if (outdated) throw new Error("Comparison is outdated; evaluate again.");
  const { reportType, schemaVersion, diseaseId, inputSnapshot, contextSnapshot, inputHash, assessedAt, standard, model, baseline, proposal, validation, differences, sources } = report;
  if (reportType !== "gadews-ai-assessment-comparison" || schemaVersion !== "1.0") throw new Error("Invalid comparison report");
  return JSON.stringify({ reportType, schemaVersion, diseaseId, inputSnapshot, contextSnapshot, inputHash, assessedAt, standard, model, baseline, proposal, validation, differences, sources }, (_key, value: unknown) =>
    typeof value === "number" && !Number.isFinite(value) ? { $number: String(value) } : value, 2);
}
