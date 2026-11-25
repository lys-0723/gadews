import type {
  AquacultureDeviceConfig,
  AquacultureObservation,
  RichLinkControlItem,
  RichLinkHistoryRow,
  RichLinkMetricMapping,
} from "./types";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function discoverMetricMapping(
  items: RichLinkControlItem[]
): RichLinkMetricMapping {
  let waterTemperatureCode: string | null = null;
  let dissolvedOxygenCode: string | null = null;
  let phCode: string | null = null;

  for (const item of items) {
    const label = normalizeLabel(item.typeName ?? "");
    if (!waterTemperatureCode && (label.includes("温度") || label.includes("temperature"))) {
      waterTemperatureCode = item.typeCode;
    }
    if (
      !dissolvedOxygenCode &&
      (label.includes("溶解氧") || label.includes("溶氧") || label === "do")
    ) {
      dissolvedOxygenCode = item.typeCode;
    }
    if (!phCode && (label === "ph" || label.includes("酸碱"))) {
      phCode = item.typeCode;
    }
  }

  return { waterTemperatureCode, dissolvedOxygenCode, phCode };
}

function parseMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseObservedAt(value: unknown): Date {
  const numeric = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid Rich-Link timestamp: ${String(value)}`);
  }
  const milliseconds = numeric < 100_000_000_000 ? numeric * 1_000 : numeric;
  const observedAt = new Date(milliseconds);
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error(`Invalid Rich-Link timestamp: ${String(value)}`);
  }
  return observedAt;
}

function addQualityFlags(
  waterTemperatureC: number | null,
  dissolvedOxygenMgL: number | null,
  ph: number | null
): string[] {
  const flags: string[] = [];

  if (waterTemperatureC === null) flags.push("missing_water_temperature");
  else if (waterTemperatureC < -5 || waterTemperatureC > 50) {
    flags.push("water_temperature_out_of_range");
  }

  if (dissolvedOxygenMgL === null) flags.push("missing_dissolved_oxygen");
  else if (dissolvedOxygenMgL < 0 || dissolvedOxygenMgL > 30) {
    flags.push("dissolved_oxygen_out_of_range");
  }

  if (ph === null) flags.push("missing_ph");
  else if (ph < 0 || ph > 14) flags.push("ph_out_of_range");

  return flags;
}

export function normalizeRichLinkHistoryRow(
  row: RichLinkHistoryRow,
  device: AquacultureDeviceConfig,
  mapping: RichLinkMetricMapping
): AquacultureObservation {
  const waterTemperatureC = mapping.waterTemperatureCode
    ? parseMetric(row[mapping.waterTemperatureCode])
    : null;
  const dissolvedOxygenMgL = mapping.dissolvedOxygenCode
    ? parseMetric(row[mapping.dissolvedOxygenCode])
    : null;
  const ph = mapping.phCode ? parseMetric(row[mapping.phCode]) : null;

  return {
    deviceKey: device.key,
    siteId: device.siteId,
    pondId: device.pondId,
    observedAt: parseObservedAt(row.ts),
    waterTemperatureC,
    dissolvedOxygenMgL,
    ph,
    qualityFlags: addQualityFlags(waterTemperatureC, dissolvedOxygenMgL, ph),
    rawPayload: row,
  };
}
