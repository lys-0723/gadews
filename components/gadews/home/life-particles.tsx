"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/gadews/locale-provider";
import { LIFE_STAGES, lifeMotionAllowed, lifePointCount, parseLifeManifest, type LifeStage } from "@/lib/gadews/life-visuals";
import type { LifeParticleScene, LifeSceneOptions } from "./life-particle-scene";
import photoManifest from "@/public/media/gadews/life/manifest.json";

const photoSources = parseLifeManifest(photoManifest).sources;

export type LifeSceneLoader = (canvas: HTMLCanvasElement, options: LifeSceneOptions) => Promise<LifeParticleScene>;
const defaultLoader: LifeSceneLoader = async (canvas, options) => (await import("./life-particle-scene")).createLifeParticleScene(canvas, options);
function createLifeEnvironmentStore() {
    let assistantOverride: boolean | undefined;
    return {
      snapshot: () => typeof window === "undefined" ? 1 : (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0) | (document.hidden ? 2 : 0) | (window.innerWidth < 600 ? 4 : 0) | ((assistantOverride ?? document.body.dataset.gadewsAssistantOpen === "true") ? 8 : 0),
      subscribe: (notify: () => void) => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const assistant = (event: Event) => { const open = (event as CustomEvent<{ open: boolean }>).detail?.open; if (typeof open === "boolean") assistantOverride = open; notify(); };
        media.addEventListener("change", notify); window.addEventListener("resize", notify); document.addEventListener("visibilitychange", notify); window.addEventListener("gadews:assistant-visibility", assistant);
        return () => { media.removeEventListener("change", notify); window.removeEventListener("resize", notify); document.removeEventListener("visibilitychange", notify); window.removeEventListener("gadews:assistant-visibility", assistant); };
      },
    };
  }
function useLifeEnvironment() {
  const store = useMemo(() => createLifeEnvironmentStore(), []);
  const value = useSyncExternalStore(store.subscribe, store.snapshot, () => 1);
  return { reduced: Boolean(value & 1), hidden: Boolean(value & 2), mobile: Boolean(value & 4), assistantOpen: Boolean(value & 8) };
}
export function LifeParticles({ sceneLoader = defaultLoader }: { sceneLoader?: LifeSceneLoader }) {
  const { t } = useLocale();
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<LifeParticleScene | null>(null);
  const motionArea = useRef<HTMLDivElement>(null);
  const stageRef = useRef<LifeStage>(0), failed = useRef(false);
  const [stage, setStage] = useState<LifeStage>(0);
  const [visible, setVisible] = useState(false), [entered, setEntered] = useState(false);
  const { reduced, hidden, mobile, assistantOpen } = useLifeEnvironment();
  const [ready, setReady] = useState(false), [error, setError] = useState(false);
  const titles = [t("尼罗罗非鱼", "Nile tilapia"), t("凡纳滨对虾（幼虾）", "Whiteleg shrimp (juvenile)"), t("细胞结构示意", "Cell structure schematic"), t("链状球菌与杆状病毒示意", "Chain cocci and bacilliform virus schematics")];
  useEffect(() => {
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => { const value = entries.some(entry => entry.isIntersecting); setVisible(value); if (value) setEntered(true); }, { rootMargin: "0px" });
    if (observer && motionArea.current) observer.observe(motionArea.current);
    else { setVisible(true); setEntered(true); }
    return () => observer?.disconnect();
  }, []);
  useEffect(() => {
    if (!entered || reduced || failed.current || !canvas.current) return;
    // Retain the same renderer while outside the viewport. The activity effect stops its RAF.
    const controller = new AbortController(); let disposed = false; let current: LifeParticleScene | null = null;
    void sceneLoader(canvas.current, { count: lifePointCount(window.innerWidth, false), initialStage: stageRef.current, signal: controller.signal, onStage: value => { stageRef.current = value; setStage(value); }, onError: () => { failed.current = true; setError(true); setReady(false); scene.current?.setActive(false); } }).then(value => {
      if (disposed || controller.signal.aborted) { value.dispose(); return; }
      current = value; scene.current = value;
      setReady(true);
    }).catch(() => { if (!disposed) { failed.current = true; setError(true); setReady(false); } });
    return () => { disposed = true; controller.abort(); current?.dispose(); if (scene.current === current) scene.current = null; setReady(false); };
  }, [reduced, sceneLoader, entered, mobile]);
  const active = lifeMotionAllowed({ reduced, visible, hidden, mobile, assistantOpen }) && !error;
  useEffect(() => { scene.current?.setActive(active); }, [active, ready]);
  const photo = stage < 2 ? photoSources[stage === 0 ? 0 : 1] : null;
  return <figure id="life-observer" className="life-particles" aria-label={t("养殖动物与微观生命", "Aquaculture animals and microscopic life")}
    data-life-stage={LIFE_STAGES[stage]} data-life-renderer={ready && !error ? "ready" : "static"}>
    <div ref={motionArea} className="life-motion-area" aria-hidden="true">
      <img className="life-static" src={`/media/gadews/life/${LIFE_STAGES[stage]}-static.svg`} alt="" hidden={ready && !error} />
      <canvas key={reduced ? "static" : mobile ? "mobile" : "desktop"} ref={canvas} hidden={!ready || error} />
    </div>
    <figcaption className="life-description">
      <h4>{titles[stage]}</h4>
      {photo ? <p>{t("照片采样", "Photo sampling")} · <a href={photo.sourceUrl}>{photo.credit}</a> · <a href={photo.licenseUrl}>{photo.license}</a></p> :
        <p>{t("形态示意，非显微照片或诊断结果。", "Morphology schematic, not micrography or diagnosis.")}</p>}
      {error && <p role="status">{t("动态暂不可用，显示静态轮廓。", "Motion is unavailable; showing a static outline.")}</p>}
    </figcaption>
  </figure>;
}
