"use client";
import { useEffect, useRef, useState } from "react";
import { Popup, useMapEvent } from "react-leaflet";
import { useLocale } from "../locale-provider";
import { unitText, numberText } from "@/lib/gadews/environment/ocean-legend";
import { names, type FeedId } from "@/lib/gadews/environment/snapshot";

interface Pixel {
  value: number | null;
  unit: string;
  lat: number;
  lon: number;
  time: string;
  source: string;
}
interface Selection {
  position: [number, number];
  status: "loading" | "failed" | "ready";
  pixel?: Pixel;
}
export function EnvironmentPixel({ id, time }: { id: FeedId; time: string }) {
  const { t } = useLocale();
  const [selection, setSelection] = useState<Selection | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useMapEvent("click", async (e) => {
    if (
      e.originalEvent.target instanceof Element &&
      e.originalEvent.target.closest(
        ".leaflet-interactive,.leaflet-marker-icon,.leaflet-control,.leaflet-popup",
      )
    )
      return;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const { lat, lng } = e.latlng.wrap(),
      position: [number, number] = [lat, lng];
    setSelection({ position, status: "loading" });
    try {
      const q = new URLSearchParams({ layer: id, time, lat: lat.toFixed(4), lon: lng.toFixed(4) });
      const r = await fetch("/api/environment/pixel?" + q, { signal: ctrl.signal });
      if (!r.ok) throw new Error("source");
      const pixel: Pixel = await r.json();
      if (!ctrl.signal.aborted) setSelection({ position, status: "ready", pixel });
    } catch {
      if (!ctrl.signal.aborted) setSelection({ position, status: "failed" });
    }
  });
  if (!selection) return null;
  const p = selection.pixel;
  return (
    <Popup className="environment-popup" position={selection.position} autoPan={false}>
      <strong>{t(...names[id])}</strong>
      <p>{time} UTC</p>
      {p ? (
        <>
          <p>
            {p.value === null ? t("该像元缺测", "Missing pixel") : numberText(p.value) + " " + unitText(p.unit)}
          </p>
          <p>
            {p.lat.toFixed(3)}°, {p.lon.toFixed(3)}°
          </p>
          <a href={p.source} target="_blank" rel="noreferrer">
            {t("复核原始像元", "Inspect source pixel")}
          </a>
        </>
      ) : (
        <p role="status">
          {selection.status === "loading"
            ? t("正在读取像元…", "Reading pixel…")
            : t(
                "源服务暂不可用，或资料日期已更新；请刷新图层。",
                "Source unavailable or product updated; refresh the layer.",
              )}
        </p>
      )}
    </Popup>
  );
}
