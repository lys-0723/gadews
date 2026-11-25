import { parseMonitoringSnapshot, type MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import type { WsdAssessmentContext, WsdWarningInput } from "./wsd-warning-model";
import type { MonitoringOrigin } from "./monitoring-source";
import { isDemoMonitoringScenarioId } from "./monitoring-demo";

export type WsdMonitoringField = "waterTemperatureC" | "ph";
export type WsdMonitoringProvenance = Partial<Record<WsdMonitoringField, { snapshot: MonitoringSnapshot; appliedAt: string; origin?: MonitoringOrigin }>>;
export interface WsdMonitoringState {
  input: WsdWarningInput;
  context: WsdAssessmentContext;
  appliedFields: WsdMonitoringField[];
  reason: string | null;
}
const fields: WsdMonitoringField[] = ["waterTemperatureC", "ph"];
const blank = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");
function state(input: WsdWarningInput, context: WsdAssessmentContext): WsdMonitoringState {
  return { input: structuredClone(input), context: structuredClone(context), appliedFields: [], reason: null };
}
export function getWsdMonitoringProvenance(context: WsdAssessmentContext): WsdMonitoringProvenance {
  const records = context.inputProvenance?.monitoring;
  return records && typeof records === "object" ? records as WsdMonitoringProvenance : {};
}

/** Import current, verified evidence only into its explicitly matching source mode. */
export function applyMonitoringToWsd(input: WsdWarningInput, context: WsdAssessmentContext, snapshot: MonitoringSnapshot, now: Date | string, origin: MonitoringOrigin = { kind: "published" }): WsdMonitoringState {
  const next = state(input, context);
  const refuse = (reason: string) => { next.reason = reason; return next; };
  if (origin.kind === "published") {
    if ((context.dataMode ?? "manual") !== "manual") return refuse("Reset WSD before applying monitoring to manual inputs.");
  } else if (origin.kind !== "demo" || context.dataMode !== "example") return refuse("Demo monitoring can only be loaded into the example workspace.");
  let parsed: MonitoringSnapshot;
  try { parsed = parseMonitoringSnapshot(snapshot); } catch { return refuse("The monitoring observation is invalid. Refresh and review its quality."); }
  const { feed, observation } = parsed;
  if (origin.kind === "demo" && (!isDemoMonitoringScenarioId(origin.scenarioId) || origin.scenarioId !== feed.id || origin.generatedAt !== parsed.fetchedAt)) return refuse("The demo scenario or generation time does not match this observation. Refresh the demo.");
  if (input.regionOrSite?.trim() !== feed.siteId || input.farmOrPondId?.trim() !== feed.pondId) return refuse("Enter the exact monitoring site and pond IDs in the WSD form first.");
  if (!observation) return refuse("No monitoring observation is available.");
  const clock = now instanceof Date ? now.getTime() : Date.parse(now);
  const observed = observation.observedAt === null ? NaN : Date.parse(observation.observedAt);
  const ingested = observation.ingestedAt === null ? NaN : Date.parse(observation.ingestedAt);
  if (![clock, observed, ingested].every(Number.isFinite) || observed > clock || ingested > clock || ingested < observed) return refuse("Monitoring times are invalid or in the future. Refresh the observation.");
  if (clock - observed > feed.maxAgeHours * 3_600_000) return refuse("The monitoring observation has expired. Refresh the observation.");
  if (!feed.unitVerificationRef?.trim()) return refuse("Monitoring units have not been verified; preview only.");
  const records: WsdMonitoringProvenance = structuredClone(getWsdMonitoringProvenance(next.context));
  for (const field of fields) {
    const metric = observation.metrics[field];
    if (!blank(input[field]) || (field === "ph" && !blank(input.pH))) continue;
    if (metric.state !== "usable" || metric.issues.length > 0 || metric.value === null || !Number.isFinite(metric.value)) continue;
    const [unit, min, max] = field === "waterTemperatureC" ? ["°C", -5, 50] as const : ["pH", 0, 14] as const;
    if (metric.unit !== unit || metric.value < min || metric.value > max) continue;
    next.input[field] = metric.value;
    next.context.observations = { ...next.context.observations, [field]: { observedAt: observation.observedAt!, maxAgeHours: feed.maxAgeHours, scope: "pond" } };
    records[field] = { snapshot: structuredClone(parsed), appliedAt: new Date(clock).toISOString(), origin: structuredClone(origin) };
    next.appliedFields.push(field);
  }
  if (next.appliedFields.length) next.context.inputProvenance = { ...next.context.inputProvenance, monitoring: records };
  else next.reason = "No blank WSD temperature or pH field has usable monitoring evidence. Existing values are kept.";
  return next;
}

/** Keep a new manual value, but remove the device time and source attached to it. */
export function clearWsdMonitoringField(input: WsdWarningInput, context: WsdAssessmentContext, field: WsdMonitoringField): WsdMonitoringState {
  const next = state(input, context);
  const records = { ...getWsdMonitoringProvenance(next.context) };
  delete records[field];
  if (next.context.observations) {
    delete next.context.observations[field];
    if (field === "ph") delete next.context.observations.pH;
    if (!Object.keys(next.context.observations).length) delete next.context.observations;
  }
  if (next.context.inputProvenance) {
    if (Object.keys(records).length) next.context.inputProvenance.monitoring = records;
    else delete next.context.inputProvenance.monitoring;
    if (!Object.keys(next.context.inputProvenance).length) delete next.context.inputProvenance;
  }
  return next;
}

/** A different site/pond must not retain values imported for the previous pond. */
export function clearWsdMonitoringIdentity(input: WsdWarningInput, context: WsdAssessmentContext): WsdMonitoringState {
  let next = state(input, context);
  for (const field of fields) {
    if (getWsdMonitoringProvenance(next.context)[field]) {
      delete next.input[field];
      next = clearWsdMonitoringField(next.input, next.context, field);
    }
  }
  return next;
}
