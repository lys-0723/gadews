"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import { useState } from "react";
import type { MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import { publishedMonitoringSource, type MonitoringOrigin } from "@/lib/gadews/monitoring-source";
import { createDemoMonitoringSource } from "@/lib/gadews/monitoring-demo";
import { MonitoringEvidencePanel } from "./monitoring-evidence-panel";
import { WsdRiskModel } from "./wsd-risk-model";
import { TilapiaRiskModel } from "./tilapia-risk-model";

export function WarningWorkbench({
  initialDisease = "wsd", initialRole = "manager",
}: {
  initialDisease?: "wsd" | "tilapia";
  initialRole?: "manager" | "producer";
} = {}) {
  const w = useWorkbenchText();
  const [disease, setDisease] = useState<"wsd" | "tilapia">(initialDisease);
  const [monitoringSnapshot, setMonitoringSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [sourceMode, setSourceMode] = useState<"published" | "demo">("published");
  const [demoSource] = useState(() => createDemoMonitoringSource());
  const [demoVisited, setDemoVisited] = useState(false);
  const [startRequest, setStartRequest] = useState(0);
  const [tilapiaVisited, setTilapiaVisited] = useState(initialDisease === "tilapia");
  const [aiRevision, setAiRevision] = useState(0);
  const [role, setRole] = useState<"manager" | "producer">(initialRole);
  const buttonClass = (selected: boolean) => `min-h-12 rounded-2xl px-5 py-3 text-left text-sm font-bold transition-colors ${selected ? "bg-teal-700 text-white" : "bg-slate-50 text-slate-700 hover:bg-teal-50"}`;
  const origin: MonitoringOrigin = sourceMode === "demo" && monitoringSnapshot ? { kind: "demo", scenarioId: monitoringSnapshot.feed.id, generatedAt: monitoringSnapshot.fetchedAt } : { kind: "published" };
  return <div className="min-w-0">
    <section aria-label={w("Role guidance")} className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={role === "manager"} className={buttonClass(role === "manager")} onClick={() => setRole("manager")}>{w("Government / Regional Manager")}</button><button type="button" aria-pressed={role === "producer"} className={buttonClass(role === "producer")} onClick={() => setRole("producer")}>{w("Farm / Local Producer")}</button></div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{role === "manager" ? w("Use attributable observations to prioritize follow-up and coordinate laboratory or field review. These manual tools do not provide regional monitoring totals.") : w("Record observations for a defined pond and batch. Use the missing-evidence checks to plan sampling and discuss next actions with an aquatic animal health professional.")}</p>
    </section>
    <div aria-label={w("Disease selection")} className="mt-6 grid gap-3 rounded-3xl border border-teal-100 bg-white p-3 sm:grid-cols-2">
      <button type="button" aria-pressed={disease === "wsd"} className={buttonClass(disease === "wsd")} onClick={() => { if (disease !== "wsd") { setMonitoringSnapshot(null); setAiRevision(value => value + 1); } setDisease("wsd"); }}>{w("WSD / white spot disease")}</button>
      <button type="button" aria-pressed={disease === "tilapia"} className={buttonClass(disease === "tilapia")} onClick={() => { if (disease !== "tilapia") { setMonitoringSnapshot(null); setAiRevision(value => value + 1); } setTilapiaVisited(true); setDisease("tilapia"); }}>{w("Tilapia streptococcosis")}</button>
    </div>
    <section aria-label={w("Monitoring source")} className="mt-6 space-y-3 rounded-3xl border border-teal-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={sourceMode === "demo"} className={buttonClass(sourceMode === "demo")} onClick={() => { setAiRevision(value => value + 1); setMonitoringSnapshot(null); setSourceMode("demo"); setDemoVisited(true); setStartRequest((value) => value + 1); }}>{w("Run monitoring demo")}</button><button type="button" aria-pressed={sourceMode === "published"} className={buttonClass(sourceMode === "published")} onClick={() => { if (sourceMode !== "published") { setMonitoringSnapshot(null); setAiRevision(value => value + 1); } setSourceMode("published"); }}>{w("Published observations")}</button></div>
      {sourceMode === "demo" ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">{w("Demo · synthetic observations")}<span className="mt-1 block font-normal">{w("Four fictional scenarios run without a device or database. Load a scenario into the separate WSD demo draft, then evaluate and save its example report.")}</span></p> : <p className="text-sm leading-6 text-slate-600">{w("Published observations load only when requested. Your manual WSD draft is kept separately from the monitoring demo.")}</p>}
    </section>
    <MonitoringEvidencePanel disease={disease} source={sourceMode === "demo" ? demoSource : publishedMonitoringSource} startRequest={startRequest} onSnapshot={setMonitoringSnapshot} />
    <div aria-label={w("WSD workspace")} role="region" hidden={disease !== "wsd" || sourceMode !== "published"}><WsdRiskModel aiActive={disease === "wsd" && sourceMode === "published"} aiRevision={aiRevision} monitoringSnapshot={sourceMode === "published" ? monitoringSnapshot : null} /></div>
    {demoVisited && <div aria-label={w("WSD demo workspace")} role="region" hidden={disease !== "wsd" || sourceMode !== "demo"}><WsdRiskModel aiActive={disease === "wsd" && sourceMode === "demo"} aiRevision={aiRevision} evidenceMode="demo" idPrefix="wsd-demo" monitoringSnapshot={sourceMode === "demo" ? monitoringSnapshot : null} monitoringOrigin={origin} /></div>}
    {tilapiaVisited && <div aria-label={w("Tilapia workspace")} role="region" hidden={disease !== "tilapia"}><TilapiaRiskModel aiActive={disease === "tilapia"} aiRevision={aiRevision} /></div>}
  </div>;
}
