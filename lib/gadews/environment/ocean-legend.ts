import { z } from "zod";
import type { Feed } from "./snapshot";

type Raster = NonNullable<Feed["raster"]>;
export function legendUrl(raster: Raster, format = "image/svg+xml") {
  const params = new URLSearchParams({
    SERVICE: "WMTS", REQUEST: "GetLegend", VERSION: "1.0.0",
    LAYER: raster.layer, STYLE: raster.style, FORMAT: format, time: raster.time,
  });
  if (raster.elevation) params.set("elevation", raster.elevation);
  return "https://wmts.marine.copernicus.eu/teroWmts?" + params;
}

const channel = z.number().int().min(0).max(255);
const continuousScale = z.object({
  variableId: z.string(), units: z.string().min(1), cmapName: z.string(), logScale: z.boolean(),
  valueMin: z.number().finite(), valueMax: z.number().finite(), clamp: z.boolean(),
  cmap: z.object({ colorMap: z.array(z.tuple([channel, channel, channel])).min(2).max(1024) }),
});
export type ProviderScale = z.infer<typeof continuousScale>;
export function readScale(raw: unknown, raster: Raster) {
  const { continuous } = z.object({ continuous: continuousScale }).parse(raw);
  if (continuous.variableId !== raster.layer.split("/").at(-1) || "cmap:" + continuous.cmapName !== raster.style ||
      continuous.valueMax <= continuous.valueMin || (continuous.logScale && continuous.valueMin <= 0)) {
    throw new Error("Legend does not match the selected map style");
  }
  return continuous;
}

const units: Record<string, string> = {
  degree_C: "°C", degrees_C: "°C", "milligram m-3": "mg/m³", "mg m^-3": "mg/m³",
  "mmol m-3": "mmol/m³", "1e-3": "10⁻³",
};
export const unitText = (unit: string) => units[unit] ?? unit;
export const numberText = (value: number) => String(Number(value.toPrecision(4)));

export function gridSummary(points: NonNullable<Feed["grid"]>["points"]) {
  if (!points.length) return null;
  const values = points.flatMap(([, , value]) => value === null ? [] : [value]);
  const latitudes = points.map(([lat]) => lat);
  const longitudes = points.map(([, lon]) => lon);
  return {
    count: values.length, total: points.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    south: Math.min(...latitudes), north: Math.max(...latitudes),
    west: Math.min(...longitudes), east: Math.max(...longitudes),
  };
}
