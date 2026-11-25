import { z } from "zod";
import type { CollectionOptions } from "./collector";
import type { ObservationQuery } from "./database";
import { parseObservationDate, validateDate } from "./dates";
import { RequestValidationError } from "./errors";

const optionalText = z.string().nullable().optional().transform((value) => value === null || value === "" ? undefined : value);
const collectSchema = z.object({ deviceKey: optionalText, startDate: optionalText, endDate: optionalText }).strict();

export function parseCollectBody(text: string): CollectionOptions {
  let value: unknown;
  try { value = text === "" ? {} : JSON.parse(text); }
  catch { throw new RequestValidationError("body", "must be valid JSON"); }
  const parsed = collectSchema.safeParse(value);
  if (!parsed.success) throw new RequestValidationError("body", "must be an object containing only optional string deviceKey/startDate/endDate fields");
  const { deviceKey, startDate, endDate } = parsed.data;
  if (deviceKey !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(deviceKey)) throw new RequestValidationError("deviceKey", "must be an internal device key");
  if (startDate !== undefined) validateDate(startDate, "startDate");
  if (endDate !== undefined) validateDate(endDate, "endDate");
  if (startDate !== undefined && endDate !== undefined && startDate > endDate) throw new RequestValidationError("startDate", "must not be after endDate");
  return { ...(deviceKey !== undefined && { deviceKey }), ...(startDate !== undefined && { startDate }), ...(endDate !== undefined && { endDate }) };
}

const queryKeys = new Set(["deviceKey", "siteId", "pondId", "from", "to", "limit"]);

export function parseObservationQuery(params: URLSearchParams): ObservationQuery {
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (!queryKeys.has(key)) throw new RequestValidationError("query", "contains an unknown field");
    if (seen.has(key)) throw new RequestValidationError(key, "must not be repeated");
    seen.add(key);
  }
  const rawLimit = params.get("limit");
  const limit = rawLimit === null || rawLimit === "" ? 500 : Number(rawLimit);
  if ((rawLimit !== null && rawLimit !== "" && !/^\d+$/.test(rawLimit)) || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new RequestValidationError("limit", "must be an integer between 1 and 1000");
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  const from = fromRaw ? parseObservationDate(fromRaw, "from") : undefined;
  const to = toRaw ? parseObservationDate(toRaw, "to") : undefined;
  if (from && to && from > to) throw new RequestValidationError("from", "must not be after to");
  return {
    deviceKey: params.get("deviceKey")?.trim() || undefined,
    siteId: params.get("siteId")?.trim() || undefined,
    pondId: params.get("pondId")?.trim() || undefined,
    from, to, limit,
  };
}
