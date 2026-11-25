import type { AssessmentResult } from "./warning-assessment";

/** Export only the assessed snapshot; callers cannot replace input or provenance. */
export function serializeAssessmentReport(result: AssessmentResult | null, outdated: boolean): string {
  if (result === null) throw new Error("No assessment result is available to download.");
  if (outdated) throw new Error("This assessment is outdated; evaluate again before downloading.");
  return JSON.stringify({ reportType: "gadews-assessment", schemaVersion: "1.0", result }, (_key, value: unknown) => {
    if (typeof value === "number" && !Number.isFinite(value)) return { $number: String(value) };
    return value;
  }, 2);
}
