"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale } from "../locale-provider";
import type { Feed } from "@/lib/gadews/environment/snapshot";
import { gridSummary, legendUrl, numberText, readScale, unitText, type ProviderScale } from "@/lib/gadews/environment/ocean-legend";

type Raster = NonNullable<Feed["raster"]>;
export function ProviderLegend({ raster }: { raster: Raster }) {
  const { t } = useLocale();
  const [scale, setScale] = useState<ProviderScale | null>(null);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const jsonUrl = legendUrl(raster, "application/json");
  const svgUrl = legendUrl(raster);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = AbortSignal.timeout(10000);
    async function load() {
      try {
        const response = await fetch(jsonUrl, { signal: AbortSignal.any([controller.signal, timeout]) });
        if (!response.ok) throw new Error("Legend unavailable");
        const value = readScale(await response.json(), raster);
        if (!controller.signal.aborted) setScale(value);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [jsonUrl, raster]);

  return <figure className="my-2 rounded border border-slate-200 bg-white p-2">
    <figcaption className="font-semibold">{t("图层色标", "Layer colour scale")}{scale && " · " + unitText(scale.units)}</figcaption>
    {scale ? <>
      <div aria-hidden="true" className="my-1 h-3 w-full rounded-sm"
        style={{ background: "linear-gradient(to right," + scale.cmap.colorMap.map(c => "rgb(" + c.join(",") + ")").join(",") + ")" }} />
      <div className="flex justify-between gap-1 font-mono text-xs">
        <span>{scale.clamp && "≤"}{numberText(scale.valueMin)}</span>
        <span>{numberText(scale.logScale ? Math.sqrt(scale.valueMax * scale.valueMin) : (scale.valueMax + scale.valueMin) / 2)}</span>
        <span>{scale.clamp && "≥"}{numberText(scale.valueMax)}</span>
      </div>
      {scale.logScale && <p>{t("对数色标", "Logarithmic scale")}</p>}
    </> : failed ? (
      imageFailed
        ? <p role="status">{t("色标暂不可用，点查可复核原始像元值。", "Colour scale unavailable. Select a cell to inspect its source value.")}</p>
        : <Image src={svgUrl} alt={t("发布方标注数值与单位的色标", "Provider scale with numerical ticks and units")}
            unoptimized width={125} height={300} onError={() => setImageFailed(true)} />
    ) : <p role="status">{t("正在读取色标…", "Loading colour scale…")}</p>}
    <a className="text-xs text-teal-800 underline" target="_blank" rel="noreferrer" href={svgUrl}>
      {t("Copernicus 原始色标", "Copernicus source legend")}
    </a>
  </figure>;
}

export function OffshoreGridSummary({ grid }: { grid: NonNullable<Feed["grid"]> }) {
  const { t } = useLocale();
  const summary = gridSummary(grid.points);
  if (!summary) return <p>{t("本期样区无格点。", "No samples in this subset.")}</p>;
  return <div className="space-y-1 rounded bg-white p-2">
    <p className="font-semibold">{t("近海样区有效值范围", "Valid range in offshore subset")}</p>
    <p>{summary.min !== null && summary.max !== null
      ? numberText(summary.min) + " – " + numberText(summary.max) + " " + unitText(grid.unit)
      : t("全部缺测", "All samples missing")}
      {" · "}{t("有效格点", "Valid cells")} {summary.count}/{summary.total}</p>
    <p className="text-xs text-slate-600">{t("样点中心范围", "Extent of sample centres")}<br />
      {numberText(summary.south)}–{numberText(summary.north)}° N · {numberText(summary.west)}–{numberText(summary.east)}° E</p>
  </div>;
}
