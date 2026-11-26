import { queryAquacultureObservations } from "@/lib/aquaculture/database";
import { createMonitoringLatestHandler } from "@/lib/aquaculture/monitoring-handlers";
import { readMonitoringPublication } from "@/lib/aquaculture/monitoring-publication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createMonitoringLatestHandler({
  publication: () => readMonitoringPublication(process.env),
  query: queryAquacultureObservations,
  logError: (entry) => console.error(entry),
});
