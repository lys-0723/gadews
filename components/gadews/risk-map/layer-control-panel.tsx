"use client";

import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";
import type { QaadStatusFilter } from "./qaad-surveillance-layer";
import type { DiseaseFilter } from "./woah-wahis-layer";

interface LayerControlPanelProps {
  layers: { regionalDemo?: boolean; boundaries: boolean; waterSystems: boolean; farmDensity: boolean; sst: boolean; chlorophyll: boolean; rainfall: boolean; heatmap: boolean; cases: boolean; coverage: boolean; wahis: boolean; qaad: boolean };
  onToggle: (key: string, value: boolean) => void;
  diseaseFilter: DiseaseFilter;
  onDiseaseFilterChange: (value: DiseaseFilter) => void;
  qaadStatusFilter: QaadStatusFilter;
  onQaadStatusFilterChange: (value: QaadStatusFilter) => void;
}
const diseases: DiseaseFilter[] = ["all", "WSD", "AHPND", "KHV", "TILV", "EUS", "VHS", "IHN", "SVC", "other"];
const statuses: QaadStatusFilter[] = ["priority", "all", "present_in_quarter", "historical_presence_in_report_year", "absent_in_quarter", "no_information", "unknown"];

export function LayerControlPanel({ layers, onToggle, diseaseFilter, onDiseaseFilterChange, qaadStatusFilter, onQaadStatusFilterChange }: LayerControlPanelProps) {
  const c = useCopy(mapCopy);
  const { t } = useLocale();
  return <section className="w-80 max-w-[calc(100vw-5rem)] space-y-5 rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-relaxed text-slate-800 shadow-xl" aria-label={c("layers")}>
    <h1 className="text-lg font-bold text-slate-950">{c("layers")}</h1>
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-teal-950">
      <input id="regional-demo-toggle" type="checkbox" className="h-5 w-5 shrink-0 accent-teal-800" aria-labelledby="regional-demo-title" aria-describedby="regional-demo-hint" checked={!!layers.regionalDemo} onChange={e => onToggle("regionalDemo", e.target.checked)} />
      <span>
        <span id="regional-demo-title" className="block font-semibold">{t("区域监测演示", "Regional monitoring demo")}</span>
        <span id="regional-demo-hint" className="block text-sm">{t("查找试点周边的巡查和水质记录", "Find health and water quality records near a sample site")}</span>
      </span>
    </label>
    <fieldset className="space-y-3"><legend className="mb-2 font-bold">{c("official")}</legend>
      {(["wahis", "qaad"] as const).map(key => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={layers[key]} onChange={e => onToggle(key, e.target.checked)} className="h-5 w-5 accent-sky-800" />{key === "wahis" ? "WOAH WAHIS" : "NACA QAAD"}</label>)}
    </fieldset>
    <label className="block space-y-2"><span className="font-semibold">{c("disease")}</span><select className="w-full rounded-lg border border-slate-400 bg-white p-2 text-sm" value={diseaseFilter} onChange={e => onDiseaseFilterChange(e.target.value as DiseaseFilter)}>{diseases.map(value => <option key={value} value={value}>{value === "all" || value === "other" ? c(value) : value}</option>)}</select></label>
    <label className="block space-y-2"><span className="font-semibold">{c("status")}</span><select className="w-full rounded-lg border border-slate-400 bg-white p-2 text-sm" value={qaadStatusFilter} onChange={e => onQaadStatusFilterChange(e.target.value as QaadStatusFilter)}>{statuses.map(value => <option key={value} value={value}>{c(value === "all" ? "allStatuses" : value)}</option>)}</select></label>
    <p>{c("qaadNote")}</p>
    <details className="border-t border-slate-200 pt-3"><summary className="cursor-pointer font-bold">{c("demo")}</summary><div className="mt-3 space-y-3">{(["cases", "heatmap"] as const).map(key => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={layers[key]} onChange={e => onToggle(key, e.target.checked)} className="h-5 w-5 accent-sky-800" />{c(key)}</label>)}<p>{c("unavailable")}</p></div></details>
  </section>;
}
