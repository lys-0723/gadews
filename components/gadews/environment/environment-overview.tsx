"use client";
import { RainFrame, EnsoOutlook } from "./climate-evidence";
import { CountryReports } from "./country-reports";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useEnvironment } from "@/hooks/use-environment";
import { useLocale } from "../locale-provider";
import {
  feedIds,
  oceanLayers,
  names,
  overdue,
  siteIds,
  sitesFor,
  station,
  timeIndex,
  variables,
  type Feed,
  type FeedId,
  type Site,
  type Series,
} from "@/lib/gadews/environment/snapshot";

const inputClass = "mt-1 block w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-slate-950";
const linkClass = "font-medium text-teal-800 underline underline-offset-4";
export function SourceStatus({ feed, asOf }: { feed: Feed; asOf: number }) {
  const { t } = useLocale();
  const text =
    feed.state === "unavailable"
      ? t("来源不可用", "Source unavailable")
      : feed.state === "retained"
        ? t("同步失败 · 保留旧版", "Refresh failed · previous version")
        : overdue(feed, asOf)
          ? t("资料超期", "Data out of date")
          : t("已有快照", "Snapshot available");
  return <span className="text-sm font-medium text-slate-700">{text}</span>;
}
function SeriesPanel({ series, feed, asOf }: { series: Series; feed: Feed; asOf: number }) {
  const { t } = useLocale();
  const [index, setIndex] = useState(() => timeIndex(series.times, asOf));
  const [key, setKey] = useState(series.fields[0].key);
  const field = series.fields.find((f) => f.key === key) ?? series.fields[0];
  const periodLabel = (time: string) => {
    if (feed.id === "seas5" || feed.id === "heatwave") return time.slice(0, 7);
    if (feed.id === "ec46") {
      const end = new Date(time + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() + 6);
      return time + " – " + end.toISOString().slice(0, 10);
    }
    return time.replace("T", " ");
  };
  const numeric = field.values.filter((v): v is number => v !== null);
  const min = Math.min(...numeric),
    max = Math.max(...numeric);
  const n = field.values.length;
  const x = (i: number) => 8 + (i * 584) / Math.max(1, n - 1);
  const y = (v: number) => (max === min ? 38 : 66 - ((v - min) / (max - min)) * 56);
  const path = field.values
    .map((v, i) =>
      v === null ? "" : (i === 0 || field.values[i - 1] === null ? "M" : "L") + x(i) + " " + y(v),
    )
    .join(" ");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-semibold">{t(...names[feed.id])}</h3>
        <SourceStatus feed={feed} asOf={asOf} />
      </div>
      <p className="text-sm text-slate-600">
        {t("来源网格", "Source grid")} {series.lat.toFixed(3)}°, {series.lon.toFixed(3)}°{" "}
        {series.depthM !== null && (
          <>
            {" "}
            · {t("深度", "Depth")} {series.depthM.toFixed(2)} m
          </>
        )}
      </p>
      <label className="block max-w-lg">
        {t("资料有效时间（UTC）", "Valid time (UTC)")}
        <select className={inputClass} value={index} onChange={(e) => setIndex(Number(e.target.value))}>
          {series.times.map((v, i) => (
            <option key={v} value={i}>
              {periodLabel(v)}
            </option>
          ))}
        </select>
      </label>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {series.fields.map((f) => (
          <div key={f.key} className="rounded-lg bg-slate-50 p-3">
            <dt className="text-sm text-slate-600">{variables[f.key] ? t(...variables[f.key]) : f.key}</dt>
            <dd className="font-mono text-xl">
              {f.values[index] === null ? t("缺测", "Missing") : Number(f.values[index].toFixed(3))}{" "}
              <small className="text-sm">{f.unit}</small>
            </dd>
          </div>
        ))}
      </dl>
      {n > 1 && (
        <>
          <label className="block max-w-lg">
            {t("时序变量", "Time series variable")}
            <select className={inputClass} value={key} onChange={(e) => setKey(e.target.value)}>
              {series.fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {variables[f.key] ? t(...variables[f.key]) : f.key} ({f.unit})
                </option>
              ))}
            </select>
          </label>
          {numeric.length > 0 ? (
            <figure>
              <svg
                className="h-24 w-full bg-teal-50"
                viewBox="0 0 600 76"
                role="img"
                aria-label={t("所选变量时序，空缺处断开", "Selected time series; gaps indicate missing data")}
                preserveAspectRatio="none"
              >
                <path
                  d={path}
                  fill="none"
                  stroke="#14776f"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {field.values[index] !== null && (
                  <circle cx={x(index)} cy={y(field.values[index]!)} r={4} fill="#0c3c4b" />
                )}
              </svg>
              <figcaption className="mt-2 text-sm">
                {periodLabel(series.times[0])} — {periodLabel(series.times[n - 1])} UTC · {min.toFixed(2)}–{max.toFixed(2)} {field.unit}{" "}
                · {t("有效时次", "Valid times")} {numeric.length}/{n}
              </figcaption>
            </figure>
          ) : (
            <p>{t("此变量在整个时段缺测。", "No valid values in this period.")}</p>
          )}
        </>
      )}
      {series.fields.some((f) => f.values[index] === null) && (
        <p className="text-sm">
          {series.fields
            .filter((f) => f.values[index] === null)
            .map((f) => {
              const last = f.values.slice(0, index + 1).findLastIndex((v) => v !== null);
              return (
                <span className="block" key={f.key}>
                  {variables[f.key] ? t(...variables[f.key]) : f.key} ·{" "}
                  {last < 0
                    ? t("此批次至该时刻无有效值", "No valid value up to this time in this batch")
                    : t("前次有效时间", "Previous valid time") + " " + series.times[last] + " UTC"}
                </span>
              );
            })}
        </p>
      )}
      {feed.grid && (
        <p className="text-sm">
          {t("近海子集有效格点", "Valid samples in offshore subset")}{" "}
          {feed.grid.points.filter((p) => p[2] !== null).length}/{feed.grid.points.length}
        </p>
      )}
      <aside className="border-l-2 border-teal-600 pl-3 text-sm leading-6 text-slate-700">
        {feed.id === "heatwave" ? t(
          "NOAA 研究性月度预报，保留长期增暖趋势。概率表示该海域月海温超过热浪阈值的可能性。起报月份 ",
          "NOAA experimental monthly outlook including the warming trend. Probability of SST exceeding the marine heatwave threshold. Initial month ",
        ) + feed.issueMonth?.slice(0,7) : feed.id === "gefs" ? t(
          "每天汇总 31 个集合成员。P50 是中位数，P10 至 P90 表示成员预测的中间 80% 范围。成员缺值时该指标留空。",
          "Each day summarizes 31 members. P50 is the median. P10–P90 spans the central 80% of member forecasts. Incomplete ensembles are left blank.",
        ) : feed.id === "ec46" || feed.id === "seas5" ? t(
          "距平是该周或该月与模式历史同期平均值的差。气温为正表示偏暖（差 1 K 相当于差 1 °C），降水为负表示偏干。该展望适用于区域尺度。",
          "Anomalies are departures from the model’s historical average for the same period. Positive temperature means warmer (a 1 K difference equals 1 °C), and negative precipitation means drier. Interpret at regional scale.",
        ) : feed.id === "weather" || feed.id === "marine" || feed.id === "flood"
          ? t(
              "复核时先对齐预报的地点与时段，再查同期公开通告或本场记录。",
              "Match the forecast footprint and time before checking notices or local observations.",
            )
          : t(
              "复核时先对齐空间尺度与资料期；单个海域格点、历史气象或国家报告不能定位到具体塘口。",
              "Match spatial scale and dates. An ocean grid cell, historical weather or a country report cannot identify a particular pond.",
            )}
      </aside>
      <p className="text-sm text-slate-600">
        {t("同步检查（UTC）", "Sync check (UTC)")} {feed.checkedAt} · {t("此版取得时间", "Version retrieved")}{" "}
        {feed.retrievedAt ?? "—"} ·{" "}
        <a className={linkClass} href={series.source} target="_blank" rel="noreferrer">
          {t("复核原始数据", "Inspect source response")}
        </a>
      </p>
    </div>
  );
}
export const noticeLinks = [
  [
    "广东赤潮通告",
    "Guangdong marine advisories",
    "https://g.hyyb.org/systems/HyybServices/City_guangdong/index.html",
  ],
  ["WMO 极端天气通告", "WMO severe weather warnings", "https://severeweather.wmo.int/"],
  [
    "湄公河水质监测",
    "Mekong water quality monitoring",
    "https://www.mrcmekong.org/water-quality-monitoring/",
  ],
  ["泰国海岸调查", "Thailand coastal survey", "https://edailyreport.dmcr.go.th/milestone/detail/11870"],
] as const;
const subscribeLocation = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
};
const requestedSite = () =>
  siteIds.find((id) => id === new URLSearchParams(location.search).get("site")) ?? "offshore";
const requestedProduct = () =>
  feedIds.find((key) => key === new URLSearchParams(location.search).get("product")) ?? "weather";
export function EnvironmentOverview() {
  const { t } = useLocale(),
    { data, error, retry } = useEnvironment();
  const initialSite = useSyncExternalStore(subscribeLocation, requestedSite, () => "offshore" as Site);
  const [chosen, setSite] = useState<Site | null>(null);
  const site = chosen ?? initialSite;
  const initialProduct = useSyncExternalStore(subscribeLocation, requestedProduct, () => "weather" as FeedId);
  const [chosenProduct, setSelected] = useState<FeedId | null>(null);
  const selected = chosenProduct ?? initialProduct;
  const options = feedIds.filter((key) => sitesFor(key).includes(site));
  const key = options.includes(selected) ? selected : site === "offshore" ? "oisst" : options[0];
  const feed = data?.snapshot.feeds.find((f) => f.id === key);
  const series = feed?.series.find((s) => s.site === site);
  return (
    <section
      id="environment-evidence"
      className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 text-slate-900 lg:px-8"
    >
      <h2 className="text-3xl font-bold">{t("区域环境证据", "Regional environmental evidence")}</h2>
      <p className="my-3 max-w-4xl leading-7">
        {t(
          "先查水域、资料期和覆盖，再结合公开疾病报告决定要核对什么。近海格点描述区域环境，塘口风险仍需本场观测。",
          "Inspect location, dates and coverage alongside public disease reports to decide what to verify. Offshore grid cells describe regional conditions; farm assessments need local evidence.",
        )}
      </p>
      {data && (
        <details id="environment-catalog" className="mb-5 scroll-mt-24 rounded-xl border border-slate-300 bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            {t("查看全部环境数据", "Browse all environmental data")} ({feedIds.length})
          </summary>
          <p className="my-3 text-sm text-slate-700">
            {t("这些资料可供后续疫病预测预警选用。当前可查看环境状况、预报和来源，具体变量的适用范围及预测效果待验证。",
              "These sources are candidates for future disease early warning. Explore conditions, forecasts and sources here. The suitability and predictive value of individual variables still require validation.")}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {title: t("海洋环境", "Marine environment"), ids: feedIds.filter(id => sitesFor(id).includes("offshore"))},
              {title: t("地区气象、气候与水文", "Regional weather, climate and hydrology"), ids: feedIds.filter(id => sitesFor(id).length && !sitesFor(id).includes("offshore"))},
              {title: t("全球气候背景与区域通告", "Global climate context and regional notices"), ids: feedIds.filter(id => !sitesFor(id).length)},
            ].map(group => (
              <section key={group.title}>
                <h3 className="mb-2 font-semibold">{group.title}</h3>
                <ul className="space-y-2">
                  {group.ids.map(id => {
                    const locations = sitesFor(id);
                    const target = locations.includes(site) ? site : locations[0];
                    const href = target ? "?site=" + target + "&product=" + id + "#environment-product"
                      : id === "enso" ? "#enso-outlook" : "#environment-" + id;
                    return <li key={id}><a className={linkClass} href={href} onClick={() => {
                      if (target) { setSite(target); setSelected(id); }
                      else if (id !== "enso") {
                        const notices = document.querySelector<HTMLDetailsElement>("#environment-notices");
                        if (notices) notices.open = true;
                      }
                    }}>{t(...names[id])}</a></li>;
                  })}
                </ul>
              </section>
            ))}
          </div>
        </details>
      )}
      <div id="environment-product" className="mb-4 grid scroll-mt-24 gap-4 sm:grid-cols-2">
        <label>
          {t("代表位置", "Reference location")}
          <select className={inputClass} value={site} onChange={(e) => setSite(e.target.value as Site)}>
            {siteIds.map((id) => (
              <option key={id} value={id}>
                {t(station[id][0], station[id][1])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("环境数据产品", "Environmental product")}
          <select className={inputClass} value={key} onChange={(e) => setSelected(e.target.value as FeedId)}>
            {options.map((id) => (
              <option key={id} value={id}>
                {t(...names[id])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="rounded-2xl border border-slate-300 bg-white p-5 sm:p-7">
        {error && (
          <p role="alert">
            {t("读取环境快照失败。", "Environmental snapshot could not be refreshed.")}{" "}
            <button className={linkClass} onClick={retry}>
              {t("重试", "Retry")}
            </button>
          </p>
        )}
        {!data && !error && <p role="status">{t("正在读取…", "Loading…")}</p>}
        {feed &&
          (series ? (
            <SeriesPanel key={key + site + feed.retrievedAt} series={series} feed={feed} asOf={data!.asOf} />
          ) : (
            <><SourceStatus feed={feed} asOf={data!.asOf} />{key === "imerg" && <RainFrame feed={feed} site={site}/>}</>
          ))}
        {site !== "offshore" && (
          <p className="mt-4 text-sm">
            {t(
              "海洋格网不套用到此陆地代表点。切换到近海示例点查看海况。",
              "Marine grids do not apply to this land reference. Select the offshore reference for sea conditions.",
            )}
          </p>
        )}
        {site === "offshore" && (
          <p className="mt-4 text-sm">
            {t(
              "L3 是卫星海色；L4 是插值产品。缺测保留为空。叶绿素异常需复核，官方赤潮通告另列。",
              "L3 is satellite ocean colour; L4 is interpolated. Missing pixels remain missing. Check official notices to investigate unusual chlorophyll.",
            )}
          </p>
        )}
        <a
          className={linkClass + " mt-4 inline-block"}
          href={"/risk-map?ocean=" + (oceanLayers.find((id) => id === key) ?? "off") + "#env-" + site}
        >
          {t("在地图上对照该位置与历史报告", "Compare this location with historical reports on the map")} →
        </a>
        <CountryReports site={site} />
      </div>
      {data && (
        <>
          {data.snapshot.feeds.filter(f => f.id === "enso").map(f => (
            <section id="enso-outlook" key={f.id} className="my-6 scroll-mt-24 rounded-xl border bg-white p-5">
              <h3 className="text-xl font-semibold">{t(...names.enso)}</h3>
              <SourceStatus feed={f} asOf={data.asOf} /><EnsoOutlook feed={f} />
            </section>
          ))}
          <p className="my-3 text-sm">
            {t("快照版本", "Snapshot version")} {data.snapshot.publishedAt} ·{" "}
            {data.origin === "published"
              ? t("已发布更新", "Published update")
              : data.origin === "cached"
                ? t("已验证缓存", "Last validated cache")
                : t("随站快照", "Bundled snapshot")}
          </p>
          <details id="environment-notices" className="mt-6 rounded-xl border border-slate-300 bg-white p-4">
            <summary className="cursor-pointer font-semibold">
              {t("气旋、藻华产品与主管部门通告", "Cyclones, bloom products and official notices")}
            </summary>
            {data.snapshot.feeds
              .filter((f) => f.events || f.id === "cyclones" || f.id === "abis")
              .map((f) => (
                <section id={"environment-" + f.id} key={f.id} className="my-4 scroll-mt-24">
                  <h3 className="font-semibold">{t(...names[f.id])}</h3>
                  <SourceStatus feed={f} asOf={data.asOf} />
                  <p className="text-sm">
                    {f.id === "cyclones"
                      ? t(
                          "最近 30 天事件背景；以下条目不等于本地现行警报。",
                          "Events in the past 30 days; check the issuing authority for local warnings.",
                        )
                      : t(
                          "北印度洋区域产品，按发布方标注的范围使用。",
                          "Regional product; use within its published footprint.",
                        )}
                  </p>
                  <ul>
                    {f.events?.map((e) => (
                      <li key={e.url}>
                        <a className={linkClass} href={e.url} target="_blank" rel="noreferrer">
                          {e.name}
                        </a>{" "}
                        · {e.end.slice(0, 10)}
                      </li>
                    ))}
                  </ul>
                  {f.events?.length === 0 && t("本次查询未返回事件。", "No events in this query.")}
                  {f.catalogUrl && (
                    <a className={linkClass} href={f.catalogUrl}>
                      {t("来源目录", "Source catalogue")}
                    </a>
                  )}
                </section>
              ))}
            <p className="text-sm">
              {t(
                "以下为原始通告入口，尚无统一自动订阅。",
                "The following are official reference links, without a unified automated feed.",
              )}
            </p>
            <ul>
              {noticeLinks.map(([zh, en, url]) => (
                <li key={url}>
                  <a className={linkClass} href={url}>
                    {t(zh, en)}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      <p className="mt-4 text-sm text-slate-600">
        {t("数据署名", "Data credits")} ·{" "}
        <Link href="https://open-meteo.com/en/terms" className={linkClass}>
          Open-Meteo (CC BY 4.0)
        </Link>{" "}
        · ECMWF EC46 / SEAS5 · NOAA GEFS · NASA GPM / GIBS · NOAA PSL / CPC · NASA POWER · NOAA CoastWatch / OISST · E.U. Copernicus Marine Service · GloFAS / Copernicus EMS ·
        GDACS · INCOIS
      </p>
    </section>
  );
}
