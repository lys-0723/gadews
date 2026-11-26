"use client";
import { useLocale } from "../locale-provider";
import {
  names,
  station,
  siteIds,
  type FeedId,
  type Site,
  type Delivery,
  overdue,
} from "@/lib/gadews/environment/snapshot";

import { heatColors } from "@/lib/gadews/environment/heat-grid";
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
  const day = current?.heatMaps ? current.series[0].times[heatMonth] : current?.grid?.time ?? current?.raster?.time;
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
        <p>
          {t("点选格网以查看像元、单位和资料期。", "Select a grid cell for its value, unit and valid time.")}
        </p>
      )}
      {layer !== "off" && (
        <div className="space-y-1 rounded-lg bg-slate-50 p-2">
          <p>
            {layer === "heatwave"
              ? t("全球 1° 海洋热浪概率（研究性预报），起报月份 ", "Global 1° experimental marine heatwave probability, initial month ") + (current?.issueMonth?.slice(0,7) ?? "—")
              : layer === "oisst"
              ? t("近海样区 · 0.25° 日海温格网（°C）", "Offshore subset · 0.25° daily SST (°C)")
              : layer === "viirs"
                ? t(
                    "近海抽样 · 4 km 卫星像元（mg/m³）",
                    "Offshore subset · sampled 4 km satellite pixels (mg/m³)",
                  )
                : layer === "chl-l3"
                  ? t(
                      "全球卫星海色（mg/m³），空白处缺测",
                      "Global satellite chlorophyll (mg/m³); gaps are missing",
                    )
                  : layer === "chl-l4"
                    ? t(
                        "全球插值海色（mg/m³），与卫星层分列",
                        "Global interpolated chlorophyll (mg/m³), separate from observations",
                      )
                    : t("海洋模式格网", "Ocean model grid") +
                      " · " +
                      (current?.series[0]?.fields[0]?.unit ?? "—") +
                      " · " +
                      t("深度", "depth") +
                      " " +
                      (current?.series[0]?.depthM?.toFixed(2) ?? "—") +
                      " m"}
          </p>
          {current?.heatMaps && <>
            <label className="block">{t("预报月份", "Forecast month")}
              <select className={control} value={heatMonth} onChange={e => onHeatMonth(Number(e.target.value))}>
                {current.series[0].times.map((v,i) => <option key={v} value={i}>{v.slice(0,7)}</option>)}
              </select>
            </label>
            <p>{["0–24%", "25–49%", "50–74%", "75–100%"].map((label,i) => <span key={label} className="mr-2 inline-block"><i className="mr-1 inline-block h-3 w-3" style={{background: heatColors[i]}}/>{label}</span>)}</p>
            <p>{t("空白为陆地或缺测；概率取整至 1%。", "Blank cells are land or missing. Probabilities rounded to 1%.")}</p>
          </>}
          {current?.grid && (
            <button type="button" className="text-teal-800 underline" onClick={() => onSite("offshore")}>
              {t("定位近海样区", "Locate offshore subset")}
            </button>
          )}
          {current?.grid && (
            <div className="flex flex-wrap gap-2">
              {(layer === "oisst" ? ["<20", "20–25", "25–30", "≥30"] : ["<0.3", "0.3–1", "1–3", "≥3"]).map(
                (v, i) => (
                  <span key={v}>
                    <i
                      aria-hidden="true"
                      className="mr-1 inline-block h-3 w-3 rounded-sm"
                      style={{ background: gridPalette[i] }}
                    />
                    {v}
                  </span>
                ),
              )}
            </div>
          )}
          {current?.raster && (
            <a className="underline" target="_blank" rel="noreferrer" href={legendUrl(current.raster)}>
              {t("查看提供方色标", "Open provider colour scale")}
            </a>
          )}
          <p>
            {day?.slice(0, 10) ?? t("暂无资料", "No data")} UTC{" "}
            {current &&
              overdue(current, delivery!.asOf) &&
              " · " + t("超期或待更新", "Stale or awaiting update")}
          </p>
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
        href={"/overview?site=" + (site ?? "offshore") + "&product=" + layer + "#environment-evidence"}
      >
        {t("查看环境趋势与来源", "Explore trends and sources")} →
      </a>
    </fieldset>
  );
}
export const gridPalette = ["#405792", "#25849c", "#49ad9a", "#d7ab4c"];
export function legendUrl(r: { layer: string; style: string }) {
  return (
    "https://wmts.marine.copernicus.eu/teroWmts?" +
    new URLSearchParams({
      SERVICE: "WMTS",
      REQUEST: "GetLegend",
      LAYER: r.layer,
      STYLE: r.style,
      FORMAT: "image/svg+xml",
    })
  );
}
