import { monitoringTimestamp, type MonitoringFeed, type MonitoringMetric, type MonitoringMetrics, type MonitoringSnapshot } from "./monitoring-types";

const metricPolicies = {
  waterTemperatureC: { unit: "°C", min: -5, max: 50, missingFlag: "missing_water_temperature", rangeFlag: "water_temperature_out_of_range" },
  dissolvedOxygenMgL: { unit: "mg/L", min: 0, max: 30, missingFlag: "missing_dissolved_oxygen", rangeFlag: "dissolved_oxygen_out_of_range" },
  ph: { unit: "pH", min: 0, max: 14, missingFlag: "missing_ph", rangeFlag: "ph_out_of_range" },
} as const;
const knownFlags: ReadonlySet<string> = new Set(Object.values(metricPolicies).flatMap((policy) => [policy.missingFlag, policy.rangeFlag]));

export function buildMonitoringSnapshot(feed: MonitoringFeed, record: unknown, now: Date): MonitoringSnapshot {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid monitoring clock");
  const snapshot: MonitoringSnapshot = { schemaVersion: "1.0", feed: { ...feed }, fetchedAt: now.toISOString(), observation: null };
  if (record === null) return snapshot;
  if (typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid monitoring observation");
  const row = record as Record<string, unknown>;
  const observedAt = monitoringTimestamp(row.observedAt);
  const ingestedAt = monitoringTimestamp(row.ingestedAt);
  const observedTime = observedAt === null ? Number.NaN : Date.parse(observedAt);
  const ingestedTime = ingestedAt === null ? Number.NaN : Date.parse(ingestedAt);
  const timeIssues: string[] = [];
  if (observedAt === null || ingestedAt === null) timeIssues.push("invalid_time");
  if (observedTime > now.getTime() || ingestedTime > now.getTime()) timeIssues.push("future_time");
  if (ingestedTime < observedTime) timeIssues.push("reversed_time");
  const stale = Number.isFinite(observedTime) && now.getTime() - observedTime > feed.maxAgeHours * 3_600_000;
  const flags = Array.isArray(row.qualityFlags) ? row.qualityFlags : [];
  const unknownQuality = !Array.isArray(row.qualityFlags) || flags.some((flag) => typeof flag !== "string" || !knownFlags.has(flag));
  const metrics = {} as MonitoringMetrics;
  for (const key of ["waterTemperatureC", "dissolvedOxygenMgL", "ph"] as const) {
    const policy = metricPolicies[key];
    const original = row[key];
    const missing = original === null || original === undefined;
    const value = typeof original === "number" && Number.isFinite(original) ? original : null;
    const invalidValue = !missing && value === null;
    const outOfRange = value !== null && (value < policy.min || value > policy.max);
    const markedMissing = flags.includes(policy.missingFlag);
    const markedRange = flags.includes(policy.rangeFlag);
    const contradiction = (markedMissing && !missing) || (markedRange && !outOfRange);
    const issues = [...timeIssues];
    if (missing) issues.push("missing_value");
    if (invalidValue) issues.push("invalid_value");
    if (outOfRange || markedRange) issues.push("out_of_range");
    if (contradiction) issues.push("contradictory_quality_flag");
    if ((missing && !markedMissing) || (outOfRange && !markedRange)) issues.push("missing_quality_flag");
    if (unknownQuality) issues.push("unknown_quality_flag");
    if (stale) issues.push("stale");
    if (feed.unitVerificationRef === null) issues.push("unit_unverified");
    const state: MonitoringMetric["state"] = missing ? "missing"
      : invalidValue || outOfRange || contradiction || timeIssues.length > 0 ? "invalid"
      : unknownQuality ? "quality_unknown"
      : stale ? "stale"
      : feed.unitVerificationRef === null ? "unit_unverified" : "usable";
    metrics[key] = { value, unit: policy.unit, state, issues };
  }
  snapshot.observation = { observedAt, ingestedAt, reference: `monitoring:${feed.id}:${observedAt ?? "invalid-time"}`, metrics };
  return snapshot;
}
