import { buildMonitoringSnapshot } from "@/lib/aquaculture/monitoring-quality";
import { parseMonitoringFeeds, parseMonitoringSnapshot, type MonitoringFeed } from "@/lib/aquaculture/monitoring-types";
import type { MonitoringDataSource } from "./monitoring-source";

export const DEMO_MONITORING_SCENARIO_IDS = ["demo-usable", "demo-partial", "demo-stale", "demo-unverified"] as const;
export function isDemoMonitoringScenarioId(id: string): id is typeof DEMO_MONITORING_SCENARIO_IDS[number] {
  return DEMO_MONITORING_SCENARIO_IDS.some((scenario) => scenario === id);
}
const feeds: MonitoringFeed[] = DEMO_MONITORING_SCENARIO_IDS.map((id, index) => ({
  id,
  label: `Demo ${["usable", "partial / missing", "stale", "units unverified"][index]} · synthetic observations`,
  siteId: "demo-site",
  pondId: "demo-pond",
  maxAgeHours: 1,
  unitVerificationRef: id === "demo-unverified" ? null : "Demo fixture only",
}));
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The monitoring request was aborted.", "AbortError");
}

/** A local teaching fixture. No device, database, configuration or HTTP access. */
export function createDemoMonitoringSource({ now = () => new Date() }: { now?: () => Date } = {}): MonitoringDataSource {
  return {
    kind: "demo",
    async listFeeds(signal) {
      checkAbort(signal);
      return parseMonitoringFeeds({ schemaVersion: "1.0", feeds });
    },
    async readLatest(feedId, signal) {
      checkAbort(signal);
      if (!isDemoMonitoringScenarioId(feedId)) throw new Error("Unknown monitoring demo scenario");
      const clock = now();
      checkAbort(signal);
      if (!(clock instanceof Date) || !Number.isFinite(clock.getTime())) throw new Error("Invalid monitoring clock");
      const feed = feeds.find((candidate) => candidate.id === feedId)!;
      const observed = clock.getTime() - (feedId === "demo-stale" ? 180 : 10) * 60_000;
      const partial = feedId === "demo-partial";
      return parseMonitoringSnapshot(buildMonitoringSnapshot(feed, {
        observedAt: new Date(observed).toISOString(),
        ingestedAt: new Date(observed + 60_000).toISOString(),
        waterTemperatureC: 29,
        dissolvedOxygenMgL: partial ? null : 5.2,
        ph: partial ? null : 8.2,
        qualityFlags: partial ? ["missing_dissolved_oxygen", "missing_ph"] : [],
      }, clock));
    },
  };
}
