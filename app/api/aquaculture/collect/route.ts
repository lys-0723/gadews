import { authorizeCollectorRequest } from "@/lib/aquaculture/auth";
import { collectConfiguredDevices } from "@/lib/aquaculture/collector";
import { createCollectHandler } from "@/lib/aquaculture/request-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = createCollectHandler({
  authorize: authorizeCollectorRequest,
  collect: collectConfiguredDevices,
  now: () => new Date(),
  logError: (error) => console.error("Aquaculture collection failed", error),
});
