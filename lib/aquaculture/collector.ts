import type { Pool } from "pg";
import { getRichLinkSettings } from "./config";
import { resolveCollectionDateRange } from "./dates";
import { UnknownAquacultureDeviceError } from "./errors";
export { validateDate, formatDateInTimeZone } from "./dates";
import {
  getAquaculturePool,
  getLatestObservationTimestamp,
  initializeAquacultureSchema,
  insertAquacultureObservations,
  upsertAquacultureDevice,
} from "./database";
import { discoverMetricMapping, normalizeRichLinkHistoryRow } from "./normalize";
import { RichLinkClient } from "./rich-link-client";
import type {
  AquacultureDeviceConfig,
  DeviceCollectionResult,
  RichLinkHistoryRow,
  RichLinkSettings,
} from "./types";

export interface CollectionOptions {
  deviceKey?: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
}


export async function collectConfiguredDevices(
  options: CollectionOptions = {},
  settings: RichLinkSettings = getRichLinkSettings(),
  pool?: Pool
): Promise<DeviceCollectionResult[]> {
  const devices = settings.devices.filter(
    (device) =>
      device.enabled && (!options.deviceKey || device.key === options.deviceKey)
  );
  if (options.deviceKey && devices.length === 0) {
    throw new UnknownAquacultureDeviceError();
  }

  const activePool = pool ?? getAquaculturePool();
  await initializeAquacultureSchema(activePool);
  const client = new RichLinkClient(settings);
  const results: DeviceCollectionResult[] = [];
  for (const device of devices) {
    results.push(
      await collectDevice(device, client, settings, activePool, options)
    );
  }
  return results;
}

async function collectDevice(
  device: AquacultureDeviceConfig,
  client: RichLinkClient,
  settings: RichLinkSettings,
  pool: Pool,
  options: CollectionOptions
): Promise<DeviceCollectionResult> {
  await upsertAquacultureDevice(device, pool);

  const now = options.now ?? new Date();
  const latestObservation = await getLatestObservationTimestamp(device.key, pool);
  const { startDate, endDate } = resolveCollectionDateRange({
    startDate: options.startDate,
    endDate: options.endDate,
    latestObservation,
    now,
    timeZone: settings.timeZone,
    initialLookbackDays: settings.initialLookbackDays,
  });

  const items = await client.getControlItems(device.upstreamDeviceId);
  const mapping = discoverMetricMapping(items);
  if (
    !mapping.waterTemperatureCode &&
    !mapping.dissolvedOxygenCode &&
    !mapping.phCode
  ) {
    throw new Error(`No supported monitoring items found for device ${device.key}`);
  }

  const rows = await fetchAllHistory(
    client,
    device.upstreamDeviceId,
    startDate,
    endDate,
    settings.pageLimit
  );
  const observations = [];
  let skipped = 0;

  for (const row of rows) {
    try {
      observations.push(normalizeRichLinkHistoryRow(row, device, mapping));
    } catch {
      skipped += 1;
    }
  }

  const inserted = await insertAquacultureObservations(observations, pool);
  return {
    deviceKey: device.key,
    siteId: device.siteId,
    pondId: device.pondId,
    startDate,
    endDate,
    fetched: rows.length,
    normalized: observations.length,
    inserted,
    skipped,
    mapping,
  };
}

async function fetchAllHistory(
  client: RichLinkClient,
  upstreamDeviceId: string,
  startDate: string,
  endDate: string,
  limit: number
): Promise<RichLinkHistoryRow[]> {
  const rows: RichLinkHistoryRow[] = [];
  let page = 1;

  while (page <= 10_000) {
    const response = await client.getHistory(upstreamDeviceId, {
      page,
      limit,
      startTime: startDate,
      endTime: endDate,
    });
    rows.push(...response.data);

    const total = typeof response.count === "number" ? response.count : null;
    if (
      response.data.length === 0 ||
      response.data.length < limit ||
      (total !== null && rows.length >= total)
    ) {
      return rows;
    }
    page += 1;
  }

  throw new Error("Rich-Link pagination exceeded the 10,000-page safety limit");
}
