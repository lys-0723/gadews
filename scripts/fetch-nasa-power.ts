import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PARAMETERS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "WS2M"];
const START_DATE = process.env.NASA_POWER_START ?? "20250101";
const END_DATE = process.env.NASA_POWER_END ?? "20250131";
const OUTPUT_PATH = path.join(process.cwd(), "public", "data", "weather-timeseries.json");

interface DemoSite {
  site_id: string;
  site_name: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface NasaPowerResponse {
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
}

interface WeatherTimeseriesRecord {
  site_id: string;
  site_name: string;
  country: string;
  latitude: number;
  longitude: number;
  date: string;
  t2m: number | null;
  t2m_max: number | null;
  t2m_min: number | null;
  air_temperature_range: number | null;
  precipitation: number | null;
  rh2m: number | null;
  ws2m: number | null;
  source: "NASA POWER";
  source_url: string;
}

const SITES: DemoSite[] = [
  {
    site_id: "CN-GD-001",
    site_name: "Guangdong / Guangzhou",
    country: "China",
    latitude: 23.13,
    longitude: 113.26,
  },
  {
    site_id: "CN-ZJ-001",
    site_name: "Guangdong / Zhanjiang",
    country: "China",
    latitude: 21.27,
    longitude: 110.36,
  },
  {
    site_id: "VN-MK-001",
    site_name: "Mekong Delta",
    country: "Viet Nam",
    latitude: 10.04,
    longitude: 105.78,
  },
  {
    site_id: "TH-CT-001",
    site_name: "Chanthaburi",
    country: "Thailand",
    latitude: 12.61,
    longitude: 102.1,
  },
  {
    site_id: "IN-AP-001",
    site_name: "Andhra Pradesh",
    country: "India",
    latitude: 16.51,
    longitude: 80.64,
  },
];

function buildNasaPowerUrl(site: DemoSite): string {
  const searchParams = new URLSearchParams({
    parameters: PARAMETERS.join(","),
    community: "AG",
    longitude: String(site.longitude),
    latitude: String(site.latitude),
    start: START_DATE,
    end: END_DATE,
    format: "JSON",
  });

  return `https://power.larc.nasa.gov/api/temporal/daily/point?${searchParams.toString()}`;
}

function formatDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function normalizeValue(value: number | undefined): number | null {
  if (value === undefined || value === -999) return null;
  return value;
}

function subtractNullable(max: number | null, min: number | null): number | null {
  if (max === null || min === null) return null;
  return Number((max - min).toFixed(2));
}

function convertNasaPowerResponse(
  site: DemoSite,
  sourceUrl: string,
  data: NasaPowerResponse
): WeatherTimeseriesRecord[] {
  const parameters = data.properties?.parameter;
  if (!parameters) {
    throw new Error(`NASA POWER response for ${site.site_id} is missing properties.parameter`);
  }

  const dateKeys = Object.keys(parameters.T2M ?? {}).sort();

  return dateKeys.map((dateKey) => {
    const t2mMax = normalizeValue(parameters.T2M_MAX?.[dateKey]);
    const t2mMin = normalizeValue(parameters.T2M_MIN?.[dateKey]);

    return {
      site_id: site.site_id,
      site_name: site.site_name,
      country: site.country,
      latitude: site.latitude,
      longitude: site.longitude,
      date: formatDate(dateKey),
      t2m: normalizeValue(parameters.T2M?.[dateKey]),
      t2m_max: t2mMax,
      t2m_min: t2mMin,
      air_temperature_range: subtractNullable(t2mMax, t2mMin),
      precipitation: normalizeValue(parameters.PRECTOTCORR?.[dateKey]),
      rh2m: normalizeValue(parameters.RH2M?.[dateKey]),
      ws2m: normalizeValue(parameters.WS2M?.[dateKey]),
      source: "NASA POWER",
      source_url: sourceUrl,
    };
  });
}

async function fetchSiteWeather(site: DemoSite): Promise<WeatherTimeseriesRecord[]> {
  const sourceUrl = buildNasaPowerUrl(site);

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as NasaPowerResponse;
    return convertNasaPowerResponse(site, sourceUrl, json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch NASA POWER data for ${site.site_id}: ${message}`);
  }
}

async function main() {
  const allRecords: WeatherTimeseriesRecord[] = [];

  for (const site of SITES) {
    console.log(`Fetching NASA POWER daily data for ${site.site_id}...`);
    const records = await fetchSiteWeather(site);
    allRecords.push(...records);
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(allRecords, null, 2)}\n`, "utf8");

  console.log(`Wrote ${allRecords.length} records to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
