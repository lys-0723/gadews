import type {
  AquacultureDeviceConfig,
  RichLinkSettings,
} from "./types";

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

interface RawDeviceConfig {
  key?: unknown;
  id?: unknown;
  upstreamDeviceId?: unknown;
  deviceId?: unknown;
  siteId?: unknown;
  pondId?: unknown;
  name?: unknown;
  enabled?: unknown;
}

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(env: Environment, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `Expected an integer between ${minimum} and ${maximum}, received: ${value}`
    );
  }
  return parsed;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Rich-Link device field ${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeDevice(raw: RawDeviceConfig, index: number): AquacultureDeviceConfig {
  const upstreamDeviceId = asNonEmptyString(
    raw.upstreamDeviceId ?? raw.deviceId,
    "upstreamDeviceId"
  );
  const siteId = asNonEmptyString(raw.siteId, "siteId");
  const key = asNonEmptyString(
    raw.key ?? raw.id ?? `rich-link-${index + 1}`,
    "key"
  );

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(key)) {
    throw new Error(
      `Rich-Link device key must use letters, digits, underscores, or hyphens: ${key}`
    );
  }

  return {
    key,
    upstreamDeviceId,
    siteId,
    pondId:
      typeof raw.pondId === "string" && raw.pondId.trim()
        ? raw.pondId.trim()
        : null,
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : key,
    enabled: raw.enabled !== false,
  };
}

function parseDevices(env: Environment): AquacultureDeviceConfig[] {
  const json = optional(env, "RICH_LINK_DEVICES_JSON");
  if (json) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new Error(
        `RICH_LINK_DEVICES_JSON is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("RICH_LINK_DEVICES_JSON must contain at least one device");
    }
    return parsed.map((device, index) =>
      normalizeDevice(device as RawDeviceConfig, index)
    );
  }

  return [
    normalizeDevice(
      {
        key: optional(env, "RICH_LINK_DEVICE_KEY") ?? "rich-link-primary",
        upstreamDeviceId: required(env, "RICH_LINK_DEVICE_ID"),
        siteId: required(env, "RICH_LINK_SITE_ID"),
        pondId: optional(env, "RICH_LINK_POND_ID"),
        name: optional(env, "RICH_LINK_DEVICE_NAME") ?? "Rich-Link primary device",
      },
      0
    ),
  ];
}

export function getRichLinkSettings(
  env: Environment = process.env
): RichLinkSettings {
  const baseUrl = (
    optional(env, "RICH_LINK_BASE_URL") ?? "http://gy.rich-link.cn"
  ).replace(/\/$/, "");
  const parsedUrl = new URL(baseUrl);
  const allowInsecureHttp = parseBoolean(
    optional(env, "RICH_LINK_ALLOW_INSECURE_HTTP"),
    false
  );

  if (parsedUrl.protocol === "http:" && !allowInsecureHttp) {
    throw new Error(
      "RICH_LINK_BASE_URL uses HTTP. Set RICH_LINK_ALLOW_INSECURE_HTTP=true only while the provider HTTPS certificate is unavailable."
    );
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("RICH_LINK_BASE_URL must use HTTP or HTTPS");
  }

  const devices = parseDevices(env);
  const keys = new Set<string>();
  for (const device of devices) {
    if (keys.has(device.key)) {
      throw new Error(`Duplicate Rich-Link device key: ${device.key}`);
    }
    keys.add(device.key);
  }

  return {
    baseUrl,
    appId: required(env, "RICH_LINK_APP_ID"),
    publicKey: required(env, "RICH_LINK_PUBLIC_KEY"),
    allowInsecureHttp,
    timeoutMs: parseInteger(
      optional(env, "RICH_LINK_TIMEOUT_MS"),
      15_000,
      1_000,
      120_000
    ),
    pageLimit: parseInteger(
      optional(env, "RICH_LINK_PAGE_LIMIT"),
      1_000,
      1,
      1_000
    ),
    initialLookbackDays: parseInteger(
      optional(env, "RICH_LINK_INITIAL_LOOKBACK_DAYS"),
      1,
      0,
      31
    ),
    pollIntervalSeconds: parseInteger(
      optional(env, "RICH_LINK_POLL_INTERVAL_SECONDS"),
      180,
      30,
      86_400
    ),
    timeZone: optional(env, "RICH_LINK_TIME_ZONE") ?? "Asia/Shanghai",
    devices,
  };
}
