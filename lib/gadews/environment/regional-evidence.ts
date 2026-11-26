import {
  feedIds,
  overdue,
  sitesFor,
  station,
  type Feed,
  type FeedId,
  type Site,
  type Snapshot,
} from "./snapshot";

const periodProducts = new Set<FeedId>(["heatwave", "ec46", "seas5"]);
const primaryFields: Partial<Record<FeedId, string>> = {
  weather: "precipitation",
  gefs: "precipitation_sum_p50",
  power: "PRECTOTCORR",
};

function applicableOnDay(id: FeedId, site: Site) {
  return sitesFor(id).includes(site) && !periodProducts.has(id);
}

function utcDay(asOf: number) {
  return new Date(asOf).toISOString().slice(0, 10);
}

export function regionalDates(snapshot: Snapshot, site: Site, asOf: number) {
  const days = new Set([utcDay(asOf)]);
  for (const f of snapshot.feeds.filter(f => applicableOnDay(f.id, site))) {
    const s = f.series.find(item => item.site === site);
    for (const time of s?.times ?? []) days.add(time.slice(0, 10));
    if (f.imageryTime && f.frames?.some(frame => frame.site === site)) days.add(f.imageryTime.slice(0, 10));
  }
  return [...days].sort();
}

export function effectiveRegionalDay(days: readonly string[], requested: string | null, asOf: number) {
  return requested && days.includes(requested) ? requested : utcDay(asOf);
}

/** Only expose the layer when its published raster period contains the selected UTC day. */
export function regionalLayerTime(feed: Feed | undefined, day: string) {
  if (!feed || feed.state === "unavailable") return undefined;
  if (feed.id === "heatwave") return feed.series[0]?.times.find(t => t.slice(0, 7) === day.slice(0, 7));
  const time = feed.grid?.time ?? feed.raster?.time;
  return time?.slice(0, 10) === day ? time : undefined;
}

type Gap = { id: FeedId; reason: "unavailable" | "date" | "missing" | "no-rate-class"; lastDay?: string };
export type EvidenceReading = {
  id: FeedId;
  variable: string;
  unit: string;
  low: number;
  high: number | null;
  interval?: boolean;
  count: number;
  total: number;
  first: string;
  last: string;
  lat: number;
  lon: number;
  depth: number | null;
  source: string;
  old: boolean;
};

/** Outlook values belong to the full forecast week or month, even when a single day is selected. */
function periodOutlooks(snapshot: Snapshot, site: Site, day: string, asOf: number) {
  const outlooks: EvidenceReading[] = [];
  for (const feed of snapshot.feeds) {
    if (!periodProducts.has(feed.id) || feed.state === "unavailable") continue;
    const series = feed.series.find(s => s.site === site);
    if (!series) continue;
    for (const [index, time] of series.times.entries()) {
      const start = time.slice(0, 10);
      if (start > day) continue;
      const next = new Date(start + "T00:00:00Z");
      if (feed.id === "ec46") next.setUTCDate(next.getUTCDate() + 7);
      else next.setUTCMonth(next.getUTCMonth() + 1, 1);
      if (day >= utcDay(next.getTime())) continue;
      const end = utcDay(next.getTime() - 86400000);
      for (const field of series.fields) {
        const value = field.values[index];
        if (value == null) continue;
        outlooks.push({id: feed.id, variable: field.key, unit: field.unit, low: value, high: value,
          count: 1, total: 1, first: start, last: end, lat: series.lat, lon: series.lon, depth: series.depthM,
          source: series.source, old: overdue(feed, asOf)});
      }
      break;
    }
  }
  return outlooks;
}

export function regionalEvidence(snapshot: Snapshot, site: Site, day: string, asOf: number) {
  const readings: EvidenceReading[] = [];
  const gaps: Gap[] = [];
  const today = utcDay(asOf);
  const outlooks = periodOutlooks(snapshot, site, day, asOf);
  let hasEarlier = false;
  for (const id of feedIds.filter(key => applicableOnDay(key, site))) {
    const f = snapshot.feeds.find(feed => feed.id === id);
    if (!f || f.state === "unavailable") {
      gaps.push({id, reason: "unavailable"});
      continue;
    }
    const old = overdue(f, asOf);
    if (id === "imerg") {
      const stamp = f.imageryTime;
      const frame = f.frames?.find(item => item.site === site);
      if (!stamp || !frame) {
        gaps.push({id, reason: "unavailable"});
        continue;
      }
      const imageDay = stamp.slice(0, 10);
      if (frame.rate && imageDay < day) hasEarlier = true;
      if (imageDay !== day || !frame.rate) {
        gaps.push({id, reason: imageDay === day ? "no-rate-class" : "date", lastDay: imageDay});
        continue;
      }
      const [phase, low, high] = frame.rate;
      const [, , lat, lon] = station[site];
      readings.push({id, variable: phase, unit: "mm/h", low, high, interval: true, count: 1, total: 1,
        first: stamp, last: stamp, lat, lon, depth: null, source: frame.url, old});
      continue;
    }
    const series = f.series.find(item => item.site === site);
    if (!series || !series.fields.length) {
      gaps.push({id, reason: "unavailable"});
      continue;
    }
    const indices = series.times.flatMap((time, i) => time.slice(0, 10) === day ? [i] : []);
    const preferred = series.fields.find(v => v.key === primaryFields[id]);
    const field = preferred && indices.some(i => preferred.values[i] !== null)
      ? preferred : series.fields.find(v => indices.some(i => v.values[i] !== null));
    const validIndices = field ? indices.filter(i => field.values[i] !== null) : [];
    const values = validIndices.map(i => field!.values[i]!);
    if (series.times.some((time,i) => time.slice(0, 10) < day && series.fields.some(v => v.values[i] !== null))) hasEarlier = true;
    if (!field || !values.length) {
      gaps.push({id, reason: indices.length ? "missing" : "date", lastDay: series.times.at(-1)?.slice(0,10)});
      continue;
    }
    readings.push({
      id, variable: field.key, unit: field.unit, low: Math.min(...values), high: Math.max(...values),
      count: values.length, total: indices.length, first: series.times[validIndices[0]],
      last: series.times[validIndices[validIndices.length - 1]], lat: series.lat, lon: series.lon, depth: series.depthM,
      source: series.source, old,
    });
  }
  const valid = readings.filter(row => !row.old).length;
  let state: "archived" | "forecast" | "dated" | "outlook" | "historical" | "insufficient" = "insufficient";
  if (day < today && readings.length) state = "archived";
  else if (valid) state = day > today ? "forecast" : "dated";
  else if (outlooks.some(row => !row.old)) state = "outlook";
  else if (day <= today && hasEarlier && !readings.length) state = "historical";
  return {readings, gaps, outlooks, state, valid} as const;
}
