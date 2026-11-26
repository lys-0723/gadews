import { parseMonitoringFeeds, parseMonitoringSnapshot, type MonitoringFeed, type MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";

export interface MonitoringDataSource {
  kind: "published" | "demo";
  listFeeds(signal?: AbortSignal): Promise<MonitoringFeed[]>;
  readLatest(feedId: string, signal?: AbortSignal): Promise<MonitoringSnapshot>;
}
export type MonitoringOrigin = { kind: "published" } | { kind: "demo"; scenarioId: string; generatedAt: string };

const unavailable = "Monitoring is not configured or is temporarily unavailable.";
const failed = "Monitoring could not be loaded. Retry the request.";
const invalid = "Monitoring returned invalid data. Retry the request.";
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The monitoring request was aborted.", "AbortError");
}

/** Browser-safe transport for the existing controlled publication API. */
export function createPublishedMonitoringSource(fetcher?: typeof fetch): MonitoringDataSource {
  async function request<T>(url: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    checkAbort(signal);
    try {
      // Resolve the browser's current fetch when a request runs, not at module load.
      const response = await (fetcher ?? globalThis.fetch)(url, { signal, cache: "no-store" });
      checkAbort(signal);
      if (!response.ok) throw new Error(response.status === 503 ? unavailable : failed);
      const data: unknown = await response.json();
      checkAbort(signal);
      return parse(data);
    } catch (failure) {
      checkAbort(signal);
      if (failure instanceof Error && failure.name === "AbortError") throw new DOMException("The monitoring request was aborted.", "AbortError");
      const message = failure instanceof Error && [unavailable, failed].includes(failure.message) ? failure.message : invalid;
      throw new Error(message);
    }
  }
  return {
    kind: "published",
    listFeeds(signal) { return request("/api/monitoring/feeds", parseMonitoringFeeds, signal); },
    readLatest(feedId, signal) { return request(`/api/monitoring/latest?feedId=${encodeURIComponent(feedId)}`, parseMonitoringSnapshot, signal); },
  };
}

/** Stable default prevents unrelated React renders from changing source identity. */
export const publishedMonitoringSource = createPublishedMonitoringSource();
