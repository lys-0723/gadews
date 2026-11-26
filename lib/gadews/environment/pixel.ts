import { z } from "zod";
export const pixelQuery = z.object({
  layer: z.enum(["chl-l3", "chl-l4", "ocean-temp", "salinity", "oxygen", "ph"]),
  lat: z.number().finite().min(-85).max(85),
  lon: z.number().finite().min(-180).max(180),
  time: z.string().min(10).max(40),
});
export const feature = z.object({
  features: z
    .array(
      z.object({
        properties: z.object({
          value: z.number().finite().nullable(),
          units: z.string().min(1),
          datasetId: z.string(),
          variableId: z.string(),
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
        }),
      }),
    )
    .length(1),
});
export function featureUrl(
  lat: number,
  lon: number,
  raster: { layer: string; style: string; time: string; elevation?: string },
) {
  const size = 256 * 2 ** 7;
  const x = Math.min(size - 1, Math.floor(((lon + 180) / 360) * size)),
    y = Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * size);
  const q = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetFeatureInfo",
    VERSION: "1.0.0",
    LAYER: raster.layer,
    STYLE: raster.style,
    FORMAT: "image/png",
    INFOFORMAT: "application/json",
    TILEMATRIXSET: "EPSG:3857",
    TILEMATRIX: "7",
    TILEROW: String(y >> 8),
    TILECOL: String(x >> 8),
    I: String(x % 256),
    J: String(y % 256),
    time: raster.time,
  });
  if (raster.elevation) q.set("elevation", raster.elevation);
  return "https://wmts.marine.copernicus.eu/teroWmts?" + q;
}
