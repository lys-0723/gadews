"use client";

import { useEffect, useState } from "react";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";

export function TimelineController() {
  const c = useCopy(mapCopy);
  const { t } = useLocale();
  const [value, setValue] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setValue(previous => {
      if (previous >= 36) { setPlaying(false); return previous; }
      return previous + 1;
    }), 800 / speed);
    return () => clearInterval(timer);
  }, [playing, speed]);
  return <section className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-800 shadow-xl" aria-label={c("timeline")}>
    <p>{c("timeline")}</p>
    <div className="flex flex-wrap items-center gap-3">
      <button className="rounded-lg border border-slate-400 px-3 py-2" onClick={() => { setPlaying(false); setValue(0); }}>{c("reset")}</button>
      <button className="rounded-lg bg-sky-900 px-3 py-2 text-white" aria-pressed={playing} onClick={() => setPlaying(!playing)}>{c(playing ? "pause" : "play")}</button>
      <button className="rounded-lg border border-slate-400 px-3 py-2" aria-label={t("示意播放速度", "Illustration playback speed")} onClick={() => setSpeed(speed === 4 ? 1 : speed * 2)}>×{speed}</button>
      <label className="flex min-w-32 flex-1 flex-col gap-2"><span>{value === 30 ? c("today") : t(`示意偏移：${value - 30} 天`, `Illustrative offset: ${value - 30} days`)}</span><input type="range" min="0" max="36" value={value} onChange={e => setValue(Number(e.target.value))} /></label>
    </div>
  </section>;
}
