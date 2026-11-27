"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/components/gadews/locale-provider";
import { useEnvironment } from "@/hooks/use-environment";
import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import { numberText, unitText } from "@/lib/gadews/environment/format";
import { siteCountries } from "@/lib/gadews/environment/site-countries";
import { names, overdue, siteIds, station, variables, type Delivery, type Site } from "@/lib/gadews/environment/snapshot";
import { wahisEntry, qaadEntry, type HistoryEntry } from "@/lib/gadews/history-reports";
import { mapCopy } from "@/lib/gadews/i18n/map";
import { QAAD_FILTERS, type QaadStatusFilter, type LoadState, type SourceMetadata } from "@/lib/gadews/public-surveillance";

const measures = [
  { key: "precipitation_sum_p50", feed: "gefs" },
  { key: "temperature_2m_mean_p50", feed: "gefs" },
  { key: "sst", feed: "oisst" },
  { key: "CHL", feed: "chl-l4" },
] as const;

const inputStyle = "mt-1.5 block min-h-11 w-full rounded-md border border-slate-400 bg-white px-3 py-2 font-normal text-slate-900";
const textLink = "inline-flex items-center gap-1 font-semibold text-teal-800 underline decoration-teal-300 underline-offset-4 hover:text-teal-950";
const countryLabels = Object.fromEntries(Object.values(siteCountries).map(([zh, en]) => [en, zh]));

function RegionalComparison({ sites, data }: { sites: Site[]; data: Delivery }) {
  const { t } = useLocale();
  const [key, setKey] = useState<string>(measures[0].key);
  const [chosenDay, setDay] = useState("");
  const measure = measures.find(m => m.key === key) ?? measures[0];
  const feed = data.snapshot.feeds.find(f => f.id === measure.feed);
  const days = [...new Set(feed?.series.filter(s => sites.includes(s.site))
    .flatMap(s => s.times.map(time => time.slice(0, 10))))].sort();
  const today = new Date(data.asOf).toISOString().slice(0, 10);
  const day = days.includes(chosenDay) ? chosenDay : days.filter(d => d <= today).at(-1) ?? days[0] ?? "";
  const rows = sites.map(site => {
    const series = feed?.series.find(s => s.site === site);
    const field = series?.fields.find(f => f.key === key);
    const index = series?.times.findIndex(time => time.slice(0, 10) === day) ?? -1;
    const value = feed?.state === "unavailable" ? null : field?.values[index] ?? null;
    return {site, series, field, index, value};
  });
  const values = rows.flatMap(row => row.value === null ? [] : [row.value]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const showScale = values.length > 1 && min !== max;
  return <>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">{t("比较指标", "Comparison variable")}
        <select className={inputStyle} value={key} onChange={e => setKey(e.target.value)}>
          {measures.map(m => <option value={m.key} key={m.key}>{t(...variables[m.key])}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">{t("资料日期（UTC）", "Valid date (UTC)")}
        <select className={inputStyle} value={day} disabled={!days.length} onChange={e => setDay(e.target.value)}>
          {!days.length && <option value="">{t("无可选日期", "No dates available")}</option>}
          {days.map(d => <option key={d}>{d}</option>)}
        </select>
      </label>
    </div>
    <div className="mt-4 flex flex-wrap justify-between gap-2 border-b border-slate-300 pb-3 text-sm">
      <span>{t(...names[measure.feed])}</span>
      <span>{t("有数值的代表点", "Sites with values")} <strong>{values.length}/{sites.length}</strong></span>
    </div>
    {feed && overdue(feed, data.asOf) && <p className="mt-2 text-sm text-amber-800">
      {t("本产品待更新，以下值按资料日期保留。", "This product is awaiting an update. Values retain their original dates.")}
    </p>}
    <ul className="divide-y divide-slate-200">
      {rows.map(({site, series, field, index, value}) =>
        <li key={site} className="grid items-center gap-2 py-3 sm:grid-cols-[minmax(11rem,1fr)_minmax(6rem,0.6fr)_minmax(8rem,auto)] sm:gap-6">
          <div><Link className={textLink} href={"/workspaces/regional?site=" + site + (day ? "&day=" + day : "")}>
            {t(station[site][0], station[site][1])}<ArrowUpRight size={15} aria-hidden="true"/>
          </Link>
            {series && <p className="mt-1 text-xs text-slate-600">{t("资料格点", "Source grid cell")} {series.lat.toFixed(2)}°, {series.lon.toFixed(2)}°</p>}
          </div>
          <div aria-hidden="true" className="hidden sm:block">
            {showScale && value !== null && <div className="relative mx-1 h-px bg-slate-300">
              <span className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full bg-teal-700" style={{left: ((value - min) / (max - min)) * 100 + "%"}}/>
            </div>}
          </div>
          {value !== null && field && series ? <div className="sm:text-right">
            <strong className="font-mono text-lg">{numberText(value)} {unitText(field.unit)}</strong>{" "}
            <a className="text-xs text-teal-800 underline" href={series.source} target="_blank" rel="noreferrer">{t("来源", "Source")}</a>
          </div> : <span className="text-sm text-slate-600">{
            !feed || feed.state === "unavailable" ? t("资料未取得", "Source unavailable")
            : !series ? t("该产品未覆盖此点", "Outside this product’s sampled sites")
            : index < 0 ? t("当日无资料", "No data for this date") : t("格点缺测", "Missing grid value")
          }</span>}
        </li>)}
    </ul>
    {showScale && <p className="mt-2 text-sm text-slate-700">{t("本次有值代表点范围", "Range across sites with values")} · {numberText(min)}–{numberText(max)} {unitText(rows.find(row => row.value !== null)?.field?.unit ?? "")}</p>}
    <p className="mt-2 text-xs leading-5 text-slate-600">{measure.feed === "gefs"
      ? t("P50 为集合预报成员的中位数。各点采用同一产品与有效日，不能由这些点推断全国发病率。", "P50 is the ensemble median. Sites share the same product and valid date; these values do not estimate national disease incidence.")
      : t("显示当期所选产品在代表点的海洋网格值，具体养殖水域需核对点位和实际覆盖。", "These are marine grid values at the sampled sites. Check the grid location and coverage for a specific waterbody.")}</p>
  </>;
}

function HistoryCard({ title, caption, rows, state, metadata, retry }: {
  title: string; caption: string; rows: HistoryEntry[]; state: LoadState; metadata?: SourceMetadata; retry: () => void;
}) {
  const { t } = useLocale();
  const ready = state === "success" || state === "empty";
  const ordered = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  return <section className="min-w-0 rounded-xl border border-slate-300 bg-white p-5">
    <h3 className="font-semibold text-teal-900">{title}</h3>
    <div className="my-3 flex items-baseline gap-2">
      <strong className="text-3xl font-semibold tabular-nums">{ready ? rows.length : "—"}</strong><span className="text-sm">{caption}</span>
    </div>
    {state === "error" ? <button className={textLink} onClick={retry}>{t("来源暂不可用，重试", "Source unavailable · retry")}</button> :
      !ready ? <p role="status">{t("读取中…", "Loading…")}</p> : <>
        <p className="text-xs leading-5 text-slate-600">{t("来源快照覆盖期", "Source snapshot coverage")} {metadata?.coverage.from ?? "—"} – {metadata?.coverage.to ?? "—"}</p>
        {ordered.length > 0 ? <details className="mt-3 border-t border-slate-200 pt-3">
          <summary className="cursor-pointer text-sm font-semibold">{t("查看最近记录", "Inspect recent records")}</summary>
          <ul className="mt-2 divide-y divide-slate-200">{ordered.slice(0,5).map((r,i) => <li key={i} className="py-2 text-sm">
            <span className="block text-xs text-slate-600">{r.date || t("资料期未标注", "Period unspecified")}</span>
            {r.status && <p className="text-xs text-slate-700">{(QAAD_FILTERS as readonly string[]).includes(r.status) && r.status !== "all" && r.status !== "priority"
              ? t(...mapCopy[r.status as Exclude<QaadStatusFilter, "all" | "priority">]) : r.status}</p>}
            {r.url?.startsWith("https://") ? <a className={textLink} href={r.url} target="_blank" rel="noreferrer">{r.name}</a> : r.name}
          </li>)}</ul>
        </details> : <p className="mt-2 text-sm">{t("所选范围无匹配记录。", "No matching records for this selection.")}</p>}
        {metadata?.sourceUrls[0] && <a className={textLink + " mt-3 text-xs"} href={metadata.sourceUrls[0]} target="_blank" rel="noreferrer">{t("发布机构", "Publisher")}<ArrowUpRight size={13} aria-hidden="true"/></a>}
      </>}
  </section>;
}

export default function NationalWorkspace() {
  const { t } = useLocale();
  const [country, setCountry] = useState("China");
  const [year, setYear] = useState("");
  const environment = useEnvironment();
  const wahis = usePublicSurveillance("wahis", true);
  const qaad = usePublicSurveillance("qaad", true);
  const events = useMemo(() => wahis.records.map(wahisEntry), [wahis.records]);
  const monitoring = useMemo(() => qaad.records.map(qaadEntry), [qaad.records]);
  const countries = useMemo(() => [...new Set([...Object.keys(countryLabels), ...events.map(r => r.country), ...monitoring.map(r => r.country)])].sort(), [events, monitoring]);
  const nationalEvents = events.filter(r => r.country === country);
  const nationalMonitoring = monitoring.filter(r => r.country === country);
  const years = [...new Set([...nationalEvents, ...nationalMonitoring].map(r => r.year).filter(Boolean))].sort().reverse();
  const sites = siteIds.filter(site => siteCountries[site][1] === country);
  return <div className="space-y-8 text-slate-900">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-teal-900/25 pb-6">
      <div><h1 className="text-3xl font-bold tracking-tight text-[#103c46] sm:text-4xl">{t("国家监测总览", "National monitoring overview")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{t("比较同一日期各地区代表点的环境资料，并核对本国公开疫病报告。", "Compare regional reference sites on the same day and check national public disease reports.")}</p>
      </div>
      <label className="w-full text-sm font-semibold sm:w-60">{t("报告国家或地区", "Reporting country or territory")}
        <select className={inputStyle} value={country} onChange={e => {setCountry(e.target.value);setYear("");}}>
          {countries.map(c => <option key={c} value={c}>{t(countryLabels[c] ?? c,c)}</option>)}
        </select>
      </label>
    </header>
    <section className="rounded-xl border border-teal-900/20 bg-white p-5 sm:p-7">
      <h2 className="mb-1 text-xl font-bold text-[#103c46]">{t("地区环境对照", "Regional environmental comparison")}</h2>
      <p className="mb-5 text-sm leading-6 text-slate-600">{t("先核对哪些代表点有资料，再进入监测站查看同日依据及缺项。", "Check reference-site coverage, then open the monitoring station to review evidence and gaps for that day.")}</p>
      {!sites.length ? <p className="rounded-md bg-slate-50 p-3 text-sm">{t("本站尚未为该国家或地区设置环境代表点。", "No environmental reference site is configured here.")}</p> : <>
        {environment.error && <button type="button" className={textLink} onClick={environment.retry}>{t("快照读取失败，重试", "Snapshot unavailable · retry")}</button>}
        {environment.data ? <RegionalComparison key={country} sites={sites} data={environment.data}/> :
          !environment.error && <p role="status">{t("正在读取公开环境资料…", "Loading public environmental data…")}</p>}
      </>}
    </section>
    <section aria-labelledby="national-history-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="national-history-title" className="text-xl font-bold text-[#103c46]">{t("全国公开历史报告", "National public reporting history")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("按来源的国家或地区名称统计。零条记录不能推断无疫。", "Grouped by the reporting jurisdiction in each source. Zero records cannot establish absence.")}</p>
        </div>
        <label className="w-full text-sm font-semibold sm:w-44">{t("历史报告年份", "Historical reporting year")}
          <select className={inputStyle} value={year} onChange={e => setYear(e.target.value)}>
            <option value="">{t("全部年份", "All years")}</option>
            {years.map(y=><option key={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
        <HistoryCard title="WOAH WAHIS" caption={t("历史事件（按开始日）", "historical events by start date")}
          rows={nationalEvents.filter(r => !year || r.year === year)} state={wahis.state} metadata={wahis.metadata} retry={wahis.retry}/>
        <HistoryCard title="NACA QAAD" caption={t("监测汇总（按原报告期）", "surveillance records by reporting period")}
          rows={nationalMonitoring.filter(r => !year || r.year === year)} state={qaad.state} metadata={qaad.metadata} retry={qaad.retry}/>
      </div>
    </section>
  </div>;
}
