import { z } from "zod";

export const DISEASE_FILTERS = ["all", "WSD", "AHPND", "KHV", "TILV", "EUS", "VHS", "IHN", "SVC", "other"] as const;
export type DiseaseFilter = typeof DISEASE_FILTERS[number];
export type MapDiseaseFilter = DiseaseFilter | `source:${string}`;
export const QAAD_FILTERS = ["priority", "all", "present_in_quarter", "historical_presence_in_report_year", "absent_in_quarter", "absent_in_report_year", "no_information", "unknown"] as const;
export type QaadStatusFilter = typeof QAAD_FILTERS[number];
export type PublicSource = "wahis" | "qaad";
export type LoadState = "idle" | "loading" | "success" | "empty" | "error";
export interface SourceMetadata {
  source: string;
  sourceType: "snapshot";
  path: string;
  recordCount: number;
  coverage: { from: string | null; to: string | null };
  retrievedAt: string | null;
  sourceUrls: string[];
}
export interface LayerStats {
  recordsDisplayed: number;
  countriesCovered: number;
  topDisease: string;
  countries: string[];
  state?: LoadState;
  metadata?: SourceMetadata;
  rejectedCount?: number;
  error?: string;
  retry?: () => void;
}

const text = z.string().nullable().optional();
const textList = z.array(z.string()).nullable().optional();
const identity = z.union([z.string().trim().min(1), z.number().finite()]).transform(String);
const wahisSchema = z.object({
  event_id: identity, country: z.string().trim().min(1), disease_id: z.string().trim().min(1), disease_name: z.string().trim().min(1),
  report_id_raw: text, region: text, event_start_date: text, reason_for_notification: text,
  report_status: text, event_status: text, dashboard_url: text, last_report_url: text,
  coordinate_type: text, source: text, access_date: text,
  dashboard_summary: z.object({ latest_reporting_date: text, total_reports: z.number().nullable().optional(), total_outbreaks_latest: z.number().nullable().optional(), open_outbreaks_latest: z.number().nullable().optional() }).passthrough().nullable().optional(),
  latest_report_detail: z.object({ event_status: text, report_date: text }).passthrough().nullable().optional(),
}).passthrough();
const qaadSchema = z.object({
  summary_id: z.string().min(1), country_or_territory: z.string().min(1), disease_id: z.string().min(1), disease_name: z.string().min(1),
  region: text, year: z.number().int().nullable().optional(), quarter: z.union([z.string(), z.number()]).nullable().optional(),
  report_period: text, status_summary: text, positive_months: textList, absent_months: textList,
  no_information_months: textList, positive_months_all_year: textList,
  diagnosis_levels: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  epidemiological_comments: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  report_file_urls: textList, source_urls: textList, coordinate_type: text,
  source: text, source_type: text, organization: text,
}).passthrough();
type Spatial = { latitude: number | null; longitude: number | null; sourceIndex: number };
export type WahisRecord = Omit<z.infer<ReturnType<typeof wahisSchema.strip>>, "event_start_date"> & Spatial & { event_start_date: string | null };
export type QaadDisplayRecord = z.infer<typeof qaadSchema> & Spatial;
export interface ParseResult<T> { records: T[]; rejectedCount: number; invalidCoordinates: number; invalidDates: number }

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function position(value: unknown, limit: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}
export function hasCoordinates<T extends { latitude?: unknown; longitude?: unknown }>(record: T): record is T & { latitude: number; longitude: number } {
  return position(record.latitude, 90) !== null && position(record.longitude, 180) !== null;
}
function parseRows<T>(rows: unknown[], parse: (row: unknown, index: number) => T | null): ParseResult<T> {
  const records: T[] = []; let rejectedCount = 0;
  rows.forEach((row, index) => { const record = parse(row, index); if (record) records.push(record); else rejectedCount++; });
  if (rows.length && !records.length) throw new Error("Snapshot contains no valid records");
  return { records, rejectedCount, invalidCoordinates: 0, invalidDates: 0 };
}

export function parseWahis(input: unknown): ParseResult<WahisRecord> {
  const geo = object(input) && input.type === "FeatureCollection" && Array.isArray(input.features);
  if (!Array.isArray(input) && !geo) throw new Error("Invalid WAHIS snapshot format");
  const rows: unknown[] = Array.isArray(input) ? input : (input as { features: unknown[] }).features;
  const result = parseRows<WahisRecord>(rows, (row, sourceIndex) => {
    let properties = row; let coordinates: unknown[] = [];
    if (geo) {
      if (!object(row) || row.type !== "Feature" || !object(row.geometry) || row.geometry.type !== "Point" || !object(row.properties)) return null;
      properties = row.properties;
      coordinates = Array.isArray(row.geometry.coordinates) ? row.geometry.coordinates : [];
    }
    if (!object(properties)) return null;
    const parsed = wahisSchema.safeParse(properties);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      latitude: position(properties.latitude === undefined ? coordinates[1] : properties.latitude, 90),
      longitude: position(properties.longitude === undefined ? coordinates[0] : properties.longitude, 180),
      event_start_date: validDate(parsed.data.event_start_date) ? parsed.data.event_start_date : null,
      sourceIndex,
    };
  });
  result.invalidCoordinates = result.records.filter((r) => !hasCoordinates(r)).length;
  result.invalidDates = result.records.filter((r) => r.event_start_date === null).length;
  return result;
}

export function parseQaad(input: unknown): ParseResult<QaadDisplayRecord> {
  if (!Array.isArray(input)) throw new Error("Invalid QAAD snapshot format");
  const result = parseRows<QaadDisplayRecord>(input, (row, sourceIndex) => {
    const parsed = qaadSchema.safeParse(row);
    if (!parsed.success || !object(row)) return null;
    return { ...parsed.data, latitude: position(row.latitude, 90), longitude: position(row.longitude, 180), sourceIndex };
  });
  result.invalidCoordinates = result.records.filter((r) => !hasCoordinates(r)).length;
  return result;
}

export function latestWahisEvents(records: WahisRecord[]): WahisRecord[] {
  return [...records].sort((a, b) => (b.event_start_date ?? "").localeCompare(a.event_start_date ?? "") || a.event_id.localeCompare(b.event_id) || a.sourceIndex - b.sourceIndex).slice(0, 8);
}
export const normalizeDiseaseId = (value?: string | null) => value?.trim().toUpperCase() || "OTHER";
export const normalizeStatus = (value?: string | null) => value?.trim() || "unknown";
function diseaseMatches(record: { disease_id: string }, filter: MapDiseaseFilter) {
  const id = normalizeDiseaseId(record.disease_id);
  if (filter.startsWith("source:")) return id === filter.slice(7);
  return filter === "all" || (filter === "other" ? !DISEASE_FILTERS.slice(1, -1).includes(id as DiseaseFilter) : id === filter);
}
export function filterWahis(records: WahisRecord[], disease: MapDiseaseFilter): WahisRecord[] { return records.filter((r) => hasCoordinates(r) && diseaseMatches(r, disease)); }
export function filterQaad(records: QaadDisplayRecord[], disease: MapDiseaseFilter, status: QaadStatusFilter): QaadDisplayRecord[] {
  return records.filter((r) => hasCoordinates(r) && diseaseMatches(r, disease) && (status === "all" || (status === "priority" ? ["present_in_quarter", "historical_presence_in_report_year"].includes(normalizeStatus(r.status_summary)) : normalizeStatus(r.status_summary) === status)));
}
export function computeLayerStats(records: Array<WahisRecord | QaadDisplayRecord>, source: PublicSource): LayerStats {
  const spatial = records.filter(hasCoordinates);
  const countries = [...new Set(spatial.map((r) => source === "wahis" ? (r as WahisRecord).country : (r as QaadDisplayRecord).country_or_territory))];
  const counts = new Map<string, number>();
  spatial.forEach((r) => { const id = normalizeDiseaseId(r.disease_id); counts.set(id, (counts.get(id) ?? 0) + 1); });
  return { recordsDisplayed: spatial.length, countriesCovered: countries.length, countries, topDisease: [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "--" };
}
