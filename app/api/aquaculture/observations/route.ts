import { authorizeReadRequest } from "@/lib/aquaculture/auth";
import { queryAquacultureObservations } from "@/lib/aquaculture/database";
import { createObservationsHandler } from "@/lib/aquaculture/request-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createObservationsHandler({
  authorize: authorizeReadRequest,
  query: queryAquacultureObservations,
  logError: (error) => console.error("Failed to query aquaculture observations", error),
});
