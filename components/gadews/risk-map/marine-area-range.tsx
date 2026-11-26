"use client";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { useLocale } from "../locale-provider";
import { ProviderLegend } from "../environment/ocean-legend";
import { heatColors } from "@/lib/gadews/environment/heat-grid";
import { unitText, numberText, gridBreaks, gridPalette } from "@/lib/gadews/environment/ocean-legend";
import { names, type Feed } from "@/lib/gadews/environment/snapshot";
import { localRange, longitude, sampleLocations, summarize, type Extent, type RangeSummary } from "@/lib/gadews/environment/map-range";

function viewport(map: L.Map): Extent {
  const b = map.getBounds();
  return { south: Math.max(-85, b.getSouth()), north: Math.min(85, b.getNorth()),
    west: longitude(b.getWest()), span: Math.min(360, b.getEast() - b.getWest()) };
}

async function readSamples(feed: Feed, time: string, box: Extent, signal: AbortSignal) {
  const locations = sampleLocations(box);
  const values: (number | null)[] = [];
  let unit = "", failed = 0;
  async function worker() {
    while (locations.length && !signal.aborted) {
      const p = locations.shift()!;
      const q = new URLSearchParams({layer: feed.id, time, lat: p.lat.toFixed(4), lon: p.lon.toFixed(4)});
      try {
        const res = await fetch("/api/environment/pixel?" + q, {signal});
        if (!res.ok) throw new Error("pixel");
        const pixel = await res.json();
        if (pixel.time !== time || !pixel.unit || (unit && pixel.unit !== unit) ||
            (pixel.value !== null && !Number.isFinite(pixel.value))) throw new Error("metadata");
        unit = pixel.unit;
        values.push(pixel.value);
      } catch {
        if (!signal.aborted) failed++;
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return summarize(values, unit, failed);
}

export function MarineAreaRange({feed, month}: {feed: Feed; month: number}) {
  const map = useMap(), {t} = useLocale();
  const [box, setBox] = useState(() => viewport(map));
  const update = useCallback(() => setBox(viewport(map)), [map]);
  useEffect(() => {
    map.on("moveend resize", update);
    const frame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame); map.off("moveend resize", update); };
  }, [map, update]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (root.current) L.DomEvent.disableClickPropagation(root.current); }, []);
  const local = useMemo(() => localRange(feed, box, month), [feed, box, month]);
  const [remote, setRemote] = useState<{box: Extent; data: RangeSummary} | null>(null);
  const [attempt, retry] = useState(0);
  const time = feed.raster?.time;
  useEffect(() => {
    if (!time) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      const data = await readSamples(feed, time, box, ctrl.signal);
      if (!ctrl.signal.aborted) setRemote({box, data});
    }, 600);
    return () => { window.clearTimeout(timer); ctrl.abort(); };
  }, [feed, time, box, attempt]);
  const range = local ?? (remote?.box === box ? remote.data : null);
  const stamp = time ?? feed.grid?.time ?? feed.series[0]?.times[month];
  const cuts = feed.id === "oisst" ? gridBreaks.oisst : gridBreaks.viirs;
  const bins = feed.heatMaps ? ["0–24%", "25–49%", "50–74%", "75–100%"] :
    ["<" + cuts[0], cuts[0] + "–<" + cuts[1], cuts[1] + "–<" + cuts[2], "≥" + cuts[2]];
  const colors = feed.heatMaps ? heatColors : gridPalette;
  return <div ref={root} className="absolute left-2 top-2 z-[450] w-[min(15rem,70%)] max-h-[75%] overflow-y-auto rounded-md border border-slate-300 bg-white/95 px-3 py-2 text-xs leading-normal text-slate-800 shadow-sm" aria-live="polite" data-area-range>
    <strong className="block">{t(...names[feed.id])}</strong>
    <span>{(feed.heatMaps ? stamp?.slice(0,7) : stamp?.slice(0,10))} UTC</span>
    {feed.raster ? <ProviderLegend raster={feed.raster} /> : <div className="mt-1">
      <span>{t("图层色标", "Layer colour scale")} · {feed.heatMaps ? "%" : unitText(feed.grid?.unit ?? "")}</span>
      <div className="mt-1 grid grid-cols-4 gap-px">{bins.map((bin, i) => <span key={bin} className="text-center">
        <i className="mb-0.5 block h-2" style={{background: colors[i]}} aria-hidden="true"/>{bin}</span>)}</div>
    </div>}
    <strong className="mt-1 block">{time ? t("当前视窗 · 3 × 3 点抽样", "Visible area · 3 × 3 point sample") : t("当前视窗 · 有效格点范围", "Visible area · valid grid range")}</strong>
    {!range ? t("正在读取数值…", "Reading values…") : <>
      <span className="block font-mono">{range.valid ? numberText(range.min!) + " – " + numberText(range.max!) + " " + unitText(range.unit)
        : range.failed === range.total && range.failed > 0 ? t("来源暂不可用", "Source unavailable")
        : range.total ? t("未取得有效值", "No valid values") : t("视窗内无资料格点", "No grid centres in view")}</span>
      {range.total > 0 && <span>{t("有效", "Valid")} {range.valid}/{range.total}</span>}
      {range.failed > 0 && <> · {t("读取失败", "Failed")} {range.failed} <button type="button" className="underline" onClick={() => {setRemote(null); retry(n => n + 1);}}>{t("重试", "Retry")}</button></>}
    </>}
  </div>;
}
