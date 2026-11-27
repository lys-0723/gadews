"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, ChevronRight, ClipboardCheck, MapPin } from "lucide-react";
import { useLocale } from "@/components/gadews/locale-provider";
import { useEnvironment } from "@/hooks/use-environment";
import { numberText, unitText } from "@/lib/gadews/environment/format";
import { regionalDates, regionalEvidence, regionalLayerTime, type EvidenceReading } from "@/lib/gadews/environment/regional-evidence";
import { names, siteIds, station, variables, type FeedId, type Site } from "@/lib/gadews/environment/snapshot";
import { getRegionalDemoSummary } from "@/lib/gadews/regional-monitoring-demo";

type Copy = (zh: string, en: string) => string;
type Evidence = ReturnType<typeof regionalEvidence>;
const control = "mt-1 block w-full rounded-md border border-[#b4c7c8] bg-white px-3 py-2.5 font-medium text-[#153d4c]";
const sectionTitle = "text-xl font-semibold tracking-tight text-[#153d4c]";
const linkStyle = "font-semibold text-teal-800 underline decoration-teal-800/40 underline-offset-4 hover:decoration-teal-800";
const stateText: Record<Evidence["state"], [string, string]> = {
  dated: ["有当日环境资料", "Current environmental evidence"],
  forecast: ["有逐日或逐时预报", "Daily or subdaily forecast available"],
  archived: ["历史资料回看", "Historical evidence review"],
  outlook: ["仅有周或月度展望", "Weekly or monthly outlook only"],
  historical: ["仅有较早期资料", "Earlier evidence only"],
  insufficient: ["资料不足或待更新", "Insufficient or stale evidence"],
};
const detailsUrl = (site: Site, id: FeedId) => `/overview?site=${site}&product=${id}#environment-evidence`;
const displayTime = (time: string) => time.replace("T", " ").replace(/(\.\d+)?Z$/, "");

function variableLabel(key: string, t: Copy) {
  if (key === "Rain Rate") return t("雨强色阶", "Rain-rate interval");
  if (key === "Snow Rate") return t("降雪率色阶", "Snow-rate interval");
  return variables[key] ? t(...variables[key]) : key;
}

function evidenceValue(r: EvidenceReading) {
  if (r.interval) return r.high === null ? "≥ " + numberText(r.low) : `[${numberText(r.low)}, ${numberText(r.high)})`;
  return r.high !== null && r.high !== r.low ? numberText(r.low) + "–" + numberText(r.high) : numberText(r.low);
}

function EvidenceRow({ r, site }: { r: EvidenceReading; site: Site }) {
  const { t } = useLocale();
  return <details className="group border-b border-[#dce6e4] last:border-0">
    <summary className="cursor-pointer list-none py-3 focus-visible:outline-teal-700">
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-medium text-[#183d47]">{variableLabel(r.variable, t)}</span>
          <span className="mt-1 block text-xs text-slate-600">{t(...names[r.id])}{r.old && " · " + t("待更新", "Stale")}</span>
        </span>
        <span className="flex items-center gap-2 text-right text-sm font-semibold tabular-nums sm:text-base">
          <span>{evidenceValue(r)} {unitText(r.unit)}</span>
          <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-teal-700 transition-transform group-open:rotate-90"/>
        </span>
      </span>
    </summary>
    <div className="space-y-1 border-l-2 border-[#abc9c2] pl-3 mb-3 text-sm text-slate-700">
      <p>{t("有效时段", "Valid period")} · {displayTime(r.first)}{r.last !== r.first && " – " + displayTime(r.last)} UTC</p>
      <p>{t("来源位置", "Source location")} · {r.lat.toFixed(3)}°, {r.lon.toFixed(3)}°{r.depth !== null && " · " + t("深度", "Depth") + " " + numberText(r.depth) + " m"}</p>
      {r.total > 1 && <p>{t("当日有效时次", "Valid steps that day")} · {r.count}/{r.total} · {t("显示最低至最高值", "Minimum to maximum")}</p>}
      <p className="flex flex-wrap gap-x-4"><Link href={detailsUrl(site, r.id)} className={linkStyle}>{t("查看产品时序", "Product time series")}</Link>
        <a href={r.source} target="_blank" rel="noreferrer" className={linkStyle}>{t("核对原始数据", "Inspect source")}</a></p>
    </div>
  </details>;
}

const gapText: Record<Evidence["gaps"][number]["reason"], [string, string]> = {
  unavailable: ["来源暂不可用", "Source unavailable"],
  date: ["资料期未覆盖所选日期", "Product does not cover this day"],
  missing: ["代表点数值缺测", "Missing value at the reference point"],
  "no-rate-class": ["中心无可判读色阶，可能为微量降水或缺测", "No readable centre class; trace precipitation or missing data"],
};

function ReviewExercise() {
  const { t } = useLocale();
  const [stage, setStage] = useState(0);
  const record = getRegionalDemoSummary("A", 3000).records.find(item => item.waterSystem === null);
  if (!record) return null;
  const descriptions = [
    t("巡查记录已给出地点和日期，所属水系待核。请先核对该记录与场点的水系关系。",
      "The record has a location and date. Verify which water system it belongs to."),
    t("记录落在示例场点 A 的 3 公里范围内，距离本身不能确定两处水体连通。需请场点人员补充水系或水源说明。",
      "The record lies within 3 km of fictional site A. Distance alone cannot establish a water connection. Ask the site team to document the water system or source."),
    t("反馈示例：已核对记录日期和附近场点；水系关系仍待现场补充，本次保留待核状态。",
      "Example feedback: the date and nearby site have been checked. The water connection still needs local evidence; keep the record under review."),
  ];
  return <details className="mt-6 rounded-xl border border-[#c5d4d1] bg-white px-5 py-4 sm:px-6">
    <summary className="cursor-pointer font-semibold text-[#153d4c]">{t("场点巡查复核练习（虚构）", "Practice a site review (fictional)")}</summary>
    <div className="mt-4 max-w-3xl space-y-3">
      <p className="text-sm text-slate-600">{t("虚构场点 A · 健康巡查", "Fictional site A · Health check")} {record.id} · {record.observedOn}</p>
      <p aria-live="polite">{descriptions[stage]}</p>
      <button type="button" className={linkStyle} onClick={() => setStage((stage + 1) % descriptions.length)}>
        {[t("查看核查要点", "Review the evidence"), t("查看反馈示例", "View sample feedback"), t("重新练习", "Restart exercise")][stage]}
      </button>
    </div>
  </details>;
}

export function RegionalDesk() {
  const { t } = useLocale();
  const query = useSearchParams();
  const site = siteIds.find(id => id === query.get("site")) ?? "zhanjiang";
  const { data, error, retry } = useEnvironment();
  const days = data ? regionalDates(data.snapshot, site, data.asOf) : [];
  const requestedDay = query.get("day") ?? "";
  const requestedTime = /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) && Date.parse(requestedDay + "T00:00:00Z");
  const day = requestedTime !== false && Number.isFinite(requestedTime) && new Date(requestedTime).toISOString().slice(0,10) === requestedDay
    ? requestedDay : data ? new Date(data.asOf).toISOString().slice(0,10) : "";
  const options = [...new Set([...days, ...(day ? [day] : [])])].sort().reverse();
  const evidence = data && regionalEvidence(data.snapshot, site, day, data.asOf);
  const layer = site === "offshore" && data ? (["ocean-temp","salinity","chl-l4","oisst","heatwave"] as const).find(id =>
    regionalLayerTime(data.snapshot.feeds.find(f => f.id === id), day)) ?? "off" : "off";
  const mapUrl = `/risk-map?view=regional&ocean=${layer}${day ? "&day=" + day : ""}#env-${site}`;
  function changeScope(nextSite: Site, nextDay: string) {
    const next = new URL(window.location.href);
    next.searchParams.set("site", nextSite);
    if (nextDay) next.searchParams.set("day", nextDay);
    window.history.replaceState(null, "", next.pathname + next.search);
  }
  const [zh, en, lat, lon] = station[site];
  return <article className="pb-12 text-[#294a50]">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-5 border-b border-[#c5d4d1] pb-6">
      <div><h1 className="text-3xl font-semibold tracking-tight text-[#123743] sm:text-4xl">{t("区域监测站", "Regional monitoring station")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t("按地区和资料日期核对环境变化，找出需要补查的来源和场点记录。", "Review local environmental evidence by area and date, then identify sources and site records that need follow-up.")}</p></div>
      <Link href={mapUrl} className="inline-flex items-center gap-2 font-semibold text-teal-800 hover:underline">
        {t("在地图上核对该区域", "Review this area on the map")} <ArrowUpRight size={17} aria-hidden="true"/>
      </Link>
    </header>

    <div className="grid gap-x-8 gap-y-3 rounded-xl bg-[#e7f0ed] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1.25fr_1fr_1fr] lg:items-end">
      <label className="text-sm font-semibold">{t("监测代表点", "Monitoring reference point")}
        <select value={site} onChange={e => changeScope(e.target.value as Site, day)} className={control}>
          {siteIds.map(id => <option key={id} value={id}>{t(station[id][0],station[id][1])}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">{t("资料日期（UTC）", "Evidence date (UTC)")}
        <select value={day} disabled={!data} onChange={e => changeScope(site, e.target.value)} className={control}>
          {!data && <option value={day}>{t("等待读取快照", "Waiting for snapshot")}</option>}
          {options.map(date => <option key={date} value={date}>{date}</option>)}
        </select>
      </label>
      <p className="flex items-center gap-2 pb-1 text-sm text-[#43635f]"><MapPin size={16} aria-hidden="true"/>
        {t(zh, en)} · {lat}°, {lon}°</p>
    </div>
    {error && <p role="alert" className="mt-4 text-sm">
      {t("公开环境快照读取失败。", "The public environmental snapshot could not be loaded.")}{" "}
      <button type="button" onClick={retry} className={linkStyle}>{t("重新读取", "Retry")}</button>
    </p>}
    {!data && !error && <p role="status" className="my-5">{t("正在读取公开资料…", "Loading public evidence…")}</p>}

    {evidence && data && <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-xl border border-[#c5d4d1] bg-white p-5 sm:p-6">
        <h2 className={sectionTitle}>{t("地区环境摘要", "Regional evidence brief")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t(...stateText[evidence.state])} · {day} UTC</p>
        <p className="mb-2 mt-3 text-sm">{t("逐日或逐时产品有值", "Daily or subdaily products with values")} {evidence.readings.length}/{evidence.readings.length + evidence.gaps.length}</p>
        {evidence.readings.map(r => <EvidenceRow key={r.id} r={r} site={site}/>)}
        {!evidence.readings.length && <p className="py-4 text-sm">{t("所选日没有可读取的日内数值。可更换日期或核对下方缺项。", "No daily values are available for this date. Choose another date or review the evidence gaps.")}</p>}
        {evidence.outlooks.length > 0 && <details className="mt-4 border-t border-[#c5d4d1] pt-3">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800">{t("覆盖该日期的周／月展望", "Weekly or monthly outlooks covering this day")}</summary>
          <div className="pl-2">{evidence.outlooks.map(r => <EvidenceRow key={r.id + r.variable} r={r} site={site}/>)}</div>
        </details>}
        <p className="mt-4 text-xs text-slate-600">{t("快照发布", "Snapshot published")} · {displayTime(data.snapshot.publishedAt)} UTC</p>
      </section>
      <section className="min-w-0 rounded-xl border border-[#c5d4d1] bg-white p-5 sm:p-6">
        <h2 className={sectionTitle}>{t("值班复核清单", "Duty review checklist")}</h2>
        <div className="my-4 flex items-start gap-3 rounded-md bg-[#eaf3f0] p-3">
          <ClipboardCheck size={20} className="mt-0.5 shrink-0 text-teal-800" aria-hidden="true"/>
          <p className="text-sm leading-6">{site === "offshore"
            ? t("先核对海域格点、深度与目标水域，再查看在该水域有效的主管部门通告。塘口状况需由本场观测复核。", "Match the offshore grid cell and depth to the target water, then check official notices valid there. Verify pond conditions with farm observations.")
            : t("核对该点的资料时段，再对照本地通告及养殖场观测。代表点天气或河流量不能代替塘口水温、溶氧等实测值。", "Match the evidence period to local notices and farm observations. Reference weather or river discharge cannot establish pond temperature or dissolved oxygen.")}</p>
        </div>
        {evidence.gaps.length > 0 && <ul className="divide-y divide-[#dce6e4]">
          {evidence.gaps.map(g => <li key={g.id} className="py-2.5">
            <Link href={detailsUrl(site,g.id)} className={linkStyle}>{t(...names[g.id])}</Link>
            <p className="mt-0.5 text-sm text-slate-600">{t(...gapText[g.reason])}{g.lastDay && " · " + t("快照末日", "Last snapshot date") + " " + g.lastDay}</p>
          </li>)}
        </ul>}
        {evidence.readings.filter(r => r.old).map(r => <p key={r.id} className="border-t border-amber-200 py-2 text-sm">
          <Link className={linkStyle} href={detailsUrl(site,r.id)}>{t(...names[r.id])}</Link> · {t("核对更新状态后再使用。", "Check freshness before use.")}</p>)}
        {!evidence.gaps.length && evidence.valid === evidence.readings.length && <p className="text-sm">{t("本次选定的日资料没有缺项，仍需核查水域与场点是否匹配。", "All applicable daily products have values; verify their relevance to the waterbody and site.")}</p>}
      </section>
    </div>}
    <ReviewExercise/>
  </article>;
}
