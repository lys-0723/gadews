"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale } from "../locale-provider";
import { names, siteIds, station, variables, type Delivery, type FeedId, type Site } from "@/lib/gadews/environment/snapshot";
import { regionalEvidence, type EvidenceReading } from "@/lib/gadews/environment/regional-evidence";

const control = "mt-1 block min-h-10 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 font-normal text-slate-900";
const link = "font-medium text-teal-800 underline underline-offset-2";
const overview = (site: Site, product: FeedId) => `/overview?site=${site}&product=${product}#environment-evidence`;
const metric = (v: number) => Number(v.toFixed(4)).toString();
const timeText = (value: string) => value.replace("T", " ").replace(/(\.\d+)?Z$/, "");
const period = (first: string, last: string) => first === last
  ? timeText(first) : timeText(first) + " – " + timeText(last).slice(11);
const labels: Record<"dated" | "historical" | "insufficient", [string, string]> = {
  dated: ["有适用时段的环境资料", "Environmental evidence in period"],
  historical: ["仅有历史资料", "Historical evidence only"],
  insufficient: ["资料不足或待更新", "Insufficient or stale evidence"],
};

function Reading({ reading, site }: {reading: EvidenceReading; site: Site}) {
  const { t } = useLocale();
  const { id, variable, low, high } = reading;
  const value = reading.interval ? (high === null ? "≥ " + low : `[${low}, ${high})`)
    : high === null || low === high ? metric(low) : metric(low) + "–" + metric(high);
  const title = variable === "Rain Rate" ? t("雨强色阶", "Rain-rate interval")
    : variable === "Snow Rate" ? t("降雪率色阶", "Snow-rate interval")
    : variables[variable] ? t(...variables[variable]) : variable;
  return <details className="border-t border-slate-200 py-2">
    <summary className="cursor-pointer">
      <span className="font-semibold">{title} · {value} {reading.unit}</span>
      {reading.old && <span className="ml-1 text-amber-800">{t("待更新", "Stale")}</span>}
      <span className="mt-0.5 block pl-4 text-xs text-slate-600">{t(...names[id])}</span>
    </summary>
    <div className="space-y-1 pl-4 pt-2 text-xs leading-5 text-slate-700">
      <p>{t("资料时段", "Valid period")} · {period(reading.first, reading.last)} UTC</p>
      {reading.total > 1 && <p>{t("所选日有效时次", "Valid time steps on selected day")} {reading.count}/{reading.total} · {t("显示该时段最低至最高值", "Range across available time steps")}</p>}
      <p>{t("取值位置", "Sample location")} · {reading.lat.toFixed(3)}°, {reading.lon.toFixed(3)}°
        {reading.depth !== null && ` · ${t("深度", "Depth")} ${reading.depth.toFixed(2)} m`}</p>
      <Link className={link} href={overview(site, id)}>{t("查看该产品全部变量", "Inspect all product variables")}</Link>
      {" · "}<a className={link} href={reading.source} target="_blank" rel="noreferrer">{t("原始来源", "Source")}</a>
    </div>
  </details>;
}

function ExampleAssessment() {
  const { t } = useLocale();
  const [scenario, setScenario] = useState("notice");
  const outcomes = {
    notice: [
      t("Ⅳ · 高关注", "IV · High attention"),
      t("示例海湾有当日有效的防护行动通告，范围与该水域相符。", "A protective-action notice covers the fictional bay on the selected day."),
      t("复核发布方、边界和有效期，按通告要求监测；通告解除后重新评估。", "Check the issuer, boundary and validity. Follow the notice and reassess when it expires."),
    ],
    past: [
      t("仅有历史背景", "Historical context only"),
      t("有国家尺度的以往记录，示例海湾当日没有可用证据。", "Past national records exist, without evidence for the bay on that day."),
      t("保留原报告期，优先核对该海湾的当期监测。", "Keep the original reporting period and seek current monitoring for the bay."),
    ],
    gap: [
      t("资料不足", "Insufficient evidence"),
      t("示例地区的天气值在常规范围，所需水域监测已过期。", "Weather is within its usual range, but the required water monitoring is out of date."),
      t("补查最新水域资料和通告；缺项期间保留资料不足状态。", "Check recent water observations and notices; keep the insufficient-evidence status until coverage is adequate."),
    ],
  };
  const selected = outcomes[scenario as keyof typeof outcomes];
  return <details className="border-t border-slate-200 pt-2">
    <summary className="cursor-pointer font-medium">{t("复核情景演示（虚构）", "Example review sequence (fictional)")}</summary>
    <div className="mt-2 space-y-2 rounded-md border border-dashed border-slate-300 p-3">
      <label className="block">{t("固定示例", "Illustrative scenario")}
        <select className={control} value={scenario} onChange={e => setScenario(e.target.value)}>
          <option value="notice">{t("有效海湾通告", "Active bay advisory")}</option>
          <option value="past">{t("只有国家历史报告", "National historical reports only")}</option>
          <option value="gap">{t("当期关键来源缺失", "Required current source missing")}</option>
        </select>
      </label>
      <div aria-live="polite" className="space-y-1"><strong>{selected[0]}</strong><p>{selected[1]}</p><p>{selected[2]}</p></div>
    </div>
  </details>;
}

export interface RegionalEvidenceProps {
  delivery: Delivery | null;
  failed: boolean;
  retry: () => void;
  site: Site;
  onSiteChange: (site: Site) => void;
  day: string;
  days: string[];
  children: ReactNode;
  onDayChange: (day: string) => void;
}

export function RegionalEvidencePanel({ delivery, failed, retry, site, onSiteChange, day, days, children, onDayChange }: RegionalEvidenceProps) {
  const { t } = useLocale();
  const result = delivery && regionalEvidence(delivery.snapshot, site, day, delivery.asOf);
  return <section aria-labelledby="regional-evidence-heading" className="space-y-4 text-sm leading-6 text-slate-800">
    <h2 id="regional-evidence-heading" className="text-lg font-semibold leading-tight text-slate-950">
      {t("区域环境与复核", "Regional evidence and review")}
    </h2>
    <label className="block font-medium">{t("水域或地区代表点", "Water or regional reference point")}
      <select className={control} value={site} onChange={e => onSiteChange(e.target.value as Site)}>
        {siteIds.map(id => <option key={id} value={id}>{t(station[id][0],station[id][1])}</option>)}
      </select>
    </label>
    {failed && <p role="alert">{t("环境快照读取失败。", "Environmental snapshot could not be loaded.")}{" "}
      <button type="button" className={link} onClick={retry}>{t("重试", "Retry")}</button></p>}
    {!delivery && !failed && <p role="status">{t("正在读取环境快照…", "Loading environmental snapshot…")}</p>}
    {delivery && result && <>
      <label className="block font-medium">{t("资料日期（UTC）", "Evidence date (UTC)")}
        <select className={control} value={day} onChange={e => onDayChange(e.target.value)}>
          {[...days].reverse().map(date => <option key={date} value={date}>{date}</option>)}
        </select>
      </label>
      <div aria-live="polite" className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
        <h3 className="font-semibold">{t(...labels[result.state])}</h3>
        <p className="text-xs leading-5">{t("选定日有数值的产品", "Products with values on selected day")} {result.readings.length}/{result.readings.length + result.gaps.length}
          {" · "}{t("区域预警等级待审定", "Regional alert level pending review")}</p>
      </div>
      {children}
      {result.readings.length > 0 && <section>
        <h3 className="mb-1 font-semibold">{t("所选日期的证据", "Evidence for this date")}</h3>
        {result.readings.map(r => <Reading key={r.id} reading={r} site={site}/>)}
      </section>}
      {result.gaps.length > 0 && <details className="rounded-lg border border-slate-300 px-3 py-2">
        <summary className="cursor-pointer font-semibold">{t("资料缺项", "Coverage gaps")} ({result.gaps.length})</summary>
        <ul className="mt-2 divide-y divide-slate-200 text-xs">{result.gaps.map(g => <li key={g.id} className="py-1.5">
          <Link href={overview(site, g.id)} className={link}>{t(...names[g.id])}</Link>
          <p>{g.reason === "date" ? t("所选日无资料", "No data for this day")
            : g.reason === "missing" ? t("该代表点取值缺测", "Missing value at the reference point")
            : t("来源暂不可用", "Source unavailable")}
            {g.lastDay && ` · ${t("快照末期", "Last date in snapshot")} ${g.lastDay}`}</p>
        </li>)}</ul>
      </details>}
      <div className="border-l-2 border-teal-700 pl-3">
        <h3 className="font-semibold">{t("建议复核", "What to verify")}</h3>
        <p>{result.state !== "dated" ? t("查看最近一次有效资料及来源日期，待补齐同区域、同时段资料后再评估。",
          "Check the last valid evidence and its date. Reassess when evidence covers the same area and period.")
          : site === "offshore" ? t("对照取值网格与目标水域边界，再查主管部门是否有覆盖该水域的有效通告。",
          "Compare the sampled grid with the waterbody boundary and check official notices valid for that area.")
          : t("核对天气或河流预报的有效时段，再对照当地通告与水体实测记录。",
          "Verify the weather or river forecast period against local notices and observations from the waterbody.")}</p>
      </div>
      <details className="border-t border-slate-200 pt-2">
        <summary className="cursor-pointer font-medium">{t("长期展望与历史背景", "Longer-range outlooks and historical context")}</summary>
        <div className="mt-2 space-y-2 text-xs">
          {(site === "offshore" ? ["heatwave"] as const : ["ec46", "seas5"] as const).map(id => {
            const f = delivery.snapshot.feeds.find(item => item.id === id);
            const times = f?.series.find(s => s.site === site)?.times;
            const first = times?.[0], last = times?.at(-1);
            return <p key={id}>
              <Link className={link} href={overview(site, id)}>{t(...names[id])}</Link>{" · "}
              {first && last ? id === "ec46"
                ? t("周起始日", "Weeks beginning") + " " + first + " — " + last
                : first.slice(0,7) + " — " + last.slice(0,7)
                : t("暂无资料期", "Period unavailable")}
            </p>;
          })}
          <p><Link href="/overview#enso-outlook" className={link}>{t("全球 ENSO 季节概率", "Global seasonal ENSO outlook")}</Link></p>
          <p><Link href={overview(site, site === "offshore" ? "oisst" : "weather")} className={link}>{t("在总览中对照同国历史报告", "Compare national historical reports in the overview")}</Link></p>
        </div>
      </details>
      <p className="text-xs text-slate-600">{t("快照发布", "Snapshot published")} · {timeText(delivery.snapshot.publishedAt)} UTC
        {" · "}<Link className={link} href={`/overview?site=${site}#environment-catalog`}>{t("全部环境资料", "All environmental products")}</Link></p>
      <ExampleAssessment />
    </>}
  </section>;
}
