"use client";
import { HeatwaveGrid } from "./heatwave-grid";
import { EnvironmentPixel } from "./environment-pixel";
import { useEffect, useState } from "react";
import { CircleMarker, Popup, Rectangle, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useLocale } from "../locale-provider";
import { gridPalette } from "../environment/environment-map-controls";
import {
  station,
  siteIds,
  names,
  timeIndex,
  overdue,
  variables,
  type OceanLayer,
  type Delivery,
  type Site,
  type Feed,
} from "@/lib/gadews/environment/snapshot";
export interface EnvironmentMaps {
  onSiteChange?: (site: Site) => void;
  day?: string;
  heatMonth: number;
  delivery: Delivery | null;
  layer: OceanLayer;
  points: boolean;
  site: Site | null;
}
function ReferenceDetail({ site, feeds, now, day }: { site: Site; feeds: Feed[]; now: number; day?: string }) {
  const { t } = useLocale();
  const keys =
    site === "offshore"
      ? ["oisst", "chl-l3", "chl-l4", "salinity", "oxygen", "ph"]
      : site === "mekong"
        ? ["weather", "flood"]
        : ["weather"];

  return (
    <div className="max-h-64 overflow-y-auto">
      <strong>{t(station[site][0], station[site][1])}</strong>
      {keys.map((id) => {
        const f = feeds.find((s) => s.id === id),
          s = f?.series.find((s) => s.site === site);
        if (!f || !s)
          return (
            <p key={id}>
              {f ? t(...names[f.id]) : id} · {t("资料不足", "Insufficient data")}
            </p>
          );
        const i = day ? s.times.findIndex(time => time.slice(0, 10) === day) : timeIndex(s.times, now);
        if (i < 0) return <p key={id}>{t(...names[f.id])} · {t("所选日无资料", "No data for this day")}</p>;
        const
          field = s.fields.find((v) => v.key === "precipitation") ?? s.fields[0],
          value = field.values[i];
        return (
          <p key={id}>
            <a href={s.source} target="_blank" rel="noreferrer">
              {t(...names[f.id])}
            </a>
            <br />
            {variables[field.key] ? t(...variables[field.key]) : field.key} ·{" "}
            {value === null ? t("缺测", "Missing") : Number(value.toFixed(3)) + " " + field.unit} ·{" "}
            {s.times[i]} UTC {overdue(f, now) && t("（超期/待更新）", " (stale/pending)")}
          </p>
        );
      })}
      <a href={"/overview?site=" + site + "#environment-evidence"}>
        {t("查看完整时序、覆盖和资料来源", "Open time series, coverage and sources")}
      </a>
    </div>
  );
}
function MarineTiles({
  raster,
}: {
  raster: { layer: string; style: string; time: string; elevation?: string };
}) {
  const { t } = useLocale(),
    map = useMap();
  const [failed, setFailed] = useState(false);
  const q = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: raster.layer,
    STYLE: raster.style,
    FORMAT: "image/png",
    TILEMATRIXSET: "EPSG:3857",
    time: raster.time,
    ...(raster.elevation ? { elevation: raster.elevation } : {}),
  });
  return (
    <>
      <TileLayer
        url={"https://wmts.marine.copernicus.eu/teroWmts?" + q + "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"}
        opacity={0.6}
        zIndex={3}
        maxNativeZoom={9}
        attribution="E.U. Copernicus Marine Service"
        eventHandlers={{ tileerror: () => setFailed(true), loading: () => setFailed(false) }}
      />
      {failed && (
        <div
          role="status"
          className="absolute left-1/2 top-24 z-[450] rounded bg-white px-2 py-1 text-xs text-slate-800"
        >
          {t("部分海洋图块暂不可用", "Some ocean tiles are unavailable")} · z{map.getZoom()}
        </div>
      )}
    </>
  );
}
export function EnvironmentLayers({ delivery, layer, points, site, heatMonth, day, onSiteChange }: EnvironmentMaps) {
  const map = useMap(),
    { t } = useLocale();
  useEffect(() => {
    if (site) map.setView([station[site][2], station[site][3]], site === "offshore" ? 7 : 6);
  }, [map, site]);
  const feeds = delivery?.snapshot.feeds ?? [],
    f = feeds.find((s) => s.id === layer);
  return (
    <>
      {f?.heatMaps && <HeatwaveGrid encoded={f.heatMaps[heatMonth]} month={f.series[0].times[heatMonth]}/>}
      {f?.raster && <MarineTiles key={f.raster.layer + f.raster.time} raster={f.raster} />}
      {f?.raster && <EnvironmentPixel key={f.id + f.raster.time} id={f.id} time={f.raster.time} />}
      {f?.grid &&
        f.grid.points.map(([lat, lon, value]) => {
          if (value === null) return null;
          const sst = layer === "oisst",
            half = sst ? 0.125 : 0.01875;
          const stops = sst ? [20, 25, 30] : [0.3, 1, 3];
          const color = gridPalette[stops.filter((n) => value >= n).length];
          return (
            <Rectangle
              key={lat + "," + lon}
              bounds={[
                [lat - half, lon - half],
                [lat + half, lon + half],
              ]}
              pathOptions={{ stroke: false, fillOpacity: 0.65, fillColor: color }}
            >
              <Popup>
                <strong>{t(...names[f.id])}</strong>
                <p>
                  {value.toFixed(2)} {f.grid!.unit} · {f.grid!.time}
                </p>
                <p>
                  {lat.toFixed(3)}°, {lon.toFixed(3)}°
                </p>
                <a href={f.series[0]?.source}>{t("原始子集", "Source subset")}</a>
              </Popup>
            </Rectangle>
          );
        })}
      {points &&
        delivery &&
        siteIds.map((id) => (
          <CircleMarker
            key={id}
            center={[station[id][2], station[id][3]]}
            eventHandlers={{click: () => onSiteChange?.(id)}}
            radius={8}
            pathOptions={{ color: "#f1ffff", weight: 2, fillColor: "#126c79", fillOpacity: 1 }}
          >
            <Tooltip>
              {t(station[id][0], station[id][1])} · {t("环境代表点", "Environmental reference")}
            </Tooltip>
            <Popup>
              <ReferenceDetail site={id} feeds={feeds} now={delivery.asOf} day={day} />
            </Popup>
          </CircleMarker>
        ))}
    </>
  );
}
