import { DISEASE_FILTERS, hasCoordinates, normalizeDiseaseId, type DiseaseFilter, type WahisRecord } from "./public-surveillance";

export interface GlobeReportGroup { id: string; latitude: number; longitude: number; reports: WahisRecord[] }
export interface Rect { left: number; top: number; right: number; bottom: number }

/** Unlike map filtering, this preserves records with no usable coordinates for the accessible list. */
export function filterGlobeReports(records: WahisRecord[], filter: DiseaseFilter): WahisRecord[] {
  return records.filter(record => {
    const id = normalizeDiseaseId(record.disease_id);
    return filter === "all" || (filter === "other" ? !DISEASE_FILTERS.slice(1, -1).includes(id as DiseaseFilter) : id === filter);
  });
}
export function groupGlobeReports(records: WahisRecord[], filter: DiseaseFilter): GlobeReportGroup[] {
  const groups = new Map<string, GlobeReportGroup>();
  for (const record of filterGlobeReports(records, filter)) {
    if (!hasCoordinates(record)) continue;
    const id = `${record.latitude === 0 ? 0 : record.latitude},${record.longitude === 0 ? 0 : record.longitude}`;
    const group = groups.get(id) ?? { id, latitude: record.latitude, longitude: record.longitude, reports: [] };
    group.reports.push(record); groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)).map(group => ({ ...group, reports: group.reports.sort((a, b) => a.event_id.localeCompare(b.event_id) || a.sourceIndex - b.sourceIndex) }));
}
/** Coordinates are in a common viewport space; an unavailable position never displaces content. */
export function placeGlobeLabel(candidate: Rect, occupied: Rect[], bounds: Rect, gap = 8): Rect | null {
  const { left, right, top, bottom } = candidate;
  if (![left, right, top, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null;
  if (left < bounds.left || right > bounds.right || top < bounds.top || bottom > bounds.bottom) return null;
  if (occupied.some(rect => left < rect.right + gap && right > rect.left - gap && top < rect.bottom + gap && bottom > rect.top - gap)) return null;
  return candidate;
}
/** Matches Three's default SphereGeometry UVs and NASA equirectangular imagery. */
export function globeLocation(latitude: number, longitude: number, radius = 1.617) {
  const lat = latitude * Math.PI / 180; const lon = longitude * Math.PI / 180;
  return { x: radius * Math.cos(lat) * Math.cos(lon), y: radius * Math.sin(lat), z: -radius * Math.cos(lat) * Math.sin(lon) };
}
export function officialReportUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["wahis.woah.org", "wahis.oie.int"].includes(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
