"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/gadews/locale-provider";
import { LIFE_STAGES, lifeMotionAllowed, lifePointCount, parseLifeManifest, type LifeManifest, type LifeStage } from "@/lib/gadews/life-visuals";
import type { LifeParticleScene, LifeSceneOptions } from "./life-particle-scene";
import { readBoundedLifeResource } from "./life-particle-resources";
import { PhotoReferenceDialog } from "./photo-reference-dialog";

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
export function LifeParticles({ sceneLoader = defaultLoader, manifestFetcher = fetch }: { sceneLoader?: LifeSceneLoader; manifestFetcher?: typeof fetch }) {
  const { t } = useLocale();
  const host = useRef<HTMLElement>(null), canvas = useRef<HTMLCanvasElement>(null), scene = useRef<LifeParticleScene | null>(null);
  const motionArea = useRef<HTMLDivElement>(null);
  const stageRef = useRef<LifeStage>(0), autoRef = useRef(true), focusRef = useRef(false), failed = useRef(false);
  const [stage, setStage] = useState<LifeStage>(0), [auto, setAuto] = useState(true), [paused, setPaused] = useState(false), [focus, setFocus] = useState(false), [referenceOpen, setReferenceOpen] = useState(false);
  const [visible, setVisible] = useState(false), [entered, setEntered] = useState(false);
  const { reduced, hidden, mobile, assistantOpen } = useLifeEnvironment();
  const [ready, setReady] = useState(false), [error, setError] = useState(false), [manifest, setManifest] = useState<LifeManifest | null>(null);
  const labels = [t("罗非鱼", "Tilapia"), t("对虾", "Shrimp"), t("细胞", "Cells"), t("病原示意", "Pathogens")];
  const titles = [t("尼罗罗非鱼", "Nile tilapia"), t("凡纳滨对虾（幼虾）", "Whiteleg shrimp (juvenile)"), t("细胞结构示意", "Cell structure schematic"), t("链状球菌与杆状病毒示意", "Chain cocci and bacilliform virus schematics")];
  useEffect(() => {
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => { const value = entries.some(entry => entry.isIntersecting); setVisible(value); if (value) setEntered(true); }, { rootMargin: "0px" });
    if (observer && motionArea.current) observer.observe(motionArea.current);
    else { setVisible(true); setEntered(true); }
    return () => observer?.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || manifest) return;
    const controller = new AbortController();
    void readBoundedLifeResource("/media/gadews/life/manifest.json", 32768, controller.signal, manifestFetcher).then(bytes => {
      const next = parseLifeManifest(JSON.parse(new TextDecoder().decode(bytes))); if (!controller.signal.aborted) setManifest(next);
    }).catch(() => { /* The static silhouette and source links remain available if metadata cannot load. */ });
    return () => controller.abort();
  }, [visible, manifest, manifestFetcher]);
  useEffect(() => {
    if (!entered || reduced || failed.current || !canvas.current) return;
    // Retain the same renderer while outside the viewport. The activity effect stops its RAF.
    const controller = new AbortController(); let disposed = false; let current: LifeParticleScene | null = null;
    void sceneLoader(canvas.current, { count: lifePointCount(window.innerWidth, false), initialStage: stageRef.current, signal: controller.signal, onStage: value => { stageRef.current = value; setStage(value); }, onError: () => { failed.current = true; setError(true); setReady(false); scene.current?.setActive(false); } }).then(value => {
      if (disposed || controller.signal.aborted) { value.dispose(); return; }
      current = value; scene.current = value;
      // A user can select another form while import/fetch is pending. Reveal only the latest selection.
      value.setStage(stageRef.current, true); value.setAuto(autoRef.current); value.setFocus(focusRef.current); setReady(true);
    }).catch(() => { if (!disposed) { failed.current = true; setError(true); setReady(false); } });
    return () => { disposed = true; controller.abort(); current?.dispose(); if (scene.current === current) scene.current = null; setReady(false); };
  }, [reduced, sceneLoader, entered, mobile]);
  useEffect(() => {
    const closeForAssistant = (event: Event) => { if ((event as CustomEvent<{ open: boolean }>).detail?.open) setReferenceOpen(false); };
    window.addEventListener("gadews:assistant-visibility", closeForAssistant);
    return () => window.removeEventListener("gadews:assistant-visibility", closeForAssistant);
  }, []);
  const active = lifeMotionAllowed({ reduced, visible, hidden, assistantOpen, mobile }) && !paused && !referenceOpen && !error;
  useEffect(() => { scene.current?.setActive(active); }, [active, ready]);
  function choose(next: LifeStage) { stageRef.current = next; setStage(next); autoRef.current = false; setAuto(false); scene.current?.setAuto(false); scene.current?.setStage(next, reduced); }
  function toggleFocus() { const next = !focus; focusRef.current = next; setFocus(next); scene.current?.setFocus(next); host.current?.closest(".hero")?.scrollIntoView?.({ block: "start", behavior: "instant" }); }
  const fallback = `/media/gadews/life/${LIFE_STAGES[stage]}-static.svg`;
  return <section ref={host} className={`life-particles${focus ? " is-focused" : ""}`} aria-label={t("养殖动物与微观生命", "Aquaculture animals and microscopic life")} data-life-stage={LIFE_STAGES[stage]} data-life-renderer={ready && !error ? "ready" : "static"}>
    <div className="life-visual-stage">
      <img className="life-static" src={fallback} alt={titles[stage]} hidden={ready && !error} />
      <div ref={motionArea} className="life-motion-area" aria-hidden="true">
        <canvas key={reduced ? "static" : mobile ? "mobile" : "desktop"} ref={canvas} hidden={!ready || error} />
      </div>
    </div>
    <div className="life-description"><h2>{titles[stage]}</h2><p>{stage < 2 ? t("真实照片的轮廓与纹理采样。", "Contour and texture sampled from a real photograph.") : t("形态示意，非显微照片或诊断结果。", "Morphology schematic, not micrography or diagnosis.")}</p>{error && <p role="status">{t("动态暂不可用，显示有来源的静态轮廓。", "Motion is unavailable; showing a sourced static outline.")}</p>}</div>
    <div className="life-controls"><div className="life-shapes" role="group" aria-label={t("生命形态", "Life forms")}><button type="button" aria-pressed={auto} onClick={() => { autoRef.current = true; setAuto(true); stageRef.current = 0; setStage(0); scene.current?.setStage(0, reduced); scene.current?.setAuto(true); }}>{t("自动变形", "Auto morph")}</button>{labels.map((label, i) => <button type="button" key={i} aria-pressed={!auto && stage === i} onClick={() => choose(i as LifeStage)}>{label}</button>)}</div><div className="life-actions"><PhotoReferenceDialog stage={stage} source={manifest?.sources[stage === 1 ? 1 : 0]} open={referenceOpen} onOpenChange={setReferenceOpen} /><button type="button" aria-pressed={focus} onClick={toggleFocus}>{focus ? t("返回页面", "Show page") : t("聚焦形态", "Focus form")}</button>{!reduced && <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? t("继续", "Resume") : t("暂停", "Pause")}</button>}</div></div>
  </section>;
}
