import { readEnvironment } from "@/lib/gadews/environment/publication";
import { feature, featureUrl, nearbySourceCell, pixelQuery } from "@/lib/gadews/environment/pixel";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = (key: string) => (params.get(key)?.trim() ? Number(params.get(key)) : NaN);
  const input = pixelQuery.safeParse({
    lat: raw("lat"),
    lon: raw("lon"),
    layer: params.get("layer"),
    time: params.get("time"),
  });
  if (!input.success) return Response.json({ error: "invalid_location_or_product" }, { status: 400 });
  const { lat, lon, layer, time } = input.data;
  const { snapshot } = await readEnvironment();
  const raster = snapshot.feeds.find((f) => f.id === layer)?.raster;
  if (!raster || time !== raster.time) return Response.json({ error: "refresh_layer" }, { status: 409 });
  const source = featureUrl(lat, lon, raster);
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(8500), next: { revalidate: 3600 } });
    if (!response.ok) throw new Error("source unavailable");
    const item = feature.parse(await response.json()).features[0].properties;
    if (item.datasetId + "/" + item.variableId !== raster.layer) throw new Error("unexpected product");
    const nearby = nearbySourceCell(layer, lat, lon, item.lat, item.lon);
    return Response.json(
      { value: nearby ? item.value : null, outsideGrid: !nearby, unit: item.units, lat: item.lat, lon: item.lon, time, source },
      { headers: { "Cache-Control": "public,max-age=300,s-maxage=3600" } },
    );
  } catch {
    return Response.json(
      { error: "source_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
