import type { Feed } from "./snapshot";

export interface Extent {
  south: number;
  north: number;
  west: number;
  span: number;
}
export interface RangeSummary {
  min: number | null;
  max: number | null;
  valid: number;
  total: number;
  failed: number;
  unit: string;
}

export function longitude(x: number) {
  return ((x + 180) % 360 + 360) % 360 - 180;
}

/** Points are at the centres of nine equal geographic subdivisions of the visible extent. */
export function sampleLocations({ south, north, west, span }: Extent) {
  if (north <= south || span <= 0) return [];
  return [1, 3, 5].flatMap(y => [1, 3, 5].map(x => ({
    lat: south + (north - south) * y / 6,
    lon: longitude(west + span * x / 6),
  })));
}
/** Native half-width in degrees: VIIRS is subsampled by stride 2 but its pixels do not double in size. */
export function nativeCellHalfWidth(id: Feed["id"]) {
  return id === "viirs" ? 0.01875 : id === "heatwave" ? 0.5 : 0.125;
}

function intersectsCell(e: Extent, lat: number, lon: number, half: number) {
  if (e.north <= e.south || e.span <= 0 || lat + half <= e.south || lat - half >= e.north) return false;
  const longitudeDistance = Math.abs(longitude(lon - (e.west + e.span / 2)));
  return longitudeDistance < e.span / 2 + half;
}
export function summarize(values: (number | null)[], unit: string, failed = 0): RangeSummary {
  let min = Infinity, max = -Infinity, valid = 0;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    valid++;
  }
  return { min: valid ? min : null, max: valid ? max : null, valid, total: values.length + failed, failed, unit };
}
export function localRange(feed: Feed, e: Extent, month: number) {
  const half = nativeCellHalfWidth(feed.id);
  if (feed.grid) {
    return summarize(feed.grid.points.filter(([lat, lon]) => intersectsCell(e, lat, lon, half)).map(p => p[2]), feed.grid.unit);
  }
  if (!feed.heatMaps?.[month]) return null;
  const bytes = atob(feed.heatMaps[month]);
  const values: (number | null)[] = [];
  for (let row = Math.max(0, Math.ceil(e.south + 90 - half)); row <= Math.min(180, Math.floor(e.north + 90 + half)); row++) {
    for (let col = 0; col < 360; col++) {
      if (!intersectsCell(e, row - 90, col, half)) continue;
      const value = bytes.charCodeAt(row * 360 + col);
      values.push(value <= 100 ? value : null);
    }
  }
  return summarize(values, "%");
}
