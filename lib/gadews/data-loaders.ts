import type {
  DataSourceStatus,
  DiseaseEvent,
  DiseaseProfile,
  MonitoringSite,
  WarningEvent,
  WeatherRecord,
} from "./types";

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function loadDiseaseProfiles() {
  return loadJson<DiseaseProfile[]>("/data/disease-profiles.json");
}

export function loadDataSources() {
  return loadJson<DataSourceStatus[]>("/data/data-sources.json");
}

export function loadRiskSites() {
  return loadJson<MonitoringSite[]>("/data/risk-sites.json");
}

export function loadWeatherTimeseries() {
  return loadJson<WeatherRecord[]>("/data/weather-timeseries.json");
}

export function loadOfficialDiseaseEvents() {
  return loadJson<DiseaseEvent[]>("/data/official-disease-events.json");
}

export function loadWarningEvents() {
  return loadJson<WarningEvent[]>("/data/warning-events.json");
}
