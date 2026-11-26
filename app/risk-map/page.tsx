"use client";

import { useState, useSyncExternalStore, type MouseEvent } from "react";
import { Globe2, Waves } from "lucide-react";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { useLocale } from "@/components/gadews/locale-provider";
import { MapCanvas } from "@/components/gadews/risk-map/map-canvas";
import { LayerControlPanel } from "@/components/gadews/risk-map/layer-control-panel";
import { LegendToolkit } from "@/components/gadews/risk-map/legend-toolkit";
import { RegionalDemoPanel } from "@/components/gadews/risk-map/regional-demo-panel";
import { RegionalEvidencePanel } from "@/components/gadews/risk-map/regional-evidence-panel";
import { OceanControls } from "@/components/gadews/environment/environment-map-controls";
import { useEnvironment } from "@/hooks/use-environment";
import { getRegionalDemoSummary, type RegionalDemoRadius, type RegionalDemoSiteId } from "@/lib/gadews/regional-monitoring-demo";
import { effectiveRegionalDay, regionalDates, regionalLayerTime } from "@/lib/gadews/environment/regional-evidence";
import { oceanLayers, siteIds, type OceanLayer, type Site } from "@/lib/gadews/environment/snapshot";
import { allHistory, type HistoryScope, type HistoryStats as LayerStats } from "@/lib/gadews/history-reports";
import { DISEASE_FILTERS, type MapDiseaseFilter as DiseaseFilter, type QaadStatusFilter } from "@/lib/gadews/public-surveillance";
import styles from "./map-workspace.module.css";

function subscribe(fn: () => void) {
  const events = ["popstate", "hashchange", "gadews:map-location"];
  events.forEach(event => window.addEventListener(event, fn));
  return () => events.forEach(event => window.removeEventListener(event, fn));
}
function shownCount(enabled: boolean, stats: LayerStats) {
  return enabled && (stats.state === "success" || stats.state === "empty") ? stats.recordsDisplayed : "—";
}
const getLocation = () => location.search + location.hash;

function navigate(href: string, replace = false) {
  if (replace) window.history.replaceState(window.history.state, "", href);
  else window.history.pushState(null, "", href);
  window.dispatchEvent(new Event("gadews:map-location"));
}

function follow(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  navigate(href);
}

function regionalUrl(site: Site, layer: OceanLayer, day?: string | null) {
  const query = new URLSearchParams({view: "regional", ocean: layer});
  if (day) query.set("day", day);
  return "/risk-map?" + query + "#env-" + site;
}

export default function RiskMapPage() {
  const { t } = useLocale();
  const {data, error, retry} = useEnvironment();
  const location = useSyncExternalStore(subscribe, getLocation, () => "");
  const url = new URL("/risk-map" + location, "https://gadews.local");
  const explicitSite = siteIds.find(id => url.hash === "#env-" + id);
  const regional = url.searchParams.get("view") === "regional" ||
    (!url.searchParams.has("view") && (!!explicitSite || url.searchParams.has("ocean")));
  const site = explicitSite ?? "offshore";
  const layer = oceanLayers.find(id => id === url.searchParams.get("ocean")) ?? (site === "offshore" ? "salinity" : "off");
  const activeFeed = data?.snapshot.feeds.find(f => f.id === layer);
  const layerDates = activeFeed?.heatMaps ? activeFeed.series[0].times
    : [activeFeed?.grid?.time ?? activeFeed?.raster?.time].filter((v): v is string => !!v);
  const availableDays = new Set(data ? regionalDates(data.snapshot, site, data.asOf) : []);
  for (const time of layerDates) availableDays.add(time.slice(0,10));
  const days = [...availableDays].sort();
  const requestedDay = url.searchParams.get("day") ??
    (activeFeed && !activeFeed.heatMaps ? layerDates[0]?.slice(0,10) : null);
  const day = effectiveRegionalDay(days, requestedDay, data?.asOf ?? 0);
  const validTime = regionalLayerTime(activeFeed, day);
  const month = Math.max(0, layerDates.indexOf(validTime ?? ""));
  const regionalLink = regionalUrl("offshore", "salinity");
  const [points, setPoints] = useState(true);
  const [demo, setDemo] = useState(false);
  const [siteId, setSiteId] = useState<RegionalDemoSiteId>("A");
  const [radius, setRadius] = useState<RegionalDemoRadius>(3000);
  const summary = regional && demo ? getRegionalDemoSummary(siteId, radius) : undefined;
  const [sources, setSources] = useState({wahis:true, qaad:true});
  const [historyPanel, setHistoryPanel] = useState<"filters" | "results">("filters");
  function locate(next: Site) {
    setDemo(false);
    setPoints(true);
    navigate(regionalUrl(next, layer, day), true);
  }
  function chooseLayer(next: OceanLayer) {
    const f = data?.snapshot.feeds.find(item => item.id === next);
    const first = f?.grid?.time ?? f?.raster?.time ?? f?.series[0]?.times[0];
    navigate(regionalUrl(site, next, regionalLayerTime(f, day) ? day : first?.slice(0,10) ?? day), true);
  }
  const [history, setHistory] = useState<HistoryScope>(allHistory);
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

  const locations = new Map([...(wahisStats.options?.locations ?? []), ...(qaadStats.options?.locations ?? [])]);
  const countries = [...new Set([...locations.keys(), ...(history.country ? [history.country] : [])])].sort();
  const years = [...new Set([...(wahisStats.options?.years ?? []), ...(qaadStats.options?.years ?? []), ...(history.year ? [history.year] : [])])].sort().reverse();
  const diseaseNames = new Map([...(wahisStats.options?.diseases ?? []), ...(qaadStats.options?.diseases ?? [])]);
  if (diseaseFilter.startsWith("source:")) {
    const id = diseaseFilter.slice(7);
    if (!diseaseNames.has(id)) diseaseNames.set(id, id);
  }
  const diseases = [...diseaseNames].filter(([id]) => !(DISEASE_FILTERS as readonly string[]).includes(id))
    .sort((a, b) => a[1].localeCompare(b[1]));
  function resetHistory() {
    setHistory(allHistory);
    setDiseaseFilter("all");
    setQaadStatusFilter("priority");
    setSources({ wahis: true, qaad: true });
  }


  return <div data-risk-map>
    <StickyHeader variant="map" />
    <main className={styles.workspace}>
      <header className={styles.toolbar}>
        <nav aria-label={t("地图视图", "Map views")} className={styles.views}>
          <a href="/risk-map" aria-current={!regional ? "page" : undefined} onClick={e => { if (regional) { setDemo(false); follow(e, "/risk-map"); } }}>
            <Globe2 size={17} aria-hidden="true"/>{t("全球历史报告", "Historical reports")}
          </a>
          <a href={regional ? url.pathname + url.search + url.hash : regionalLink} aria-current={regional ? "page" : undefined}
            onClick={e => {if (!regional) follow(e, regionalLink);}}>
            <Waves size={17} aria-hidden="true"/>{t("区域监测与复核", "Regional monitoring")}
          </a>
        </nav>
        <a className={styles.catalog} href="/overview#environment-catalog">{t("环境资料目录", "Data catalogue")} ↗</a>
      </header>
      <div className={styles.body}>
        <aside className={styles.rail} aria-label={t("地图资料与筛选", "Map evidence and filters")} key={regional ? "regional" : "history"}>
          {regional ? <>
            <RegionalEvidencePanel delivery={data} failed={error} retry={retry} site={site} day={day} days={days}
              onSiteChange={locate} onDayChange={next => {setDemo(false); navigate(regionalUrl(site, layer, next), true);}}>
              <OceanControls hideSitePicker delivery={data} failed={error} retry={retry} layer={layer} onLayer={chooseLayer}
                points={points} onPoints={setPoints} site={site} onSite={s => s && locate(s)}
                heatMonth={month} onHeatMonth={i => navigate(regionalUrl(site, layer, layerDates[i]?.slice(0,10)), true)} />
              {layer !== "off" && !validTime && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm">
                {t("所选日期没有该图层，地图仅显示地理背景和已打开的代表点。", "No layer for this date. Only geography and enabled reference points are shown.")}
                {layerDates.length > 0 && <button type="button" className="ml-1 underline" onClick={() => navigate(regionalUrl(site, layer, layerDates[0].slice(0,10)), true)}>
                  {t("查看资料期", "View available period")} {layerDates[0].slice(0,10)}
                </button>}
              </p>}
            </RegionalEvidencePanel>
            <details><summary className="cursor-pointer font-semibold">{t("附近巡查记录演示", "Nearby monitoring example")}</summary>
              <label className="my-3 flex items-center gap-2"><input id="regional-demo-toggle" type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)}/>{t("查看虚构场点及周边记录", "View fictional sites and records")}</label>
              {summary && <RegionalDemoPanel summary={summary} onSiteChange={setSiteId} onRadiusChange={setRadius} onClose={() => setDemo(false)} />}
            </details>
          </> : <>
            <div className={styles.views} aria-label={t("历史资料选项", "Historical report options")}>
              {(["filters","results"] as const).map(tab => <button type="button" key={tab} aria-pressed={historyPanel === tab}
                className="flex-1 rounded-md px-2 py-2 text-sm font-semibold aria-pressed:bg-white aria-pressed:shadow-sm"
                onClick={() => setHistoryPanel(tab)}>
                {tab === "filters" ? t("报告筛选","Filters") : t("记录与来源","Records and sources")}
              </button>)}
            </div>
            <p className="my-3 text-sm font-semibold" aria-live="polite">{history.country || t("全球", "Worldwide")} · WAHIS {shownCount(sources.wahis, wahisStats)} · QAAD {shownCount(sources.qaad, qaadStats)}</p>
            {historyPanel === "filters" ? <LayerControlPanel
              history={{scope: history, countries, years, diseases, onChange: setHistory, onReset: resetHistory}}
              layers={sources} onToggle={(key, value) => setSources(prev => ({...prev,[key]:value}))}
              diseaseFilter={diseaseFilter} onDiseaseFilterChange={setDiseaseFilter}
              qaadStatusFilter={qaadStatusFilter} onQaadStatusFilterChange={setQaadStatusFilter}
            /> : <LegendToolkit scope={history} wahisStats={wahisStats} qaadStats={qaadStats} enabled={sources} />}
          </>}
        </aside>
        <div className={styles.map} data-map-controls-space>
          <MapCanvas key={regional ? "regional" : "history"} history={regional ? undefined : history}
            reportCenter={!regional ? locations.get(history.country) : undefined}
            environment={regional && !demo ? {delivery:data, heatMonth:month, layer:validTime ? layer : "off", points, site, day, onSiteChange: locate} : undefined}
            regionalDemo={summary} showWahis={!regional && sources.wahis} showQaad={!regional && sources.qaad}
            diseaseFilter={diseaseFilter} qaadStatusFilter={qaadStatusFilter}
            onWahisStatsChange={setWahisStats} onQaadStatsChange={setQaadStats}
          />
        </div>
      </div>
    </main>
  </div>;
}
