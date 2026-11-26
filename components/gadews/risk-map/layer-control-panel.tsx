"use client";

import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";
import type { QaadStatusFilter } from "./qaad-surveillance-layer";
import type { DiseaseFilter } from "./woah-wahis-layer";

import { HistoryFilters, type HistoryControls } from "./history-filters";
import { DISEASE_FILTERS, QAAD_FILTERS } from "@/lib/gadews/public-surveillance";

interface LayerControlPanelProps {
  history?: HistoryControls;
  layers: { wahis: boolean; qaad: boolean; [key: string]: boolean | undefined };
  onToggle: (key: string, value: boolean) => void;
  diseaseFilter: DiseaseFilter;
  onDiseaseFilterChange: (value: DiseaseFilter) => void;
  qaadStatusFilter: QaadStatusFilter;
  onQaadStatusFilterChange: (value: QaadStatusFilter) => void;
}
export function LayerControlPanel({ history, layers, onToggle, diseaseFilter, onDiseaseFilterChange, qaadStatusFilter, onQaadStatusFilterChange }: LayerControlPanelProps) {
  const c = useCopy(mapCopy);
  const { t } = useLocale();
  return <section className="w-80 max-w-[calc(100vw-5rem)] space-y-5 rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-relaxed text-slate-800 shadow-xl" aria-label={c("layers")}>
    <h1 className="text-lg font-bold text-slate-950">{t("全球历史报告", "Global historical reports")}</h1>
    {history && <HistoryFilters {...history}/>}
    <fieldset className="space-y-3"><legend className="mb-2 font-bold">{c("official")}</legend>
      {(["wahis", "qaad"] as const).map(key => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={layers[key]} onChange={e => onToggle(key, e.target.checked)} className="h-5 w-5 accent-sky-800" />{key === "wahis" ? "WOAH WAHIS" : "NACA QAAD"}</label>)}
    </fieldset>
    <label className="block space-y-2"><span className="font-semibold">{c("disease")}</span><select className="w-full rounded-lg border border-slate-400 bg-white p-2 text-sm" value={diseaseFilter} onChange={e => onDiseaseFilterChange(e.target.value as DiseaseFilter)}>{DISEASE_FILTERS.map(value => <option key={value} value={value}>{value === "all" || value === "other" ? c(value) : value}</option>)}{history?.diseases.map(([id, name]) =>
      <option key={id} value={"source:" + id}>{name}</option>)}</select></label>
    <label className="block space-y-2"><span className="font-semibold">{c("status")}</span><select className="w-full rounded-lg border border-slate-400 bg-white p-2 text-sm" value={qaadStatusFilter} onChange={e => onQaadStatusFilterChange(e.target.value as QaadStatusFilter)}>{QAAD_FILTERS.map(value => <option key={value} value={value}>{c(value === "all" ? "allStatuses" : value)}</option>)}</select></label>
    <p>{c("qaadNote")}</p>
  </section>;
}
