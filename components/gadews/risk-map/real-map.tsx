"use client";

import type { HistoryScope } from "@/lib/gadews/history-reports";
import { useEffect, useRef } from "react";
import { MapContainer, CircleMarker, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useLocale } from "@/components/gadews/locale-provider";
import "./map-ui.css";
import { RegionalDemoLayer } from "./regional-demo-layer";
import type { RegionalDemoSummary } from "./regional-demo-panel";
import { QaadSurveillanceLayer, type QaadStatusFilter } from "./qaad-surveillance-layer";
import { WoahWahisLayer, type DiseaseFilter, type LayerStats } from "./woah-wahis-layer";

// 修复 Leaflet 在 Next.js 中的默认图标路径丢失问题
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

import { OceanBasemap } from "./ocean-basemap";
import { EnvironmentLayers, type EnvironmentMaps } from "./environment-layers";

export interface MapProps {
  history?: HistoryScope;
  reportCenter?: [number, number];
  environment?: EnvironmentMaps;
  regionalDemo?: RegionalDemoSummary;
  showHeatmap?: boolean;
  showCases?: boolean;
  showCoverage?: boolean;
  showBoundaries?: boolean;
  showWaterSystems?: boolean;
  showFarmDensity?: boolean;
  showWahis?: boolean;
  showQaad?: boolean;
  diseaseFilter?: DiseaseFilter;
  qaadStatusFilter?: QaadStatusFilter;
  onWahisStatsChange?: (stats: LayerStats) => void;
  onQaadStatsChange?: (stats: LayerStats) => void;
  onPopupVisibilityChange?: (visible: boolean) => void;
}

function PopupEvents({ onChange }: { onChange?: (visible: boolean) => void }) {
  const { t } = useLocale();
  const map = useMapEvents({ popupopen: event => { onChange?.(true); requestAnimationFrame(() => { const close = event.popup.getElement()?.querySelector<HTMLAnchorElement>(".leaflet-popup-close-button"); if (close) { close.setAttribute("aria-label", close.closest(".regional-demo-popup") ? t("关闭观测详情", "Close observation details") : t("关闭报告详情", "Close report details")); close.focus(); } }); }, popupclose: event => { onChange?.(false); const source = (event.popup as unknown as { _source?: { getElement?: () => HTMLElement } })._source; source?.getElement?.()?.focus(); } });
  useEffect(() => {
    const close = map.getContainer().querySelector(".leaflet-popup-close-button");
    if (close) close.setAttribute("aria-label", close.closest(".regional-demo-popup") ? t("关闭观测详情", "Close observation details") : t("关闭报告详情", "Close report details"));
  }, [map, t]);
  return null;
}

function ReportFocus({ country, center }: { country?: string; center?: [number, number] }) {
  const map = useMap();
  const wasFocused = useRef(false);
  const lat = center?.[0], lon = center?.[1];
  useEffect(() => {
    if (country && lat !== undefined && lon !== undefined) {
      map.setView([lat, lon], 4);
      wasFocused.current = true;
    } else if (!country && wasFocused.current) {
      map.setView([12, 18], 2);
      wasFocused.current = false;
    }
  }, [map, country, lat, lon]);
  return null;
}

export default function RealMap({
  history, reportCenter,
  environment,
  regionalDemo,
  showCases,
  showHeatmap,
  showWahis,
  showQaad,
  diseaseFilter = "all",
  qaadStatusFilter = "priority",
  onWahisStatsChange,
  onQaadStatsChange,
  onPopupVisibilityChange,
}: MapProps) {
  const { t, locale } = useLocale();
  return (
    <MapContainer
      className="gadews-map"
      center={[12, 18]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      zoomControl={false} // 隐藏默认的加减号，保持界面干净
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <ZoomControl key={locale} position="bottomright" zoomInTitle={t("放大地图", "Zoom in")} zoomOutTitle={t("缩小地图", "Zoom out")} />
      <ReportFocus country={history?.country} center={reportCenter} />
      <PopupEvents onChange={onPopupVisibilityChange} />
      <OceanBasemap />

      {showCases && <>
        <CircleMarker center={[21.5, 111.0]} radius={8} className="demo-case-marker" pathOptions={{ color: "#ef4444", fillOpacity: 0.7 }}>
          <Tooltip><b>{t("示意 · WSSV 标记", "Demo · WSSV marker")}</b><p>{t("示意位置，非确诊病例", "Illustrative location, no confirmed case")}</p></Tooltip>
        </CircleMarker>
        <CircleMarker center={[18.2, 109.5]} radius={8} className="demo-case-marker" pathOptions={{ color: "#ef4444", fillOpacity: 0.7 }}>
          <Tooltip><b>{t("示意 · EHP 标记", "Demo · EHP marker")}</b><p>{t("示意位置，非确诊病例", "Illustrative location, no confirmed case")}</p></Tooltip>
        </CircleMarker>
      </>}
      {showHeatmap && <>
        <CircleMarker center={[20.5, 110.5]} radius={45} className="demo-heatmap-marker" pathOptions={{ color: "#00ffff", fillOpacity: 0.2 }} interactive={false} />
        <CircleMarker center={[21.0, 111.2]} radius={70} className="demo-heatmap-marker" pathOptions={{ color: "#ff0055", fillOpacity: 0.15 }} interactive={false} />
        <div className="absolute bottom-36 left-4 z-[500] max-w-[260px] rounded-xl bg-white/95 p-3 text-sm text-slate-900">{t("示意热区 · 数值仅作演示，非模型预测", "Demo heatmap · illustrative values, no model prediction")}</div>
      </>}
      {environment && <EnvironmentLayers {...environment}/>}
      <WoahWahisLayer
        visible={!!showWahis}
        diseaseFilter={diseaseFilter}
        history={history}
        onStatsChange={onWahisStatsChange}
      />
      <QaadSurveillanceLayer
        visible={!!showQaad}
        diseaseFilter={diseaseFilter}
        history={history}
        statusFilter={qaadStatusFilter}
        onStatsChange={onQaadStatsChange}
      />
      {regionalDemo && <RegionalDemoLayer summary={regionalDemo} />}

    </MapContainer>
  );
}
