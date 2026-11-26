"use client";

import { useMemo, useState } from "react";
import type { HistoryEntry, HistoryScope } from "@/lib/gadews/history-reports";
import { QAAD_FILTERS, type MapDiseaseFilter, type QaadStatusFilter } from "@/lib/gadews/public-surveillance";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";
import type { LayerStats } from "./woah-wahis-layer";
import { PublicSourceStatus } from "./public-source-status";

function StatLine({ label, value }: { label: string; value: string | number }) {
  return <div className="flex flex-wrap justify-between gap-2"><span>{label}</span><strong className="break-words">{value}</strong></div>;
}
function ReportList({ title, entries }: { title: string; entries: HistoryEntry[] }) {
  const { t } = useLocale();
  const c = useCopy(mapCopy);
  const [limit, setLimit] = useState(8);
  const sorted = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  return <details className="rounded-lg border border-slate-200 px-3 py-2">
    <summary className="cursor-pointer font-semibold">{title} ({entries.length})</summary>
    <ul className="divide-y divide-slate-200">
      {sorted.slice(0, limit).map((r, i) => <li className="py-2" key={i}>
        <p className="font-medium">{r.name}</p>
        <p>{r.country} · {r.date || t("日期未知", "Date unknown")}</p>
        {r.status && <p>{(QAAD_FILTERS as readonly string[]).includes(r.status) && r.status !== "all" && r.status !== "priority"
          ? c(r.status as Exclude<QaadStatusFilter, "all" | "priority">) : r.status}</p>}
        {r.url && <a className="text-teal-800 underline" href={r.url} target="_blank" rel="noreferrer">{c("openReport")}</a>}
      </li>)}
    </ul>
    {sorted.length > limit && <button type="button" className="font-semibold text-teal-800 underline" onClick={() => setLimit(limit + 8)}>{t("显示更多记录", "Show more records")}</button>}
  </details>;
}

export function LegendToolkit({ scope, diseaseFilter, qaadStatusFilter, wahisStats, qaadStats, enabled = { wahis: true, qaad: true } }: {
  scope?: HistoryScope;
  diseaseFilter: MapDiseaseFilter;
  qaadStatusFilter: QaadStatusFilter;
  wahisStats?: LayerStats;
  qaadStats?: LayerStats;
  enabled?: { wahis: boolean; qaad: boolean };
}) {
  const c = useCopy(mapCopy);
  const { t } = useLocale();
  const period = [scope?.year || t("全部年份", "All years"), scope?.quarter && "Q" + scope.quarter].filter(Boolean).join(" · ");
  const sources = [
    {id: "wahis", name: "WOAH WAHIS", title: c("wahisCount"), list: t("WAHIS 事件明细", "WAHIS event details"), visible: enabled.wahis, stats: wahisStats},
    {id: "qaad", name: "NACA QAAD", title: c("qaadCount"), list: t("QAAD 监测明细", "QAAD surveillance details"), visible: enabled.qaad, stats: qaadStats},
  ];
  const visible = sources.filter(s => s.visible);
  const readySources = visible.filter(s => s.stats?.state === "success" || s.stats?.state === "empty");
  const countries = new Set(readySources.flatMap(s => s.stats?.countries ?? []));
  const originalId = diseaseFilter.slice("source:".length);
  const diseaseLabel = diseaseFilter === "all" || diseaseFilter === "other" ? c(diseaseFilter)
    : diseaseFilter.startsWith("source:")
      ? qaadStats?.options?.diseases.get(originalId) ?? wahisStats?.options?.diseases.get(originalId) ?? originalId
      : diseaseFilter;
  return <section className="w-[300px] max-w-full space-y-4 rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 shadow-xl" aria-label={c("reports")}>
    <h2 className="text-lg font-bold text-slate-950">{c("reports")}</h2>
    <div className="border-l-2 border-teal-700 pl-3">
      <p className="font-semibold">{scope?.country || t("全球历史记录", "Worldwide historical records")}</p>
      <p>{period} · {diseaseLabel}</p>
      {enabled.qaad && <p>{c("status")} · {c(qaadStatusFilter === "all" ? "allStatuses" : qaadStatusFilter)}</p>}
      {(scope?.from || scope?.to) && <p>WAHIS · {scope.from || "…"} — {scope.to || "…"}</p>}
    </div>
    {sources.map(s => {
      const ready = s.stats?.state === "success" || s.stats?.state === "empty";
      return <div key={s.id} className="space-y-1">
        <StatLine label={s.title} value={!s.visible ? t("已关闭", "Off") : ready ? s.stats!.recordsDisplayed : "—"} />
        {s.visible && ready && (s.stats!.recordsDisplayed === 0
          ? <p className="text-sm text-slate-600">{t("当前条件下无匹配记录。", "No records match the current filters.")}</p>
          : <ReportList title={s.list} entries={s.stats?.entries ?? []} />)}
      </div>;
    })}
    <StatLine label={readySources.length > 0 && readySources.length < visible.length
      ? t("已加载来源覆盖国家或地区", "Countries/territories in available sources") : c("countries")}
      value={readySources.length ? countries.size : "—"} />
    <details><summary className="cursor-pointer font-bold">{t("资料期与来源", "Snapshot coverage and sources")}</summary>
      <p>{c("centroid")}</p><p>{c("scope")}</p>
      {sources.filter(s => s.visible).map(s => <PublicSourceStatus key={s.id} title={s.name} {...s.stats} />)}
    </details>
    {sources.filter(s => s.visible && s.stats?.state === "error").map(s =>
      <button key={s.id} type="button" className="text-teal-800 underline" onClick={s.stats?.retry}>{t(s.name + " 不可用 · 重试", s.name + " unavailable · Retry")}</button>)}
    <details><summary className="cursor-pointer font-bold">{t("WAHIS 病种颜色", "WAHIS disease colors")}</summary><ul className="mt-3 grid grid-cols-2 gap-2">{[["WSD", "#ef4444"], ["AHPND", "#f97316"], ["KHV", "#eab308"], ["TILV", "#22d3ee"], ["EUS", "#a855f7"], ["VHS", "#3b82f6"], ["IHN", "#14b8a6"], ["SVC", "#f43f5e"], [c("other"), "#94a3b8"]].map(([label,color]) => <li key={label} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />{label}</li>)}</ul></details>
    <details><summary className="cursor-pointer font-bold">{c("status")}</summary><ul className="mt-3 space-y-2">{(["present_in_quarter", "historical_presence_in_report_year", "absent_in_quarter", "absent_in_report_year", "no_information", "unknown"] as const).map((key, index) => <li key={key} className="flex items-start gap-2"><span aria-hidden="true" className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:["#ef4444", "#f59e0b", "#22c55e", "#14804a", "#64748b", "#475569"][index]}} />{c(key)}</li>)}</ul></details>
  </section>;
}
