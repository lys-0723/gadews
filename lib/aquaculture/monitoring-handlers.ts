import type { MonitoringPublication, PublishedMonitoringFeed } from "./monitoring-publication";
import { buildMonitoringSnapshot } from "./monitoring-quality";
import { parseMonitoringSnapshot, type MonitoringFeed } from "./monitoring-types";

type MonitoringFailureCategory = "publication_unavailable" | "invalid_clock" | "invalid_result" | "scope_mismatch" | "service_error";
interface MonitoringDependencies {
  publication: () => MonitoringPublication;
  logError?: (entry: { operation: "monitoring"; category: MonitoringFailureCategory }) => void;
}
interface LatestDependencies extends MonitoringDependencies {
  query: (options: { deviceKey: string; siteId: string; pondId: string; limit: 1 }) => Promise<unknown>;
  now?: () => Date;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function failure(deps: MonitoringDependencies, category: MonitoringFailureCategory): Response {
  // Never attach an exception, config, selector, or database row to this log.
  try { deps.logError?.({ operation: "monitoring", category }); } catch { /* Logging must not change the public error. */ }
  return json({ error: "Monitoring is unavailable" }, 503);
}

function publication(deps: MonitoringDependencies): MonitoringPublication {
  try { return deps.publication(); } catch { return { status: "invalid" }; }
}

function publicFeed(feed: PublishedMonitoringFeed): MonitoringFeed {
  return { id: feed.id, label: feed.label, siteId: feed.siteId, pondId: feed.pondId, maxAgeHours: feed.maxAgeHours, unitVerificationRef: feed.unitVerificationRef };
}

export function createMonitoringFeedsHandler(deps: MonitoringDependencies) {
  return async (request: Request): Promise<Response> => {
    const config = publication(deps);
    if (config.status !== "published") return failure(deps, "publication_unavailable");
    if (new URL(request.url).searchParams.size !== 0) return json({ error: "Invalid monitoring request" }, 400);
    return json({ schemaVersion: "1.0", feeds: config.feeds.map(publicFeed) });
  };
}

export function createMonitoringLatestHandler(deps: LatestDependencies) {
  return async (request: Request): Promise<Response> => {
    const config = publication(deps);
    if (config.status !== "published") return failure(deps, "publication_unavailable");
    const params = new URL(request.url).searchParams;
    const feedId = params.get("feedId");
    if (params.size !== 1 || feedId === null || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(feedId)) return json({ error: "Invalid monitoring request" }, 400);
    const feed = config.feeds.find((candidate) => candidate.id === feedId);
    if (!feed) return json({ error: "Monitoring feed was not found" }, 404);
    let now: Date;
    try {
      now = (deps.now ?? (() => new Date()))();
      if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return failure(deps, "invalid_clock");
    } catch { return failure(deps, "invalid_clock"); }
    try {
      const rows = await deps.query({ deviceKey: feed.deviceKey, siteId: feed.siteId, pondId: feed.pondId, limit: 1 });
      if (!Array.isArray(rows) || rows.length > 1) return failure(deps, "invalid_result");
      const row: unknown = rows.length === 0 ? null : rows[0];
      if (row !== null && (typeof row !== "object" || Array.isArray(row))) return failure(deps, "invalid_result");
      if (rows.length === 1) {
        if (row === null) return failure(deps, "invalid_result");
        const identity = row as Record<string, unknown>;
        if (identity.deviceKey !== feed.deviceKey || identity.siteId !== feed.siteId || identity.pondId !== feed.pondId) return failure(deps, "scope_mismatch");
      }
      const snapshot = buildMonitoringSnapshot(publicFeed(feed), row, now);
      return json(parseMonitoringSnapshot(snapshot));
    } catch { return failure(deps, "service_error"); }
  };
}
