"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, CloudSun, Droplets, Fish, Thermometer } from "lucide-react";
import { useLocale } from "@/components/gadews/locale-provider";
import { useEnvironment } from "@/hooks/use-environment";
import type { MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import { numberText, unitText } from "@/lib/gadews/environment/format";
import { overdue, timeIndex, utcMillis } from "@/lib/gadews/environment/snapshot";
import type { TilapiaAssessmentInput } from "@/lib/gadews/tilapia-types";

const linkStyle = "inline-flex min-h-11 items-center gap-2 font-medium text-teal-800 underline underline-offset-4";
const stamp = (value: string) => value.replace("T", " ").slice(0, 16) + " UTC";

function Measurement({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  const { t } = useLocale();
  return <div className="min-w-0">
    <dt className="text-sm text-slate-600">{label}</dt>
    <dd className={value === null ? "mt-1 text-lg font-semibold text-amber-800" : "mt-1 text-2xl font-semibold tabular-nums text-teal-950"}>
      {value === null ? t("缺测", "Missing") : <>{numberText(value)} <span className="text-base font-medium">{unit}</span></>}
    </dd>
  </div>;
}

function WeatherReference() {
  const { t } = useLocale();
  const { data, error, retry } = useEnvironment();
  const feed = data?.snapshot.feeds.find(item => item.id === "weather");
  const series = feed?.series.find(item => item.site === "zhanjiang");
  const index = series && data ? timeIndex(series.times, data.asOf) : 0;
  const time = series?.times[index];
  const finalHour = series?.times.at(-1);
  const stale = feed && data && (overdue(feed, data.asOf) ||
    (finalHour !== undefined && data.asOf >= utcMillis(finalHour) + 3_600_000));
  const available = Boolean(series && time && feed?.state !== "unavailable");
  return <section aria-labelledby="farm-weather-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    <div className="flex items-center gap-3">
      <CloudSun aria-hidden="true" className="text-teal-700" size={24} />
      <h2 id="farm-weather-title" className="text-xl font-semibold">{t("公开天气参考", "Regional weather reference")}</h2>
    </div>
    <p className="mt-2 text-sm leading-6 text-slate-600">{t("湛江代表点 · Open-Meteo 逐小时预报", "Zhanjiang reference point · Open-Meteo hourly forecast")}</p>
    {error && <p role="alert" className="mt-4 text-sm">{t("环境快照刷新失败。", "The environmental snapshot could not be refreshed.")} <button type="button" className={linkStyle} onClick={retry}>{t("重试", "Retry")}</button></p>}
    {!data && !error && <p className="mt-4" role="status">{t("正在读取预报…", "Loading forecast…")}</p>}
    {data && !available && <p className="mt-4 text-sm">{t("本期没有可用的湛江预报。", "No forecast for Zhanjiang is available in this snapshot.")}</p>}
    {available && series && time && <>
      <p className="mt-4 text-sm font-medium">{t("预报有效时刻", "Forecast valid at")} · {stamp(time)} {stale && <span className="text-amber-800"> · {t("待更新", "Awaiting update")}</span>}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {(["temperature_2m", "precipitation"] as const).map(key => {
          const field = series.fields.find(item => item.key === key);
          return <Measurement key={key} label={key === "temperature_2m" ? t("2 米气温", "2 m air temperature") : t("小时降水", "Hourly precipitation")}
            value={field?.values[index] ?? null} unit={unitText(field?.unit ?? "")} />;
        })}
      </dl>
      <p className="mt-4 text-sm leading-6 text-slate-600">{t("区域天气可供安排巡查。评估某个塘口时，应使用该塘同期的水质观测。", "Use regional weather to plan inspections. Assess a pond using water observations from that pond and period.")}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 text-sm">
        <Link className={linkStyle} href={"/risk-map?view=regional&ocean=off&day=" + time.slice(0, 10) + "#env-zhanjiang"}>{t("在地图上复核", "Inspect on map")} <ArrowRight size={15} aria-hidden="true" /></Link>
        <a className={linkStyle} href={series.source} target="_blank" rel="noreferrer">{t("原始预报", "Source forecast")}</a>
      </div>
    </>}
  </section>;
}

export function FarmDesk({ shrimp, tilapia }: { shrimp: MonitoringSnapshot; tilapia: TilapiaAssessmentInput }) {
  const { t } = useLocale();
  const [pond, setPond] = useState<"shrimp" | "tilapia">("shrimp");
  const isShrimp = pond === "shrimp";
  const metrics = shrimp.observation?.metrics;
  const observation = isShrimp ? shrimp.observation?.observedAt : tilapia.clinical?.observedAt;
  const labCount = tilapia.laboratory.filter(record => record.quality === "valid" && record.value).length;
  return <div className="space-y-6 text-slate-900">
    <header>
      <h1 className="text-3xl font-bold tracking-tight text-teal-950 sm:text-4xl">{t("我的养殖场", "My farm")}</h1>
      <p className="mt-2 text-base leading-7 text-slate-600">{t("查看虚构塘口的巡查记录、资料缺项和下一步复核安排。", "Review observations, missing evidence and follow-up actions for two fictional ponds.")}</p>
    </header>
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="farm-pond" className="font-semibold">{t("选择示例塘口", "Select example pond")}</label>
      <select id="farm-pond" className="min-h-11 rounded-lg border border-slate-400 bg-white px-3 py-2 text-base"
        value={pond} onChange={event => setPond(event.target.value === "tilapia" ? "tilapia" : "shrimp")}>
        <option value="shrimp">{t("对虾塘", "Shrimp pond")}</option>
        <option value="tilapia">{t("罗非鱼塘", "Tilapia pond")}</option>
      </select>
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section aria-labelledby="pond-records" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="bg-[#103d50] px-5 py-5 text-white sm:px-7">
          <div className="flex items-center gap-2"><Fish aria-hidden="true" size={23} className="text-[#a4e5d5]" />
            <h2 className="text-xl font-semibold" id="pond-records">{isShrimp ? t("对虾塘巡查", "Shrimp pond inspection") : t("罗非鱼塘巡查", "Tilapia pond inspection")}</h2></div>
          <p className="mt-2 text-sm text-teal-50">{t("示例观测时间", "Example observation time")} · {observation ? stamp(observation) : t("未记录", "Unrecorded")}</p>
        </div>
        <div className="space-y-5 p-5 sm:p-7">
          <div>
            <h3 className="flex items-center gap-2 font-semibold"><Thermometer size={18} aria-hidden="true" /> {t("本塘观测", "Pond observations")}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Measurement label={t("塘口水温", "Water temperature")} value={isShrimp ? metrics?.waterTemperatureC.value ?? null : tilapia.waterTemperature?.value ?? null} unit="°C" />
              <Measurement label={t("溶解氧", "Dissolved oxygen")} value={isShrimp ? metrics?.dissolvedOxygenMgL.value ?? null : tilapia.dissolvedOxygen?.value ?? null} unit="mg/L" />
              {isShrimp ? <Measurement label="pH" value={metrics?.ph.value ?? null} unit="" /> :
                <div><dt className="text-sm text-slate-600">{t("示例检测记录", "Example lab records")}</dt><dd className="mt-1 text-2xl font-semibold text-teal-950">{labCount}</dd></div>}
            </dl>
            {!isShrimp && tilapia.clinical?.value?.respiratoryDistressObserved === "yes" && <p className="mt-4 text-sm text-slate-700">{t("巡查记录提到呼吸异常。", "The example inspection notes signs of respiratory distress.")}</p>}
          </div>
          <div className="rounded-lg border-l-4 border-teal-700 bg-[#eff6f3] px-4 py-3">
            <h3 className="flex items-center gap-2 font-semibold text-teal-950"><Droplets size={17} aria-hidden="true" />{t("下一步复核", "Next check")}</h3>
            <p className="mt-1 text-sm leading-6">{isShrimp ? t("补测本塘溶解氧和 pH，记录观测时间，再结合本塘巡查记录进行白斑病筛查。",
              "Recheck dissolved oxygen and pH in this pond, note the time and compare with inspection records in the WSD screening tool.")
              : t("核对检测样本与巡查记录是否对应同一塘口、同一观察时段，并补查水温和溶解氧。", "Match the laboratory sample and inspection to the same pond and period, then check water temperature and dissolved oxygen.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900"
              href={"/warning-tools?disease=" + (isShrimp ? "wsd" : "tilapia") + "&role=producer"}>
              {isShrimp ? t("打开白斑病筛查", "Open WSD screening") : t("打开链球菌病筛查", "Open streptococcosis screening")} <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className={linkStyle} href={"/knowledge-bank/literature?collection=" + (isShrimp ? "wssv" : "streptococcosis")}><BookOpen size={16} aria-hidden="true" />{t("相关文献", "Related literature")}</Link>
          </div>
        </div>
      </section>
      <WeatherReference />
    </div>
  </div>;
}
