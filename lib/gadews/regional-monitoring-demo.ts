export type RegionalDemoSiteId = "A" | "B";
export type RegionalDemoRadius = 3000 | 5000;
export type RegionalDemoGroup = "same" | "other" | "unknown";

type DemoWaterSystem = "W1" | "W2";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface DemoSite extends Coordinates {
  id: RegionalDemoSiteId;
  waterSystem: DemoWaterSystem;
}

interface DemoObservation extends Coordinates {
  id: string;
  observedOn: string;
  kind: "health-check" | "water-quality";
  waterSystem: DemoWaterSystem | null;
}

interface ClassifiedObservation extends DemoObservation {
  group: RegionalDemoGroup;
  distanceMeters: number;
}

// The open-Pacific locations and water-system labels are fictional.
export const REGIONAL_DEMO_SITES: readonly DemoSite[] = [
  { id: "A", latitude: 0, longitude: -140, waterSystem: "W1" },
  { id: "B", latitude: 0, longitude: -139.8, waterSystem: "W2" },
];

const observations: readonly DemoObservation[] = [
  { id: "A-01", observedOn: "2025-05-03", kind: "health-check", latitude: -0.01, longitude: -140.006, waterSystem: "W1" },
  { id: "A-02", observedOn: "2025-05-05", kind: "water-quality", latitude: 0.011, longitude: -139.982, waterSystem: "W2" },
  { id: "A-03", observedOn: "2025-05-08", kind: "health-check", latitude: 0.026979648177561915, longitude: -140, waterSystem: null },
  { id: "A-04", observedOn: "2025-05-11", kind: "water-quality", latitude: -0.026984145, longitude: -140, waterSystem: "W1" },
  { id: "A-05", observedOn: "2025-05-14", kind: "health-check", latitude: -0.04496608029593653, longitude: -140, waterSystem: "W2" },
  { id: "A-06", observedOn: "2025-05-17", kind: "water-quality", latitude: 0.044970577, longitude: -140, waterSystem: "W1" },
  { id: "B-01", observedOn: "2025-05-02", kind: "water-quality", latitude: 0.005, longitude: -139.799, waterSystem: "W2" },
  { id: "B-02", observedOn: "2025-05-04", kind: "health-check", latitude: -0.012, longitude: -139.813, waterSystem: null },
  { id: "B-03", observedOn: "2025-05-06", kind: "water-quality", latitude: -0.021, longitude: -139.809, waterSystem: "W1" },
  { id: "B-04", observedOn: "2025-05-09", kind: "health-check", latitude: -0.028, longitude: -139.79, waterSystem: "W1" },
  { id: "B-05", observedOn: "2025-05-12", kind: "water-quality", latitude: 0.01, longitude: -139.76, waterSystem: "W2" },
  { id: "B-06", observedOn: "2025-05-15", kind: "health-check", latitude: 0.023, longitude: -139.827, waterSystem: null },
];

function distanceInMeters(a: Coordinates, b: Coordinates) {
  // Match the spherical Earth radius used by Leaflet for metre-based circles.
  const earthRadiusMeters = 6_371_000;
  const radians = Math.PI / 180;
  const halfLatitude = (b.latitude - a.latitude) * radians / 2;
  const halfLongitude = (b.longitude - a.longitude) * radians / 2;
  const haversine = Math.sin(halfLatitude) ** 2
    + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(halfLongitude) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getRegionalDemoSummary(siteId: RegionalDemoSiteId, radiusMeters: RegionalDemoRadius) {
  const site = REGIONAL_DEMO_SITES.find(candidate => candidate.id === siteId);
  if (!site) throw new RangeError("Unknown regional monitoring demo site");
  const counts: Record<RegionalDemoGroup, number> = { same: 0, other: 0, unknown: 0 };
  const records: ClassifiedObservation[] = [];

  for (const observation of observations) {
    const distanceMeters = distanceInMeters(site, observation);
    if (distanceMeters > radiusMeters) continue;
    let group: RegionalDemoGroup = "unknown";
    if (observation.waterSystem !== null) {
      group = observation.waterSystem === site.waterSystem ? "same" : "other";
    }
    counts[group] += 1;
    records.push({ ...observation, group, distanceMeters });
  }
  records.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return { site, radiusMeters, counts, records };
}
