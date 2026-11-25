"use client";

import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";
import type { LayerStats } from "./woah-wahis-layer";
import { PublicSourceStatus } from "./public-source-status";

function StatLine({ label, value }: { label: string; value: string | number }) {
  return <div className="flex flex-wrap justify-between gap-2"><span>{label}</span><strong className="break-words">{value}</strong></div>;
}
export function LegendToolkit({ wahisStats, qaadStats }: { wahisStats?: LayerStats; qaadStats?: LayerStats }) {
  const c = useCopy(mapCopy);
  const { t } = useLocale();
  const countries = new Set([...(wahisStats?.countries ?? []), ...(qaadStats?.countries ?? [])]);
  return <section className="w-[300px] max-w-full space-y-4 rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 shadow-xl" aria-label={c("reports")}>
    <h2 className="text-lg font-bold text-slate-950">{c("reports")}</h2>
    <p>{c("centroid")}</p><p>{c("scope")}</p>
    <details open><summary className="cursor-pointer font-bold">{c("view")}</summary><div className="mt-3 space-y-3">
      <StatLine label={c("wahisCount")} value={wahisStats?.recordsDisplayed ?? 0} />
      <StatLine label={c("qaadCount")} value={qaadStats?.recordsDisplayed ?? 0} />
      <StatLine label={c("countries")} value={countries.size} />
      <StatLine label={c("top")} value={wahisStats?.topDisease !== "--" ? wahisStats?.topDisease ?? "--" : qaadStats?.topDisease ?? "--"} />
      <PublicSourceStatus title="WOAH WAHIS" {...wahisStats} /><PublicSourceStatus title="NACA QAAD" {...qaadStats} />
    </div></details>
    <details><summary className="cursor-pointer font-bold">{t("WAHIS 病种颜色", "WAHIS disease colors")}</summary><ul className="mt-3 grid grid-cols-2 gap-2">{[["WSD", "#ef4444"], ["AHPND", "#f97316"], ["KHV", "#eab308"], ["TILV", "#22d3ee"], ["EUS", "#a855f7"], ["VHS", "#3b82f6"], ["IHN", "#14b8a6"], ["SVC", "#f43f5e"], [c("other"), "#94a3b8"]].map(([label,color]) => <li key={label} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />{label}</li>)}</ul></details>
    <details><summary className="cursor-pointer font-bold">{c("status")}</summary><ul className="mt-3 space-y-2">{(["present_in_quarter", "historical_presence_in_report_year", "absent_in_quarter", "no_information", "unknown"] as const).map((key, index) => <li key={key} className="flex items-start gap-2"><span aria-hidden="true" className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:["#ef4444", "#f59e0b", "#22c55e", "#64748b", "#475569"][index]}} />{c(key)}</li>)}</ul></details>
  </section>;
}
