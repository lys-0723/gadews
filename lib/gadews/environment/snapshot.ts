import { z } from "zod";

export const siteIds = ["guangzhou", "zhanjiang", "mekong", "chanthaburi", "andhra", "offshore"] as const;
export type Site = (typeof siteIds)[number];
export const station: Record<Site, [string, string, number, number]> = {
  guangzhou: ["广州", "Guangzhou", 23.13, 113.26],
  zhanjiang: ["湛江", "Zhanjiang", 21.27, 110.36],
  mekong: ["湄公河三角洲", "Mekong Delta", 10.04, 105.78],
  chanthaburi: ["尖竹汶", "Chanthaburi", 12.61, 102.1],
  andhra: ["安得拉邦", "Andhra Pradesh", 16.51, 80.64],
  offshore: ["中国南海近海示例点", "South China Sea reference", 20.5, 111.5],
};
export const feedIds = [
  "weather",
  "heatwave",
  "imerg",
  "enso",
  "gefs",
  "ec46",
  "seas5",
  "marine",
  "flood",
  "era5",
  "power",
  "oisst",
  "oisst-final",
  "viirs",
  "chl-l3",
  "chl-l4",
  "ocean-temp",
  "salinity",
  "oxygen",
  "ph",
  "cyclones",
  "abis",
] as const;
export type FeedId = (typeof feedIds)[number];
export const names: Record<FeedId, [string, string]> = {
  heatwave: ["NOAA PSL · 海洋热浪概率", "NOAA PSL · Marine heatwave probability"],
  imerg: ["NASA IMERG · 半小时卫星降水", "NASA IMERG · Half-hourly satellite precipitation"],
  enso: ["NOAA CPC · ENSO 概率展望", "NOAA CPC · ENSO probability outlook"],
  weather: ["Open-Meteo · 天气预报", "Open-Meteo · Weather forecast"],
  gefs: ["NOAA GEFS · 15 天集合天气预报", "NOAA GEFS · 15-day ensemble weather"],
  ec46: ["ECMWF EC46 · 逐周气候展望", "ECMWF EC46 · Weekly outlook"],
  seas5: ["ECMWF SEAS5 · 逐月气候展望", "ECMWF SEAS5 · Monthly outlook"],
  marine: ["Open-Meteo · 海况预报", "Open-Meteo · Marine forecast"],
  flood: ["GloFAS · 河流流量预报", "GloFAS · River discharge forecast"],
  era5: ["ERA5 · 历史再分析", "ERA5 · Historical reanalysis"],
  power: ["NASA POWER · 近期日值", "NASA POWER · Recent daily data"],
  oisst: ["NOAA OISST · 日海温分析（初版）", "NOAA OISST · Preliminary SST analysis"],
  "oisst-final": ["NOAA OISST · 最终版日海温", "NOAA OISST · Final SST analysis"],
  viirs: ["NOAA VIIRS · 卫星海色", "NOAA VIIRS · Satellite ocean colour"],
  "chl-l3": ["Copernicus L3 · 卫星叶绿素 a", "Copernicus L3 · Satellite chlorophyll a"],
  "chl-l4": ["Copernicus L4 · 插值叶绿素 a", "Copernicus L4 · Interpolated chlorophyll a"],
  "ocean-temp": ["Copernicus · 表层海温模式", "Copernicus · Surface ocean temperature model"],
  salinity: ["Copernicus · 海区盐度模式", "Copernicus · Ocean salinity model"],
  oxygen: ["Copernicus · 海区溶解氧模式", "Copernicus · Ocean oxygen model"],
  ph: ["Copernicus · 海区 pH 模式", "Copernicus · Ocean pH model"],
  cyclones: ["GDACS · 全球热带气旋事件", "GDACS · Global tropical cyclone events"],
  abis: ["INCOIS ABIS · 区域藻华产品", "INCOIS ABIS · Regional bloom product"],
};
export const variables: Record<string, [string, string]> = {
  mhw_probability: ["海洋热浪概率", "Marine heatwave probability"],
  temperature_2m_anomaly: ["平均气温距平", "Mean air temperature anomaly"],
  precipitation_anomaly: ["累计降水距平", "Total precipitation anomaly"],
  temperature_2m_mean_p10: ["日均气温 · P10", "Daily mean air temperature · P10"],
  temperature_2m_mean_p50: ["日均气温 · P50", "Daily mean air temperature · P50"],
  temperature_2m_mean_p90: ["日均气温 · P90", "Daily mean air temperature · P90"],
  precipitation_sum_p10: ["日累计降水 · P10", "Daily precipitation · P10"],
  precipitation_sum_p50: ["日累计降水 · P50", "Daily precipitation · P50"],
  precipitation_sum_p90: ["日累计降水 · P90", "Daily precipitation · P90"],
  temperature_2m: ["2 米气温", "2 m air temperature"],
  relative_humidity_2m: ["2 米相对湿度", "2 m humidity"],
  precipitation: ["小时降水", "Hourly precipitation"],
  wind_speed_10m: ["10 米风速", "10 m wind speed"],
  shortwave_radiation: ["短波辐射", "Shortwave radiation"],
  sea_surface_temperature: ["海表温度", "Sea surface temperature"],
  sea_level_height_msl: ["含潮汐海平面高", "Sea level including tides"],
  ocean_current_velocity: ["洋流速度", "Current velocity"],
  river_discharge: ["河道日流量", "River discharge"],
  temperature_2m_mean: ["日均气温", "Daily mean air temperature"],
  precipitation_sum: ["日累计降水", "Daily precipitation"],
  wind_speed_10m_max: ["日最大 10 米风速", "Daily max 10 m wind"],
  shortwave_radiation_sum: ["日累计短波辐射", "Daily shortwave energy"],
  T2M: ["2 米气温", "2 m air temperature"],
  WS2M: ["2 米风速", "2 m wind speed"],
  PRECTOTCORR: ["日降水", "Daily precipitation"],
  ALLSKY_SFC_SW_DWN: ["日累计短波辐射", "Daily shortwave energy"],
  thetao: ["海水位温", "Sea water potential temperature"],
  sst: ["海表温度", "Sea surface temperature"],
  chlor_a: ["叶绿素 a", "Chlorophyll a"],
  CHL: ["叶绿素 a", "Chlorophyll a"],
  so: ["盐度", "Salinity"],
  o2: ["溶解氧", "Dissolved oxygen"],
  ph: ["pH（总标度）", "pH (total scale)"],
};
export const sitesFor = (key: FeedId): readonly Site[] =>
  ["weather", "gefs", "ec46", "seas5", "era5", "imerg"].includes(key)
    ? siteIds.slice(0, 5)
    : key === "power"
      ? ["zhanjiang"]
      : key === "flood"
        ? ["mekong"]
        : key === "enso" || key === "cyclones" || key === "abis"
          ? []
          : ["offshore"];
const https = z.string().url().startsWith("https://");
const dateText = z.string().regex(/^\d{4}-\d\d-\d\d(?:T.*)?$/);
const val = z.number().finite().nullable();
const lat = z.number().min(-90).max(90),
  lon = z.number().min(-180).max(180);
const series = z
  .object({
    site: z.enum(siteIds),
    lat,
    lon,
    requested: z.tuple([lat, lon]),
    source: https,
    depthM: z.number().nullable(),
    times: z.array(dateText).min(1).max(400),
    fields: z
      .array(z.object({ key: z.string(), unit: z.string().min(1), values: z.array(val).max(400) }))
      .min(1),
  })
  .refine((s) => s.fields.every((f) => f.values.length === s.times.length));
const feed = z.object({
  id: z.enum(feedIds),
  state: z.enum(["ok", "retained", "unavailable"]),
  retrievedAt: dateText.optional(),
  checkedAt: dateText,
  lastSuccessAt: dateText.optional(),
  error: z.string().optional(),
  series: z.array(series).max(8),
  catalogUrl: https.optional(),
  issueMonth: dateText.optional(),
  heatMaps: z.array(z.string().length(86880).regex(/^[A-Za-z0-9+/]+$/)).length(12).optional(),
  imageryTime: dateText.optional(),
  frames: z.array(z.object({
    site: z.enum(siteIds), url: https, png: z.string().max(220000).startsWith("iVBOR"),
    rate: z.tuple([z.enum(["Rain Rate", "Snow Rate"]), z.number().nonnegative(), z.number().nonnegative().nullable()]).nullable(),
  })).length(5).optional(),
  seasons: z.array(z.object({
    start: dateText, end: dateText,
    cold: z.number().int().min(0).max(100), neutral: z.number().int().min(0).max(100), warm: z.number().int().min(0).max(100),
  }).refine((v) => v.cold + v.neutral + v.warm === 100)).length(9).optional(),
  events: z.array(z.object({ name: z.string(), start: dateText, end: dateText, url: https })).optional(),
  grid: z
    .object({ time: dateText, unit: z.string(), points: z.array(z.tuple([lat, lon, val])).max(3000) })
    .optional(),
  raster: z
    .object({
      layer: z.string().regex(/^[\w.\-/]+$/),
      style: z.string(),
      elevation: z.string().optional(),
      time: dateText,
    })
    .optional(),
}).refine(f => {
  if (f.state === "unavailable") return true;
  if (f.id === "heatwave") return !!f.issueMonth && f.heatMaps?.length === 12 && f.series[0]?.times.length === 12;
  if (f.id === "enso") return !!f.issueMonth && f.seasons?.length === 9;
  if (f.id === "imerg") return !!f.imageryTime && f.frames?.length === 5 &&
    sitesFor("imerg").every(site => f.frames!.some(frame => frame.site === site));
  return true;
});
export const schema = z
  .object({ schemaVersion: z.literal(1), publishedAt: dateText, feeds: z.array(feed) })
  .refine(
    (s) => new Set(s.feeds.map((f) => f.id)).size === feedIds.length && s.feeds.length === feedIds.length,
  );
export type Snapshot = z.infer<typeof schema>;
export type Feed = z.infer<typeof feed>;
export type Series = z.infer<typeof series>;
export const utcMillis = (s: string) =>
  Date.parse(s.length === 10 ? s + "T00:00:00Z" : /[Zz]|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z");
export function timeIndex(times: string[], now: number) {
  const next = times.findIndex((t) => utcMillis(t) > now);
  return next < 0 ? times.length - 1 : Math.max(0, next - 1);
}
export function overdue(f: Feed, now: number) {
  if (f.state !== "ok" || !f.retrievedAt) return true;
  if (now - utcMillis(f.checkedAt) > 12 * 3600000) return true;
  if (f.id === "enso" || f.id === "heatwave") return !f.issueMonth || now - utcMillis(f.issueMonth) > 47 * 86400000;
  if (f.id === "imerg") return !f.imageryTime || now - utcMillis(f.imageryTime) > 24 * 3600000;
  const end = f.grid?.time ?? f.series[0]?.times.at(-1) ?? f.events?.[0]?.end;
  if (!end || f.id === "era5" || f.id === "cyclones") return false;
  if (f.id === "gefs" || f.id === "ec46" || f.id === "seas5") {
    const expires = new Date(utcMillis(end));
    if (f.id === "seas5") expires.setUTCMonth(expires.getUTCMonth() + 1);
    else expires.setUTCDate(expires.getUTCDate() + (f.id === "ec46" ? 7 : 1));
    return now >= expires.getTime();
  }
  const ageDays = (now - utcMillis(end)) / 86400000;
  if (f.id === "oisst-final") return ageDays > 24;
  return ageDays > (f.id === "weather" || f.id === "marine" || f.id === "flood" ? 1 : 4);
}
export type Delivery = { snapshot: Snapshot; asOf: number; origin: "bundled" | "cached" | "published" };

export const oceanLayers = [
  "off",
  "heatwave",
  "oisst",
  "ocean-temp",
  "chl-l3",
  "chl-l4",
  "viirs",
  "salinity",
  "oxygen",
  "ph",
] as const;
export type OceanLayer = (typeof oceanLayers)[number];
