import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type {
  AquacultureDeviceConfig,
  AquacultureDeviceRecord,
  AquacultureObservation,
  AquacultureObservationRecord,
} from "./types";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS aquaculture_devices (
  device_key TEXT PRIMARY KEY,
  upstream_device_id TEXT NOT NULL UNIQUE,
  site_id TEXT NOT NULL,
  pond_id TEXT,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'rich-link',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS aquaculture_observations (
  device_key TEXT NOT NULL REFERENCES aquaculture_devices(device_key) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  pond_id TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  water_temperature_c DOUBLE PRECISION,
  dissolved_oxygen_mg_l DOUBLE PRECISION,
  ph DOUBLE PRECISION,
  quality_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source TEXT NOT NULL DEFAULT 'rich-link',
  raw_payload JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_key, observed_at)
);

CREATE INDEX IF NOT EXISTS aquaculture_observations_site_time_idx
  ON aquaculture_observations (site_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS aquaculture_observations_pond_time_idx
  ON aquaculture_observations (pond_id, observed_at DESC)
  WHERE pond_id IS NOT NULL;
`;

interface ObservationRow extends QueryResultRow {
  device_key: string;
  site_id: string;
  pond_id: string | null;
  observed_at: Date;
  water_temperature_c: number | null;
  dissolved_oxygen_mg_l: number | null;
  ph: number | null;
  quality_flags: string[];
  ingested_at: Date;
}

interface DeviceRow extends QueryResultRow {
  device_key: string;
  site_id: string;
  pond_id: string | null;
  name: string;
  enabled: boolean;
  latest_observation_at: Date | null;
}

interface HealthRow extends QueryResultRow {
  database_time: Date;
  device_count: string;
  observation_count: string;
  latest_observation_at: Date | null;
}

interface GlobalWithPool {
  gadewsAquaculturePool?: Pool;
}

const globalWithPool = globalThis as typeof globalThis & GlobalWithPool;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function getAquaculturePool(): Pool {
  if (globalWithPool.gadewsAquaculturePool) {
    return globalWithPool.gadewsAquaculturePool;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  const useSsl = parseBoolean(process.env.DATABASE_SSL, false);
  const rejectUnauthorized = parseBoolean(
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    true
  );

  const pool = new Pool({
    connectionString,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: useSsl ? { rejectUnauthorized } : undefined,
  });

  if (process.env.NODE_ENV !== "production") {
    globalWithPool.gadewsAquaculturePool = pool;
  }
  return pool;
}

export async function initializeAquacultureSchema(
  pool: Pool = getAquaculturePool()
): Promise<void> {
  await pool.query(SCHEMA_SQL);
}

export async function upsertAquacultureDevice(
  device: AquacultureDeviceConfig,
  pool: Pool | PoolClient = getAquaculturePool()
): Promise<void> {
  await pool.query(
    `
      INSERT INTO aquaculture_devices (
        device_key,
        upstream_device_id,
        site_id,
        pond_id,
        name,
        enabled,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (device_key) DO UPDATE SET
        upstream_device_id = EXCLUDED.upstream_device_id,
        site_id = EXCLUDED.site_id,
        pond_id = EXCLUDED.pond_id,
        name = EXCLUDED.name,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `,
    [
      device.key,
      device.upstreamDeviceId,
      device.siteId,
      device.pondId,
      device.name,
      device.enabled,
    ]
  );
}

export async function getLatestObservationTimestamp(
  deviceKey: string,
  pool: Pool = getAquaculturePool()
): Promise<Date | null> {
  const result = await pool.query<{ observed_at: Date }>(
    `
      SELECT observed_at
      FROM aquaculture_observations
      WHERE device_key = $1
      ORDER BY observed_at DESC
      LIMIT 1
    `,
    [deviceKey]
  );
  return result.rows[0]?.observed_at ?? null;
}

export async function insertAquacultureObservations(
  observations: AquacultureObservation[],
  pool: Pool = getAquaculturePool()
): Promise<number> {
  if (observations.length === 0) return 0;

  const client = await pool.connect();
  let inserted = 0;

  try {
    await client.query("BEGIN");
    const chunkSize = 500;

    for (let offset = 0; offset < observations.length; offset += chunkSize) {
      const chunk = observations.slice(offset, offset + chunkSize);
      const values: unknown[] = [];
      const placeholders = chunk.map((observation, index) => {
        const parameter = index * 9;
        values.push(
          observation.deviceKey,
          observation.siteId,
          observation.pondId,
          observation.observedAt,
          observation.waterTemperatureC,
          observation.dissolvedOxygenMgL,
          observation.ph,
          observation.qualityFlags,
          JSON.stringify(observation.rawPayload)
        );
        return `($${parameter + 1}, $${parameter + 2}, $${parameter + 3}, $${
          parameter + 4
        }::timestamptz, $${parameter + 5}, $${parameter + 6}, $${
          parameter + 7
        }, $${parameter + 8}::text[], $${parameter + 9}::jsonb)`;
      });

      const sql = `
        INSERT INTO aquaculture_observations (
          device_key,
          site_id,
          pond_id,
          observed_at,
          water_temperature_c,
          dissolved_oxygen_mg_l,
          ph,
          quality_flags,
          raw_payload
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (device_key, observed_at) DO NOTHING
        RETURNING 1
      `;

      const result = await client.query(sql, values);
      inserted += result.rowCount ?? 0;
    }

    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface ObservationQuery {
  deviceKey?: string;
  siteId?: string;
  pondId?: string;
  from?: Date;
  to?: Date;
  limit: number;
}

export async function queryAquacultureObservations(
  query: ObservationQuery,
  pool: Pool = getAquaculturePool()
): Promise<AquacultureObservationRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const addCondition = (sql: string, value: unknown) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  if (query.deviceKey) addCondition("device_key = ?", query.deviceKey);
  if (query.siteId) addCondition("site_id = ?", query.siteId);
  if (query.pondId) addCondition("pond_id = ?", query.pondId);
  if (query.from) addCondition("observed_at >= ?", query.from);
  if (query.to) addCondition("observed_at <= ?", query.to);

  values.push(query.limit);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<ObservationRow>(
    `
      SELECT
        device_key,
        site_id,
        pond_id,
        observed_at,
        water_temperature_c,
        dissolved_oxygen_mg_l,
        ph,
        quality_flags,
        ingested_at
      FROM aquaculture_observations
      ${where}
      ORDER BY observed_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows.map(mapObservationRow);
}

export async function queryLatestAquacultureObservations(
  siteId?: string,
  pool: Pool = getAquaculturePool()
): Promise<AquacultureObservationRecord[]> {
  const values: unknown[] = [];
  const where = siteId ? "WHERE site_id = $1" : "";
  if (siteId) values.push(siteId);

  const result = await pool.query<ObservationRow>(
    `
      SELECT *
      FROM (
        SELECT DISTINCT ON (device_key)
          device_key,
          site_id,
          pond_id,
          observed_at,
          water_temperature_c,
          dissolved_oxygen_mg_l,
          ph,
          quality_flags,
          ingested_at
        FROM aquaculture_observations
        ${where}
        ORDER BY device_key, observed_at DESC
      ) latest
      ORDER BY observed_at DESC
    `,
    values
  );

  return result.rows.map(mapObservationRow);
}

export async function queryAquacultureDevices(
  pool: Pool = getAquaculturePool()
): Promise<AquacultureDeviceRecord[]> {
  const result = await pool.query<DeviceRow>(`
    SELECT
      devices.device_key,
      devices.site_id,
      devices.pond_id,
      devices.name,
      devices.enabled,
      latest.latest_observation_at
    FROM aquaculture_devices devices
    LEFT JOIN LATERAL (
      SELECT observed_at AS latest_observation_at
      FROM aquaculture_observations observations
      WHERE observations.device_key = devices.device_key
      ORDER BY observed_at DESC
      LIMIT 1
    ) latest ON TRUE
    ORDER BY devices.site_id, devices.pond_id NULLS FIRST, devices.device_key
  `);

  return result.rows.map((row) => ({
    key: row.device_key,
    siteId: row.site_id,
    pondId: row.pond_id,
    name: row.name,
    enabled: row.enabled,
    latestObservationAt: row.latest_observation_at?.toISOString() ?? null,
  }));
}

export async function getAquacultureDatabaseHealth(
  pool: Pool = getAquaculturePool()
) {
  const result = await pool.query<HealthRow>(`
    SELECT
      NOW() AS database_time,
      (SELECT COUNT(*) FROM aquaculture_devices) AS device_count,
      (SELECT COUNT(*) FROM aquaculture_observations) AS observation_count,
      (SELECT MAX(observed_at) FROM aquaculture_observations) AS latest_observation_at
  `);
  const row = result.rows[0];
  return {
    databaseTime: row.database_time.toISOString(),
    deviceCount: Number(row.device_count),
    observationCount: Number(row.observation_count),
    latestObservationAt: row.latest_observation_at?.toISOString() ?? null,
  };
}

export async function closeAquaculturePool(): Promise<void> {
  const pool = globalWithPool.gadewsAquaculturePool;
  if (pool) {
    delete globalWithPool.gadewsAquaculturePool;
    await pool.end();
  }
}

function mapObservationRow(row: ObservationRow): AquacultureObservationRecord {
  return {
    deviceKey: row.device_key,
    siteId: row.site_id,
    pondId: row.pond_id,
    observedAt: row.observed_at.toISOString(),
    waterTemperatureC: row.water_temperature_c,
    dissolvedOxygenMgL: row.dissolved_oxygen_mg_l,
    ph: row.ph,
    qualityFlags: row.quality_flags,
    ingestedAt: row.ingested_at.toISOString(),
  };
}
