import { CollectionRangeError, RequestValidationError } from "./errors";

export function validateDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RequestValidationError(name, "must use YYYY-MM-DD format");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new RequestValidationError(name, "is not a valid calendar date");
  return value;
}

export function parseObservationDate(value: string, name: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${validateDate(value, name)}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) {
    throw new RequestValidationError(name, "must be an ISO date or timestamp with timezone");
  }
  validateDate(value.slice(0, 10), name);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new RequestValidationError(name, "is not a valid timestamp");
  return parsed;
}

export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export interface CollectionDateContext {
  startDate?: string;
  endDate?: string;
  latestObservation: Date | null;
  now: Date;
  timeZone: string;
  initialLookbackDays: number;
}

export function resolveCollectionDateRange(context: CollectionDateContext): { startDate: string; endDate: string } {
  const startDate = context.startDate
    ? validateDate(context.startDate, "startDate")
    : formatDateInTimeZone(context.latestObservation ?? new Date(context.now.getTime() - context.initialLookbackDays * 86_400_000), context.timeZone);
  const endDate = context.endDate ? validateDate(context.endDate, "endDate") : formatDateInTimeZone(context.now, context.timeZone);
  if (startDate > endDate) throw new CollectionRangeError();
  return { startDate, endDate };
}
