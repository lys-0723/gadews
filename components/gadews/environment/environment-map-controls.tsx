"use client";
import { OffshoreGridSummary } from "./ocean-legend";
import { unitText } from "@/lib/gadews/environment/ocean-legend";
import { useLocale } from "../locale-provider";
import {
  names,
  station,
  siteIds,
  sitesFor,
  type FeedId,
  type Site,
  type Delivery,
  overdue,
} from "@/lib/gadews/environment/snapshot";

import { oceanLayers, type OceanLayer } from "@/lib/gadews/environment/snapshot";
export interface EnvironmentControls {
  hideSitePicker?: boolean;
  heatMonth: number;
  onHeatMonth: (month: number) => void;
  delivery: Delivery | null;
  failed: boolean;
  retry: () => void;
  layer: OceanLayer;
  onLayer: (v: OceanLayer) => void;
  points: boolean;
  onPoints: (v: boolean) => void;
  site: Site | null;
  onSite: (v: Site | null) => void;
}
export function OceanControls({
  hideSitePicker = false,
  heatMonth, onHeatMonth, delivery,
  failed,
  retry,
  layer,
  onLayer,
  points,
  onPoints,
  site,
  onSite,
}: EnvironmentControls) {
  const { t } = useLocale();
  const current = delivery?.snapshot.feeds.find((f) => f.id === layer);
  const unit = current?.grid?.unit ?? current?.series[0]?.fields[0]?.unit;
  const day = current?.heatMaps ? current.series[0].times[heatMonth] : current?.grid?.time ?? current?.raster?.time;
  const linkedProduct = layer === "off" ? (site === "offshore" ? "oisst" : "weather") : layer;
  const locations = sitesFor(linkedProduct);
  const linkedSite = site && locations.includes(site) ? site : locations[0];
  const control = "mt-1 block w-full rounded-lg border border-slate-400 bg-white px-2 py-2";
  return (
    <fieldset className="space-y-2 border-t border-slate-200 pt-2">
      <legend className="font-semibold">{t("区域环境证据", "Regional environmental evidence")}</legend>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={points} onChange={(e) => onPoints(e.target.checked)} />
        {t("天气、海况与河流代表点", "Weather, marine and river reference points")}
      </label>
      {!hideSitePicker && <label className="block">
        {t("定位到代表点", "Locate a reference point")}
        <select
          className={control}
          value={site ?? ""}
          onChange={(e) => onSite((e.target.value || null) as Site | null)}
        >
          <option value="">{t("选择位置", "Select location")}</option>
          {siteIds.map((k) => (
            <option key={k} value={k}>
              {t(station[k][0], station[k][1])}
            </option>
          ))}
        </select>
      </label>}
      <label className="block">
        {t("海洋资料图层", "Marine evidence layer")}
        <select className={control} value={layer} onChange={(e) => onLayer(e.target.value as OceanLayer)}>
          {oceanLayers.map((id) => (
            <option key={id} value={id}>
              {id === "off" ? t("关闭海洋底图", "No marine overlay") : t(...names[id as FeedId])}
            </option>
          ))}
        </select>
      </label>
      {failed && (
        <p role="alert">
          {t("快照读取失败", "Snapshot unavailable")}{" "}
          <button type="button" onClick={retry} className="underline">
            {t("重试", "Retry")}
          </button>
        </p>
      )}
      {layer !== "off" && (
        <div aria-label={t("海洋图层图例", "Marine layer legend")} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <h3 className="font-semibold text-slate-900">{t(...names[layer])}</h3>
          <p>{layer === "heatwave" ? t("全球 1° 海洋热浪概率 · 研究性月度预报", "Global 1° marine heatwave probability · experimental monthly forecast")
            : layer === "oisst" ? t("近海样区 · 0.25° 日海温分析", "Offshore subset · 0.25° daily SST analysis")
            : layer === "viirs" ? t("近海样区 · 4 km 卫星海色抽样", "Offshore subset · sampled 4 km satellite ocean colour")
            : layer === "chl-l3" ? t("全球海域 · L3 卫星海色像元", "Global ocean · L3 satellite ocean colour")
            : layer === "chl-l4" ? t("全球海域 · L4 插值海色", "Global ocean · L4 interpolated ocean colour")
            : t("全球海域 · 海洋模式格网", "Global ocean · model grid")}
            {unit && " · " + unitText(unit)}
          </p>
          <p>{t("有效期", "Valid time")} · {day
            ? (current?.heatMaps ? day.slice(0,7) : day.replace("T"," ").replace(/(\.000)?Z$/,"")) + " UTC"
            : t("暂无资料", "No data")}
            {current?.series[0]?.depthM != null && " · " + t("深度", "Depth") + " " + current.series[0].depthM.toFixed(2) + " m"}
            {current && overdue(current, delivery!.asOf) && " · " + t("超期或待更新", "Stale or awaiting update")}
          </p>
          {current?.issueMonth && <p>{t("起报月份", "Initial month")} · {current.issueMonth.slice(0,7)}</p>}
          {current?.heatMaps && <>
            <label className="block">{t("预报月份", "Forecast month")}
              <select className={control} value={heatMonth} onChange={e => onHeatMonth(Number(e.target.value))}>
                {heatMonth < 0 && <option value={-1} disabled>{t("所选日期无预报月份", "No forecast for this date")}</option>}
                {current.series[0].times.map((v,i) => <option key={v} value={i}>{v.slice(0,7)}</option>)}
              </select>
            </label>
            <p>{t("空白为陆地或缺测；概率取整至 1%。", "Blank cells are land or missing. Probabilities rounded to 1%.")}</p>
          </>}
          {current?.grid && (
            <button type="button" className="text-teal-800 underline" onClick={() => onSite("offshore")}>
              {t("定位近海样区", "Locate offshore subset")}
            </button>
          )}
          {current?.grid && <OffshoreGridSummary grid={current.grid}/>}
          {current?.raster && <p className="text-xs">{t("视窗内显示官方色标和九个位置的抽样范围。点击水域可查单个像元。", "The map shows the provider scale and range of nine sampled locations. Select water to inspect a cell.")}</p>}
          {current?.state === "retained" && (
            <p>{t("同步失败，保留最后成功版本。", "Refresh failed; last available version retained.")}</p>
          )}
        </div>
      )}
      <p className="text-xs text-slate-600">
        {t(
          "海况描述水域环境；历史报告按原报告期、原空间尺度查看。环境颜色表示变量值。区域预警等级待规则审定。",
          "Marine conditions and historical reports have distinct scales and dates. Colours show environmental values. Regional alert grading awaits rule review.",
        )}
      </p>
      <a
        className="underline"
        href={"/overview?site=" + linkedSite + "&product=" + linkedProduct + "#environment-evidence"}
      >
        {t("查看环境趋势与来源", "Explore trends and sources")}{site !== linkedSite && " · " + t(station[linkedSite][0], station[linkedSite][1])} →
      </a>
    </fieldset>
  );
}
