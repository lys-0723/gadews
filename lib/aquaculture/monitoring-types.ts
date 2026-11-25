import { z } from "zod";

export type MonitoringMetricState = "usable" | "missing" | "invalid" | "stale" | "unit_unverified" | "quality_unknown";
export interface MonitoringFeed {
  id: string;
  label: string;
  siteId: string;
  pondId: string;
  maxAgeHours: number;
  unitVerificationRef: string | null;
}
export interface MonitoringMetric {
  value: number | null;
  unit: "°C" | "mg/L" | "pH";
  state: MonitoringMetricState;
  issues: string[];
}
export interface MonitoringMetrics {
  waterTemperatureC: MonitoringMetric;
  dissolvedOxygenMgL: MonitoringMetric;
  ph: MonitoringMetric;
}
export interface MonitoringObservation {
  observedAt: string | null;
  ingestedAt: string | null;
  reference: string;
  metrics: MonitoringMetrics;
}
export interface MonitoringSnapshot {
  schemaVersion: "1.0";
  feed: MonitoringFeed;
  fetchedAt: string;
  observation: MonitoringObservation | null;
}
// This module is shared with the browser. Do not import server configuration or DB code.
export function monitoringTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) return null;
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

const publicText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
export const monitoringFeedSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  label: publicText(160),
  siteId: publicText(128),
  pondId: publicText(128),
  maxAgeHours: z.number().finite().positive().max(168),
  unitVerificationRef: publicText(256).nullable(),
}).strict();
const timestampSchema = z.string().refine((value) => monitoringTimestamp(value) !== null);
const stateSchema = z.enum(["usable", "missing", "invalid", "stale", "unit_unverified", "quality_unknown"]);
const metricSchema = (unit: "°C" | "mg/L" | "pH") => z.object({
  value: z.number().finite().nullable(),
  unit: z.literal(unit),
  state: stateSchema,
  issues: z.array(publicText(80)).max(24),
}).strict();
const snapshotSchema = z.object({
  schemaVersion: z.literal("1.0"),
  feed: monitoringFeedSchema,
  fetchedAt: timestampSchema,
  observation: z.object({
    observedAt: timestampSchema.nullable(),
    ingestedAt: timestampSchema.nullable(),
    reference: publicText(256),
    metrics: z.object({
      waterTemperatureC: metricSchema("°C"),
      dissolvedOxygenMgL: metricSchema("mg/L"),
      ph: metricSchema("pH"),
    }).strict(),
  }).strict().nullable(),
}).strict().superRefine((snapshot, ctx) => {
  const observation = snapshot.observation;
  if (!observation) return;
  const observed = observation.observedAt === null ? Number.NaN : Date.parse(observation.observedAt);
  const ingested = observation.ingestedAt === null ? Number.NaN : Date.parse(observation.ingestedAt);
  const fetched = Date.parse(snapshot.fetchedAt);
  const validTime = Number.isFinite(observed) && Number.isFinite(ingested) && observed <= ingested && ingested <= fetched && fetched - observed <= snapshot.feed.maxAgeHours * 3_600_000;
  const bounds = { waterTemperatureC: [-5, 50], dissolvedOxygenMgL: [0, 30], ph: [0, 14] };
  for (const key of ["waterTemperatureC", "dissolvedOxygenMgL", "ph"] as const) {
    const metric = observation.metrics[key];
    const [min, max] = bounds[key];
    if ((metric.state === "missing" && metric.value !== null) || (metric.state === "usable" && (!validTime || snapshot.feed.unitVerificationRef === null || metric.value === null || metric.value < min || metric.value > max || metric.issues.length !== 0))) {
      ctx.addIssue({ code: "custom", message: "Inconsistent monitoring quality", path: ["observation", "metrics", key] });
    }
  }
});

export function parseMonitoringSnapshot(value: unknown): MonitoringSnapshot {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid monitoring snapshot");
  return parsed.data;
}

export function parseMonitoringFeeds(value: unknown): MonitoringFeed[] {
  const parsed = z.object({ schemaVersion: z.literal("1.0"), feeds: z.array(monitoringFeedSchema).max(32) }).strict().safeParse(value);
  if (!parsed.success || new Set(parsed.data.feeds.map((feed) => feed.id)).size !== parsed.data.feeds.length) throw new Error("Invalid monitoring feeds");
  return parsed.data.feeds;
}
