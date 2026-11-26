"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { useLocale } from "@/components/gadews/locale-provider";
import { RegionalDemoPanel } from "@/components/gadews/risk-map/regional-demo-panel";
import { getRegionalDemoSummary, type RegionalDemoRadius, type RegionalDemoSiteId } from "@/lib/gadews/regional-monitoring-demo";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MapCanvas } from "@/components/gadews/risk-map/map-canvas";
import { LayerControlPanel } from "@/components/gadews/risk-map/layer-control-panel";
import { TimelineController } from "@/components/gadews/risk-map/timeline-controller";
import { LegendToolkit } from "@/components/gadews/risk-map/legend-toolkit";
import type { QaadStatusFilter } from "@/components/gadews/risk-map/qaad-surveillance-layer";
import type { DiseaseFilter, LayerStats } from "@/components/gadews/risk-map/woah-wahis-layer";

import { useEnvironment } from "@/hooks/use-environment";
import { siteIds, type Site, oceanLayers, type OceanLayer } from "@/lib/gadews/environment/snapshot";


function subscribeHash(fn:()=>void) { window.addEventListener("hashchange",fn);return ()=>window.removeEventListener("hashchange",fn); }
function referenceHash() { return siteIds.find(s=>location.hash==="#env-"+s)??null; }

function requestedLayer() { const key=new URLSearchParams(location.search).get("ocean");return oceanLayers.find(v=>v===key)??"off"; }

export default function RiskMapPage() {
  const { t } = useLocale();
  const {data, error, retry}=useEnvironment();
  const selectedSite=useSyncExternalStore(subscribeHash,referenceHash,()=>null);
  const initialLayer=useSyncExternalStore(subscribeHash,requestedLayer,()=>"off" as OceanLayer);
  const [chosenLayer,setOceanLayer]=useState<OceanLayer|null>(null);
  const oceanLayer=chosenLayer??initialLayer;
  const [envPoints,setEnvPoints]=useState(true);
  function locate(site:Site|null){setEnvPoints(true);location.hash=site?"env-"+site:"";}
  const [layers, setLayers] = useState({
    regionalDemo: false,
    boundaries: false,
    waterSystems: false,
    farmDensity: false,
    heatmap: false,
    cases: false,
    coverage: false,
    wahis: true,
    qaad: true,
  });

  const [siteId, setSiteId] = useState<RegionalDemoSiteId>("A");
  const [radius, setRadius] = useState<RegionalDemoRadius>(3000);
  const summary = useMemo(() => layers.regionalDemo ? getRegionalDemoSummary(siteId, radius) : undefined, [layers.regionalDemo, siteId, radius]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [diseaseFilter, setDiseaseFilter] = useState<DiseaseFilter>("all");
  const [qaadStatusFilter, setQaadStatusFilter] = useState<QaadStatusFilter>("priority");
  const [wahisStats, setWahisStats] = useState<LayerStats>({
    recordsDisplayed: 0,
    countriesCovered: 0,
    topDisease: "--",
    countries: [],
  });
  const [qaadStats, setQaadStats] = useState<LayerStats>({
    recordsDisplayed: 0,
    countriesCovered: 0,
    topDisease: "--",
    countries: [],
  });

  const handleToggle = (key: string, value: boolean) => {
    setLayers((prev) => ({ ...prev, [key]: value }));
    if (key === "regionalDemo" && value) {
      if (window.matchMedia("(max-width: 1023px)").matches) setPanelOpen(false);
      requestAnimationFrame(() => document.getElementById("regional-demo-site-select")?.focus({ preventScroll: true }));
    }
  };

  return (
    <div data-risk-map className="fixed inset-0 overflow-hidden bg-background">
      {/* Full-screen map canvas */}
      <MapCanvas
        environment={{delivery:data,layer:oceanLayer,points:envPoints,site:selectedSite}}
        regionalDemo={summary}
        showHeatmap={layers.heatmap}
        showCases={layers.cases}
        showCoverage={layers.coverage}
        showBoundaries={layers.boundaries}
        showWaterSystems={layers.waterSystems}
        showFarmDensity={layers.farmDensity}
        showWahis={layers.wahis}
        showQaad={layers.qaad}
        diseaseFilter={diseaseFilter}
        qaadStatusFilter={qaadStatusFilter}
        onWahisStatsChange={setWahisStats}
        onQaadStatsChange={setQaadStats}
        onPopupVisibilityChange={setPopupOpen}
      />

      {/* ===== FLOATING OVERLAYS ===== */}

      <StickyHeader variant="map" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-24 z-20 flex flex-col">
        {summary && <RegionalDemoPanel summary={summary} onSiteChange={setSiteId} onRadiusChange={setRadius} onClose={() => {
          handleToggle("regionalDemo", false);
          setPanelOpen(true);
          setSourcesOpen(false);
          requestAnimationFrame(() => document.getElementById("regional-demo-toggle")?.focus({ preventScroll: true }));
        }} />}
        <div data-map-controls-space className="relative min-h-0 flex-1">
          {/* Left panel: Layer controller */}
          <div data-layer-panel inert={!panelOpen || popupOpen} aria-hidden={!panelOpen || popupOpen} className={`pointer-events-auto absolute top-0 left-4 z-20 max-h-[max(6rem,calc(100%-12rem))] overflow-y-auto transition-all duration-300 ${popupOpen ? "hidden " : ""}${panelOpen ? "translate-x-0 opacity-100" : "-translate-x-[calc(100%+16px)] opacity-0"}`}>
            <LayerControlPanel
              environment={{delivery:data,failed:error,retry,layer:oceanLayer,onLayer:setOceanLayer,points:envPoints,onPoints:setEnvPoints,site:selectedSite,onSite:locate}}
              layers={layers}
              onToggle={handleToggle}
              diseaseFilter={diseaseFilter}
              onDiseaseFilterChange={setDiseaseFilter}
              qaadStatusFilter={qaadStatusFilter}
              onQaadStatusFilterChange={setQaadStatusFilter}
            />
          </div>

          {/* Left panel toggle button */}
          <button
            onClick={() => { setPanelOpen(!panelOpen); setSourcesOpen(false); }}
            hidden={popupOpen}
            className={`${popupOpen ? "hidden" : "flex"} pointer-events-auto absolute z-40 top-0 border border-slate-300 bg-white text-slate-800 h-11 w-11 items-center justify-center rounded-xl shadow-lg transition-all hover:bg-primary/15 hover:text-primary`}
            style={{ left: panelOpen ? "min(340px, calc(100vw - 52px))" : "16px" }}
            aria-label={panelOpen ? t("关闭图层面板", "Close layers panel") : t("打开图层面板", "Open layers panel")}
            aria-expanded={panelOpen}
          >
            {panelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>

          {/* Right top: Legend & Toolkit */}
          <div className={`pointer-events-auto absolute top-0 right-4 z-20 max-h-[max(6rem,calc(100%-12rem))] overflow-y-auto ${popupOpen ? "hidden" : sourcesOpen ? "" : "hidden lg:block"}`}>
            <LegendToolkit wahisStats={wahisStats} qaadStats={qaadStats} />
          </div>

          {/* Bottom: Timeline controller */}
          <div className={`pointer-events-auto absolute bottom-4 left-4 right-4 z-20 mx-auto max-w-4xl ${popupOpen ? "hidden" : "hidden lg:block"}`}>
            <TimelineController />
          </div>

          {/* Mobile: Collapsed layer panel as bottom sheet trigger */}
          <div className={`pointer-events-auto absolute bottom-12 left-4 z-20 ${popupOpen ? "hidden" : "lg:hidden"}`}>
            <button
              onClick={() => { setPanelOpen(!panelOpen); setSourcesOpen(false); }}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-lg"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
              {t("图层", "Layers")}
            </button>
            <button className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-lg" onClick={() => { setSourcesOpen(!sourcesOpen); setPanelOpen(false); }} aria-expanded={sourcesOpen}>{t("来源与统计", "Sources and statistics")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
