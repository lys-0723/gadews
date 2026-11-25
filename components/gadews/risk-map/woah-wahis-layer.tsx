"use client";

import { useEffect, useMemo } from "react";
import { useCopy } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";
import { CircleMarker, Popup, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import { computeLayerStats, filterWahis, normalizeDiseaseId, type WahisRecord, type DiseaseFilter, type LayerStats } from "@/lib/gadews/public-surveillance";
export type { DiseaseFilter, LayerStats } from "@/lib/gadews/public-surveillance";

interface WoahWahisLayerProps {
  visible: boolean;
  diseaseFilter: DiseaseFilter;
  onStatsChange?: (stats: LayerStats) => void;
}

const DISEASE_COLORS: Record<string, string> = {
  WSD: "#ef4444",
  AHPND: "#f97316",
  KHV: "#eab308",
  TILV: "#22d3ee",
  EUS: "#a855f7",
  VHS: "#3b82f6",
  IHN: "#14b8a6",
  SVC: "#f43f5e",
  OTHER: "#94a3b8",
};

function colorForDisease(diseaseId?: string) {
  const key = normalizeDiseaseId(diseaseId);
  return DISEASE_COLORS[key] ?? DISEASE_COLORS.OTHER;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function jitterPosition(record: WahisRecord, seedKey: string): LatLngExpression {
  const hash = hashString(seedKey);
  const angle = (hash % 360) * (Math.PI / 180);
  const distance = 0.08 + ((hash % 9) * 0.01);
  return [
    Number(record.latitude) + Math.sin(angle) * distance,
    Number(record.longitude) + Math.cos(angle) * distance,
  ];
}

function compact(value: unknown) {
  if (value === undefined || value === null || value === "") return "--";
  return String(value);
}

function linkOrDash(label: string, url?: string | null) {
  if (!url) return <span>--</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="break-words text-teal-700 underline">
      {label}
    </a>
  );
}

function makeWahisKey(record: WahisRecord) {
  return `wahis-${record.event_id ?? "na"}-${record.report_id_raw ?? "na"}-${
    record.disease_id ?? "unknown"
  }-${record.sourceIndex}`;
}

export function WoahWahisLayer({
  visible,
  diseaseFilter,
  onStatsChange,
}: WoahWahisLayerProps) {
  const c = useCopy(mapCopy);
  const { records, state, metadata, rejectedCount, error, retry } = usePublicSurveillance("wahis", visible);
  const filteredRecords = useMemo(() => visible ? filterWahis(records, diseaseFilter) : [], [records, visible, diseaseFilter]);
  useEffect(() => {
    onStatsChange?.({ ...computeLayerStats(filteredRecords, "wahis"), state, metadata, rejectedCount, error: visible ? error : undefined, retry });
  }, [filteredRecords, state, metadata, rejectedCount, error, retry, visible, onStatsChange]);

  if (!visible) return null;

  return (
    <>
      {filteredRecords.map((record) => {
        const diseaseId = normalizeDiseaseId(record.disease_id);
        const color = colorForDisease(diseaseId);
        const latestReportDate =
          record.latest_report_detail?.report_date ??
          record.dashboard_summary?.latest_reporting_date;
        const eventStatus =
          record.latest_report_detail?.event_status ?? record.event_status;
        const markerKey = makeWahisKey(record);

        return (
          <CircleMarker
            key={markerKey}
            center={jitterPosition(
              record,
              `${record.event_id ?? "na"}-${record.report_id_raw ?? "na"}-${
                record.disease_id ?? "unknown"
              }-${record.sourceIndex}`
            )}
            eventHandlers={{ add: event => { const element = event.target.getElement(); if (element) { element.setAttribute("tabindex", "0"); element.setAttribute("role", "button"); element.setAttribute("aria-label", `${compact(record.disease_name)} · ${compact(record.country)}`); element.onkeydown = (key: KeyboardEvent) => { if (key.key === "Enter" || key.key === " ") { key.preventDefault(); event.target.openPopup(); } }; } } }}
            radius={6}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.72,
              weight: 1.5,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div className="text-sm font-bold">{compact(record.disease_name)}</div>
              <div className="text-sm">{compact(record.country)}</div>
            </Tooltip>
            <Popup
              autoPan
              keepInView
              autoPanPaddingTopLeft={[16, 112]}
              autoPanPaddingBottomRight={[16, 36]}
              maxWidth={360}
              minWidth={200}
              closeButton
              className="gadews-map-popup"
            >
              <div style={{ maxWidth: "min(360px, calc(100vw - 72px))", maxHeight: "min(480px, calc(100dvh - 210px))" }} className="min-w-0 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-700">
                <p className="mb-2 text-sm font-bold text-slate-950">{c("wahisEvent")}</p>
                <p className="mb-2 text-sm text-slate-600">{c("sourceOriginal")}</p>
                <PopupRow label={c("diseaseLabel")} value={compact(record.disease_name)} />
                <PopupRow label={c("countryLabel")} value={compact(record.country)} />
                <PopupRow label={c("date")} value={compact(record.event_start_date)} />
                <PopupRow label={c("source")} value="WOAH WAHIS" />
                <PopupRow label={c("statusLabel")} value={compact(record.report_status)} />
                <PopupRow label={c("diseaseId")} value={compact(record.disease_id)} />
                <PopupRow label={c("region")} value={compact(record.region)} />
                <PopupRow label={c("eventStatus")} value={compact(eventStatus)} />
                <PopupRow label={c("latest")} value={compact(latestReportDate)} />
                <PopupRow label={c("total")} value={compact(record.dashboard_summary?.total_reports)} />
                <PopupRow label={c("open")} value={compact(record.dashboard_summary?.open_outbreaks_latest)} />
                <PopupRow label={c("coordinate")} value={compact(record.coordinate_type)} />
                <p className="mt-2"><b>{c("dashboard")}</b> {linkOrDash(c("openLink"), record.dashboard_url)}</p>
                <p><b>{c("lastReport")}</b> {linkOrDash(c("openLink"), record.last_report_url)}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {c("centroid")}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function PopupRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 border-b border-slate-100 py-1 last:border-b-0">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="break-words text-slate-800">{value}</span>
    </p>
  );
}
