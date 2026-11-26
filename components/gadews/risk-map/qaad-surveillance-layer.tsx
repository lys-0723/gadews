"use client";

import { useEffect, useMemo } from "react";
import { useCopy } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";
import { allHistory, historyOptions, qaadEntry, qaadMarkerKey, matchesQaadScope, type HistoryScope, type HistoryStats } from "@/lib/gadews/history-reports";
import { CircleMarker, Popup, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import { computeLayerStats, filterQaad, normalizeStatus, type QaadDisplayRecord as QaadRecord, type QaadStatusFilter } from "@/lib/gadews/public-surveillance";
export type { QaadStatusFilter } from "@/lib/gadews/public-surveillance";

interface QaadSurveillanceLayerProps {
  visible: boolean;
  history?: HistoryScope;
  statusFilter: QaadStatusFilter;
  diseaseFilter: import("@/lib/gadews/public-surveillance").MapDiseaseFilter;
  onStatsChange?: (stats: HistoryStats) => void;
}

const STATUS_COLORS: Record<string, string> = {
  present_in_quarter: "#ef4444",
  historical_presence_in_report_year: "#f59e0b",
  absent_in_quarter: "#22c55e",
  absent_in_report_year: "#14804a",
  no_information: "#64748b",
  unknown: "#475569",
};

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function jitterPosition(record: QaadRecord, seedKey: string): LatLngExpression {
  const hash = hashString(seedKey);
  const angle = (hash % 360) * (Math.PI / 180);
  const distance = 0.12 + ((hash % 11) * 0.008);
  return [
    Number(record.latitude) + Math.sin(angle) * distance,
    Number(record.longitude) + Math.cos(angle) * distance,
  ];
}

function compact(value: unknown) {
  if (value === undefined || value === null || value === "") return "--";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "--";
  return String(value);
}

function firstComment(value?: string[] | string | null) {
  const comment = Array.isArray(value) ? value[0] : value;
  if (!comment) return "--";
  return comment.length > 180 ? `${comment.slice(0, 180)}...` : comment;
}

function firstLink(label: string, urls?: string[] | null) {
  const url = urls?.[0];
  if (!url) return <span>--</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="break-words text-teal-700 underline">
      {label}
    </a>
  );
}

export function QaadSurveillanceLayer({
  visible,
  history = allHistory,
  statusFilter,
  diseaseFilter,
  onStatsChange,
}: QaadSurveillanceLayerProps) {
  const c = useCopy(mapCopy);
  const { records, state, metadata, rejectedCount, error, retry } = usePublicSurveillance("qaad", visible);
  const options = useMemo(() => historyOptions(records.map(qaadEntry)), [records]);
  const filteredRecords = useMemo(() => visible ? filterQaad(records, diseaseFilter, statusFilter).filter(r => matchesQaadScope(r, history)) : [], [records, visible, statusFilter, diseaseFilter, history]);
  useEffect(() => {
    onStatsChange?.({ ...computeLayerStats(filteredRecords, "qaad"), options, entries: filteredRecords.map(qaadEntry), state, metadata, rejectedCount, error: visible ? error : undefined, retry });
  }, [filteredRecords, options, state, metadata, rejectedCount, error, retry, visible, onStatsChange]);

  if (!visible) return null;

  return (
    <>
      {filteredRecords.map((record) => {
        const status = normalizeStatus(record.status_summary);
        const color = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
        const radius =
          status === "present_in_quarter"
            ? 5
            : status === "historical_presence_in_report_year"
            ? 4.5
            : 3.5;
        const markerKey = qaadMarkerKey(record);

        return (
          <CircleMarker
            key={markerKey}
            center={jitterPosition(record, markerKey)}
            eventHandlers={{ add: event => { const element = event.target.getElement(); if (element) { element.setAttribute("tabindex", "0"); element.setAttribute("role", "button"); element.setAttribute("aria-label", `${compact(record.disease_name)} · ${compact(record.country_or_territory)}`); element.onkeydown = (key: KeyboardEvent) => { if (key.key === "Enter" || key.key === " ") { key.preventDefault(); event.target.openPopup(); } }; } } }}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: status === "unknown" ? 0.28 : 0.58,
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div className="text-sm font-bold">{compact(record.disease_name)}</div>
              <div className="text-sm">{compact(record.country_or_territory)}</div>
              <div className="text-sm">{compact(record.status_summary)}</div>
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
                <p className="mb-2 text-sm font-bold text-slate-950">{c("qaadSummary")}</p>
                <p className="mb-2 text-sm text-slate-600">{c("sourceOriginal")}</p>
                <PopupRow label={c("diseaseLabel")} value={compact(record.disease_name)} />
                <PopupRow label={c("countryLabel")} value={compact(record.country_or_territory)} />
                <PopupRow label={c("date")} value={compact(record.report_period)} />
                <PopupRow label={c("source")} value="NACA QAAD" />
                <PopupRow label={c("statusLabel")} value={compact(record.status_summary)} />
                <PopupRow label={c("diseaseId")} value={compact(record.disease_id)} />
                <PopupRow label={c("region")} value={compact(record.region)} />
                <PopupRow label={c("positiveMonths")} value={compact(record.positive_months)} />
                <PopupRow label={c("absentMonths")} value={compact(record.absent_months)} />
                <PopupRow label={c("noInfo")} value={compact(record.no_information_months)} />
                <PopupRow label={c("diagnosis")} value={compact(record.diagnosis_levels)} />
                <p className="mt-2"><b>{c("comment")}</b> <span className="break-words">{firstComment(record.epidemiological_comments)}</span></p>
                <p><b>{c("report")}</b> {firstLink(c("openReport"), record.report_file_urls ?? record.source_urls)}</p>
                <PopupRow label={c("coordinate")} value={compact(record.coordinate_type)} />
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
      <span className="min-w-0 [overflow-wrap:anywhere] text-slate-800">{value}</span>
    </p>
  );
}
