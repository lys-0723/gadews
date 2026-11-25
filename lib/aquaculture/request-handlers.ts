import type { CollectionOptions } from "./collector";
import type { ObservationQuery } from "./database";
import { CollectionRangeError, RequestValidationError, UnknownAquacultureDeviceError } from "./errors";
import { parseCollectBody, parseObservationQuery } from "./request-validation";
import type { AquacultureObservationRecord, DeviceCollectionResult } from "./types";

type Authorize = (request: Request) => Response | null;
type LogError = (error: unknown) => void;

function failure(error: unknown, operation: "collect" | "observations", logError: LogError): Response {
  if (error instanceof RequestValidationError || error instanceof UnknownAquacultureDeviceError || error instanceof CollectionRangeError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  // Log categories only; upstream messages may contain credentials or payloads.
  logError({ operation, category: "service_error" });
  return Response.json({ error: operation === "collect" ? "Aquaculture collection failed" : "Failed to query aquaculture observations" }, { status: 500 });
}

export function createCollectHandler(deps: { authorize: Authorize; collect: (options: CollectionOptions) => Promise<DeviceCollectionResult[]>; now: () => Date; logError: LogError }) {
  return async (request: Request): Promise<Response> => {
    const unauthorized = deps.authorize(request);
    if (unauthorized) return unauthorized;
    try {
      const options = parseCollectBody(await request.text());
      const data = await deps.collect(options);
      return Response.json({ collectedAt: deps.now().toISOString(), data, count: data.length });
    } catch (error) { return failure(error, "collect", deps.logError); }
  };
}

export function createObservationsHandler(deps: { authorize: Authorize; query: (options: ObservationQuery) => Promise<AquacultureObservationRecord[]>; logError: LogError }) {
  return async (request: Request): Promise<Response> => {
    const unauthorized = deps.authorize(request);
    if (unauthorized) return unauthorized;
    try {
      const options = parseObservationQuery(new URL(request.url).searchParams);
      const data = await deps.query(options);
      return Response.json({ data, count: data.length }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) { return failure(error, "observations", deps.logError); }
  };
}
