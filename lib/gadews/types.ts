export type AlertLevel = "low" | "moderate" | "high" | "critical";

export interface RiskFactor {
  id: string;
  label: string;
  category: "environment" | "water_quality" | "proximity" | "pathogen_signal" | "operations";
  value: number | boolean | string | null;
  unit?: string;
  weight?: number;
  source: string;
  source_url: string;
  demo_note?: string;
}

export interface DiseaseProfile {
  id: string;
  name: string;
  common_name: string;
  monitored_species: string[];
  risk_factors: RiskFactor[];
  description: string;
  source: string;
  source_url: string;
  demo_note: string;
}

export interface DiseaseEvent {
  id: string;
  disease_id: string;
  site_id: string;
  event_date: string;
  alert_level: AlertLevel;
  status: "demo_observation" | "watch" | "resolved";
  summary: string;
  latitude: number;
  longitude: number;
  source: string;
  source_url: string;
  demo_note: string;
}

export interface WeatherRecord {
  id: string;
  site_id: string;
  recorded_at: string;
  temperature_c: number;
  salinity_ppt: number;
  dissolved_oxygen_mg_l: number;
  ammonia_mg_l: number;
  rainfall_mm_24h: number;
  source: string;
  source_url: string;
  demo_note: string;
}

export interface MonitoringSite {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  species: string[];
  site_type: "pond" | "coastal_zone" | "hatchery" | "research_station";
  source: string;
  source_url: string;
  demo_note: string;
}

export interface RiskAssessment {
  disease: string;
  riskScore: number;
  alertLevel: AlertLevel;
  triggeredRules: string[];
  mainDrivers: string[];
  recommendations: {
    managerRecommendations: string[];
    farmerRecommendations: string[];
  };
  confidence: number;
}

export interface WarningEvent {
  id: string;
  disease_id: string;
  site_id: string;
  alert_level: AlertLevel;
  risk_score: number;
  title: string;
  summary: string;
  triggered_rules: string[];
  issued_at: string;
  source: string;
  source_url: string;
  demo_note: string;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  type: "sensor" | "weather" | "map_layer" | "literature" | "official_feed" | "manual_demo";
  status: "online" | "delayed" | "offline" | "demo";
  last_updated: string;
  record_count: number;
  completeness_percent: number;
  source: string;
  source_url: string;
  demo_note: string;
}

export interface LiteratureRecord {
  id: string;
  title: string;
  authors: string[];
  year: number;
  collection: string;
  category: string;
  doi?: string;
  abstract?: string;
  source: string;
  source_url: string;
  demo_note?: string;
}
