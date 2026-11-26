"use client";

import { useEffect } from "react";
import L from "leaflet";
import { Circle, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import { useLocale } from "@/components/gadews/locale-provider";
import type { RegionalDemoGroup } from "@/lib/gadews/regional-monitoring-demo";
import { groupLabels, type RegionalDemoSummary } from "./regional-demo-panel";

function markerIcon(className: string, size: number) {
  return L.divIcon({ className, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -9] });
}
const siteIcon = markerIcon("regional-demo-site", 16);
const recordIcons: Record<RegionalDemoGroup, L.DivIcon> = {
  same: markerIcon("regional-demo-record regional-symbol symbol-same", 14),
  other: markerIcon("regional-demo-record regional-symbol symbol-other", 14),
  unknown: markerIcon("regional-demo-record regional-symbol symbol-unknown", 14),
};

export function RegionalDemoLayer({ summary }: { summary: RegionalDemoSummary }) {
  const map = useMap();
  const { t, locale } = useLocale();
  const { site, radiusMeters, records } = summary;

  useEffect(() => {
    const oldCenter = map.getCenter();
    const oldZoom = map.getZoom();
    return () => {
      if (map.getContainer().isConnected) map.stop().setView(oldCenter, oldZoom, { animate: false });
    };
  }, [map]);

  useEffect(() => {
    const controls = map.getContainer().closest("[data-risk-map]")?.querySelector<HTMLElement>("[data-map-controls-space]");
    if (!controls) return;
    const bounds = L.latLng(site.latitude, site.longitude).toBounds(2 * radiusMeters);
    function fitDemo() {
      if (!controls || !map.getContainer().isConnected) return;
      map.stop().fitBounds(bounds, {
        padding: [28, 28],
        maxZoom: 14,
        animate: false,
      });
    }
    fitDemo();
    const observer = new ResizeObserver(fitDemo);
    observer.observe(controls);
    return () => observer.disconnect();
  }, [map, site, radiusMeters]);

  return <>
    <Circle className="regional-demo-radius" center={[site.latitude, site.longitude]} radius={radiusMeters} interactive={false}
      pathOptions={{ color: "#135e76", fillColor: "#5fc6ce", weight: 2, dashArray: "8 5", fillOpacity: 0.13 }} />
    <Marker position={[site.latitude, site.longitude]} icon={siteIcon} interactive={false} keyboard={false} zIndexOffset={500}>
      <Tooltip permanent className="regional-demo-site-label" direction="right" offset={[10, 0]}>{t("虚构试点", "Fictional site")} {site.id}</Tooltip>
    </Marker>
    {records.map(record => {
      const kind = record.kind === "health-check" ? t("健康巡查", "Health check") : t("水质观测", "Water quality");
      const name = t(`虚构观测 ${record.id}`, `Fictional observation ${record.id}`);
      return <Marker key={`${locale}-${record.id}`} position={[record.latitude, record.longitude]} icon={recordIcons[record.group]} title={name} alt={name}>
        <Tooltip direction="top" offset={[0, -7]}>{record.id} · {kind}</Tooltip>
        <Popup autoPanPaddingTopLeft={[16, 120]} autoPanPaddingBottomRight={[16, 40]} className="gadews-map-popup regional-demo-popup" maxWidth={235}>
          <strong>{name}</strong>
          <div>{record.observedOn} · {kind}</div>
          <div>{t(...groupLabels[record.group])}{record.waterSystem ? ` · ${record.waterSystem}` : ""}</div>
          <div>{t("距试点", "Distance to site")} {site.id} · {Math.round(record.distanceMeters).toLocaleString(locale)} m</div>
        </Popup>
      </Marker>;
    })}
  </>;
}
