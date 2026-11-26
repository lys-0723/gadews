export interface AquacultureDeviceConfig {
  key: string;
  upstreamDeviceId: string;
  siteId: string;
  pondId: string | null;
  name: string;
  enabled: boolean;
}

export interface RichLinkSettings {
  baseUrl: string;
  appId: string;
  publicKey: string;
  allowInsecureHttp: boolean;
  timeoutMs: number;
  pageLimit: number;
  initialLookbackDays: number;
  pollIntervalSeconds: number;
  timeZone: string;
  devices: AquacultureDeviceConfig[];
}

export interface RichLinkApiEnvelope<T> {
  code: number;
  data: T;
  msg?: string;
  timestamp?: number;
  count?: number | null;
}

export interface RichLinkControlItem {
  groupIdx?: string | null;
  typeCode: string;
  typeName: string;
  unit?: string | null;
  unitName?: string | null;
  id?: string;
}

export interface RichLinkHistoryRow {
  ts: number | string;
  [key: string]: unknown;
}

export interface RichLinkMetricMapping {
  waterTemperatureCode: string | null;
  dissolvedOxygenCode: string | null;
  phCode: string | null;
}

export interface AquacultureObservation {
  deviceKey: string;
  siteId: string;
  pondId: string | null;
  observedAt: Date;
  waterTemperatureC: number | null;
  dissolvedOxygenMgL: number | null;
  ph: number | null;
  qualityFlags: string[];
  rawPayload: RichLinkHistoryRow;
}

export interface AquacultureObservationRecord {
  deviceKey: string;
  siteId: string;
  pondId: string | null;
  observedAt: string;
  waterTemperatureC: number | null;
  dissolvedOxygenMgL: number | null;
  ph: number | null;
  qualityFlags: string[];
  ingestedAt: string;
}

export interface AquacultureDeviceRecord {
  key: string;
  siteId: string;
  pondId: string | null;
  name: string;
  enabled: boolean;
  latestObservationAt: string | null;
}

export interface DeviceCollectionResult {
  deviceKey: string;
  siteId: string;
  pondId: string | null;
  startDate: string;
  endDate: string;
  fetched: number;
  normalized: number;
  inserted: number;
  skipped: number;
  mapping: RichLinkMetricMapping;
}
