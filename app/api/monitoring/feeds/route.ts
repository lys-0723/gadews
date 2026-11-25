import { createMonitoringFeedsHandler } from "@/lib/aquaculture/monitoring-handlers";
import { readMonitoringPublication } from "@/lib/aquaculture/monitoring-publication";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createMonitoringFeedsHandler({
  publication: () => readMonitoringPublication(process.env),
  logError: (entry) => console.error(entry),
});
