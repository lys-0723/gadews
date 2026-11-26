import {
  hasCoordinates, normalizeDiseaseId,
  type LayerStats, type QaadDisplayRecord, type WahisRecord,
} from "./public-surveillance";

export interface HistoryScope {
  country: string;
  year: string;
  quarter: string;
  from: string;
  to: string;
}

export const allHistory: HistoryScope = { country: "", year: "", quarter: "", from: "", to: "" };

function inPeriod(year: string, quarter: string, scope: HistoryScope) {
  return (!scope.year || year === scope.year) && (!scope.quarter || quarter === scope.quarter);
}

export function matchesWahisScope(record: WahisRecord, scope: HistoryScope) {
  const date = record.event_start_date;
  const quarter = date ? String(Math.ceil(Number(date.slice(5, 7)) / 3)) : "";
  return (!scope.country || record.country === scope.country) &&
    inPeriod(date?.slice(0, 4) ?? "", quarter, scope) &&
    (!scope.from || (date !== null && date >= scope.from)) &&
    (!scope.to || (date !== null && date <= scope.to));
}

function qaadPeriod(record: QaadDisplayRecord) {
  // Prefer the published period. An annual report has no quarter.
  const period = record.report_period?.trim().match(/^(\d{4})(?:\s*[- ]?\s*Q([1-4]))?$/i);
  return {
    year: period?.[1] ?? String(record.year ?? ""),
    quarter: period ? (period[2] ?? "") : (String(record.quarter ?? "").match(/^Q?([1-4])$/i)?.[1] ?? ""),
  };
}

export function matchesQaadScope(record: QaadDisplayRecord, scope: HistoryScope) {
  const {year, quarter} = qaadPeriod(record);
  return (!scope.country || record.country_or_territory === scope.country) && inPeriod(year, quarter, scope);
}

export interface HistoryEntry {
  country: string;
  date: string;
  year: string;
  disease: string;
  name: string;
  url?: string | null;
  status?: string | null;
  center: [number, number] | null;
}

export const wahisEntry = (r: WahisRecord): HistoryEntry => ({
  country: r.country, date: r.event_start_date ?? "", year: r.event_start_date?.slice(0, 4) ?? "",
  disease: normalizeDiseaseId(r.disease_id), name: r.disease_name, url: r.last_report_url || r.dashboard_url,
  center: hasCoordinates(r) ? [r.latitude, r.longitude] : null,
});

export const qaadEntry = (r: QaadDisplayRecord): HistoryEntry => ({
  country: r.country_or_territory, date: r.report_period ?? "", year: qaadPeriod(r).year,
  disease: normalizeDiseaseId(r.disease_id), name: r.disease_name, url: r.report_file_urls?.[0] ?? r.source_urls?.[0],
  status: r.status_summary ?? "unknown", center: hasCoordinates(r) ? [r.latitude, r.longitude] : null,
});

export function historyOptions(entries: HistoryEntry[]) {
  const locations = new Map<string, [number, number]>();
  const years = new Set<string>();
  const diseases = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.center) continue;
    if (!locations.has(entry.country)) locations.set(entry.country, entry.center);
    if (entry.year) years.add(entry.year);
    diseases.set(entry.disease, entry.name);
  }
  return { locations, years, diseases };
}

export type HistoryOptions = ReturnType<typeof historyOptions>;
export interface HistoryStats extends LayerStats {
  options?: HistoryOptions;
  entries?: HistoryEntry[];
}
