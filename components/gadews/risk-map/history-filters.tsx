"use client";

import { useState } from "react";
import { useLocale } from "../locale-provider";
import type { HistoryScope } from "@/lib/gadews/history-reports";

const select = "mt-1 w-full rounded-lg border border-slate-400 bg-white px-2 py-2 text-sm";
export interface HistoryControls {
  scope: HistoryScope;
  countries: string[];
  years: string[];
  diseases: [string, string][];
  onChange: (next: HistoryScope) => void;
  onReset: () => void;
}

export function HistoryFilters({ scope, countries, years, onChange, onReset }: HistoryControls) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<Pick<HistoryScope, "from" | "to"> | null>(null);
  const range = draft ?? scope;
  function updateDate(key: "from" | "to", value: string) {
    const dates = { from: range.from, to: range.to, [key]: value };
    if (dates.from && dates.to && dates.from > dates.to) {
      setDraft(dates);
      return;
    }
    setDraft(null);
    onChange({ ...scope, ...dates });
  }
  function update(key: keyof HistoryScope, value: string) {
    onChange({ ...scope, [key]: value });
  }

  return <fieldset className="space-y-3">
    <legend className="font-semibold">{t("历史报告范围", "Historical report scope")}</legend>
    <label className="block">{t("报告国家或地区", "Reporting country or territory")}
      <select className={select} value={scope.country} onChange={e => update("country", e.target.value)}>
        <option value="">{t("全球", "Worldwide")}</option>
        {countries.map(country => <option key={country}>{country}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-2">
      <label>{t("年份", "Year")}
        <select className={select} value={scope.year} onChange={e => update("year", e.target.value)}>
          <option value="">{t("全部年份", "All years")}</option>
          {years.map(year => <option key={year}>{year}</option>)}
        </select>
      </label>
      <label>{t("季度", "Quarter")}
        <select className={select} value={scope.quarter} onChange={e => update("quarter", e.target.value)}>
          <option value="">{t("全年", "All quarters")}</option>
          {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
        </select>
      </label>
    </div>
    <details>
      <summary className="cursor-pointer text-teal-800">{t("限定 WAHIS 事件起始日", "Limit WAHIS event start dates")}</summary>
      <div className="mt-2 grid gap-2">
        <label>{t("自", "From")}<input type="date" className={select} value={range.from} max={range.to || undefined} aria-invalid={!!draft} onChange={e => updateDate("from", e.target.value)} /></label>
        <label>{t("至", "Through")}<input type="date" className={select} value={range.to} min={range.from || undefined} aria-invalid={!!draft} onChange={e => updateDate("to", e.target.value)} /></label>
        {draft && <p role="alert">{t("结束日期应在开始日期或其后。当前结果仍按上一次有效日期筛选。", "The end date must be on or after the start. Results still use the last valid dates.")}</p>}
      </div>
    </details>
    <p className="text-xs text-slate-600">{t("年份和季度按 WAHIS 事件起始日、QAAD 原报告期筛选。仅有年度报告期的记录保留在全年视图。", "Year and quarter use the WAHIS event start and the QAAD reporting period. Year-only reports appear in the all-quarters view.")}</p>
    <button type="button" className="font-semibold text-teal-800 underline underline-offset-2" onClick={() => { setDraft(null); onReset(); }}>{t("重置报告筛选", "Reset report filters")}</button>
  </fieldset>;
}
