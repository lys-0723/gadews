"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import L from "leaflet";
import atlasLabels from "@/lib/gadews/environment/atlas-labels.json";
import { GeoJSON, Marker, Pane, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useLocale } from "../locale-provider";
import "./ocean-basemap.css";

const coastPane = "gadews-atlas-coast";
const detailZoom = 5;
const geographyStyle = { color: "#9aa9a7", weight: 0.8, opacity: 0.8, fillColor: "#faf8f0", fillOpacity: 1 };

// Positions, names and minimum label zoom come from the same bundled Natural Earth source.
function AtlasLabels({ zoom }: { zoom: number }) {
  const map = useMap();
  const { t } = useLocale();
  const visible = useMemo(() => {
    const occupied: L.Bounds[] = [];
    return atlasLabels.flatMap(point => {
      if (point.minZoom > zoom) return [];
      const text = t(point.zh, point.en);
      const centre = map.project([point.lat, point.lon], zoom);
      const width = Math.max(24, text.length * (text === point.zh ? 12 : 6.5));
      const bounds = L.bounds(centre.subtract([width / 2 + 5, 9]), centre.add([width / 2 + 5, 9]));
      if (occupied.some(overlap => overlap.intersects(bounds))) return [];
      occupied.push(bounds);
      const label = document.createElement("span");
      label.textContent = text;
      return [{ ...point, icon: L.divIcon({
        html: label, className: "gadews-atlas-label", iconSize: [width, 18], iconAnchor: [width / 2, 9],
      }) }];
    });
  }, [map, t, zoom]);
  return visible.map(point => <Marker key={point.en} pane={coastPane} position={[point.lat, point.lon]}
    icon={point.icon} interactive={false} keyboard={false} />);
}

// Keep the verified 1:110m geometry underneath detailed tiles when a tile is missing.
// This pane sits below the tile pane, so it never masks scientific rasters or report markers.
export function OceanBasemap() {
  const map = useMap();
  const { t } = useLocale();
  const [zoom, setZoom] = useState(map.getZoom());
  const [world, setWorld] = useState<FeatureCollection | null>(null);
  const [worldFailed, setWorldFailed] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  useEffect(() => {
    const controller = new AbortController();
    const container = map.getContainer();
    container.classList.add("gadews-ocean-basemap");
    fetch("/globe/countries.json", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Atlas unavailable");
        const data: FeatureCollection = await response.json();
        if (data.type !== "FeatureCollection" || !data.features.length) throw new Error("Invalid atlas");
        if (!controller.signal.aborted) setWorld(data);
      })
      .catch(() => { if (!controller.signal.aborted) setWorldFailed(true); });
    return () => {
      controller.abort();
      container.classList.remove("gadews-ocean-basemap");
    };
  }, [map]);

  const showDetail = zoom >= detailZoom || worldFailed;
  return <>
    <Pane name={coastPane} style={{ zIndex: 150, pointerEvents: "none" }}>
      {world && <GeoJSON pane={coastPane} data={world} interactive={false} style={geographyStyle}
        attribution='<a href="https://www.naturalearthdata.com/">Natural Earth</a> 1:110m' />}
      {world && !showDetail && <AtlasLabels zoom={zoom} />}
    </Pane>
    {showDetail && <TileLayer
      className="gadews-geography-tiles"
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxNativeZoom={19} maxZoom={20}
      errorTileUrl="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
      eventHandlers={{ loading: () => setTileFailed(false), tileerror: () => setTileFailed(true) }}
    />}
    {showDetail && tileFailed && <div role="status" className="gadews-basemap-status">
      {world
        ? t("部分地理瓦片缺失，底层仅显示全球概略边界。", "Some geographic tiles are missing; underlying boundaries are generalized.")
        : t("地理底图暂不可用。", "Geographic basemap unavailable.")}
    </div>}
  </>;
}
