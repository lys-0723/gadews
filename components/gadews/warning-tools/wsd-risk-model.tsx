"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import { useEffect, useMemo, useState } from "react";
import { Activity, ClipboardCheck, FlaskConical } from "lucide-react";
import { assessWsd, loadWsdWarningModelConfig, type WsdAssessmentContext, type WsdWarningInput, type WsdWarningModelConfig } from "@/lib/gadews/wsd-warning-model";
import type { MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import type { MonitoringOrigin } from "@/lib/gadews/monitoring-source";
import { isDemoMonitoringScenarioId } from "@/lib/gadews/monitoring-demo";
import { applyMonitoringToWsd, clearWsdMonitoringField, clearWsdMonitoringIdentity, getWsdMonitoringProvenance } from "@/lib/gadews/wsd-monitoring";
import type { AssessmentResult } from "@/lib/gadews/warning-assessment";
import { AssessmentResultPanel } from "./assessment-result-panel";
import { WarningInputForm } from "./warning-input-form";
import { WSD_FIELDS, WSD_WORKBENCH_EXAMPLE } from "./warning-fields";
import { AiAssessmentPanel } from "./ai-assessment-panel";
import type { AiAssessmentRequest } from "@/lib/gadews/ai-assessment/types";

const publishedOrigin: MonitoringOrigin = { kind: "published" };
function emptyForm(demo: boolean): { input: WsdWarningInput; context: WsdAssessmentContext } {
  return { input: {}, context: demo ? { dataMode: "example", inputProvenance: { demoSession: { kind: "demo" } } } : {} };
}
export function WsdRiskModel({ monitoringSnapshot = null, monitoringOrigin = publishedOrigin, evidenceMode = "published", idPrefix = "wsd", aiActive = true, aiRevision = 0 }: { monitoringSnapshot?: MonitoringSnapshot | null; monitoringOrigin?: MonitoringOrigin; evidenceMode?: "published" | "demo"; idPrefix?: string; aiActive?: boolean; aiRevision?: number } = {}) {
  const w = useWorkbenchText();
  const demo = evidenceMode === "demo";
  const [config, setConfig] = useState<WsdWarningModelConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [{ input, context }, setForm] = useState(() => emptyForm(demo));
  const [mode, setMode] = useState<"manual" | "example">(demo ? "example" : "manual");
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [evaluationError, setEvaluationError] = useState(false);
  const [monitoringApplyError, setMonitoringApplyError] = useState<string | null>(null);
  const aiRequest = useMemo<AiAssessmentRequest>(() => ({ diseaseId: "wsd", standardId: "wsd-v1.0", locale: "en", input, context: { ...context, dataMode: demo ? "example" : mode } }), [input, context, demo, mode]);
  useEffect(() => {
    let mounted = true;
    loadWsdWarningModelConfig().then((value) => { if (mounted) { setConfig(value); setLoadError(false); } }).catch(() => { if (mounted) setLoadError(true); });
    return () => { mounted = false; };
  }, [retry]);
  const update = (key: string, value: string | number | boolean | undefined) => {
    setMonitoringApplyError(null);
    setForm((current) => {
      let next = { input: { ...current.input }, context: current.context };
      if (key === "regionOrSite" || key === "farmOrPondId") next = clearWsdMonitoringIdentity(next.input, next.context);
      if (key === "waterTemperatureC" || key === "ph") next = clearWsdMonitoringField(next.input, next.context, key);
      if (value === undefined) delete next.input[key]; else next.input[key] = value;
      return { input: next.input, context: next.context };
    });
    if (result) setOutdated(true);
  };
  const evaluate = () => {
    if (!config) return;
    try { setResult(assessWsd(input, config, { ...context, dataMode: demo ? "example" : mode, now: new Date() })); setOutdated(false); setEvaluationError(false); }
    catch { setEvaluationError(true); setResult(null); }
  };
  const monitoring = getWsdMonitoringProvenance(context);
  const candidate = monitoringSnapshot ? applyMonitoringToWsd(input, { ...context, dataMode: demo ? "example" : mode }, monitoringSnapshot, new Date(), monitoringOrigin) : null;
  const canLoadDemo = monitoringSnapshot && monitoringOrigin.kind === "demo" && isDemoMonitoringScenarioId(monitoringOrigin.scenarioId) && monitoringOrigin.scenarioId === monitoringSnapshot.feed.id && monitoringOrigin.generatedAt === monitoringSnapshot.fetchedAt;
  const applyMonitoring = () => {
    if (!monitoringSnapshot) return;
    const next = applyMonitoringToWsd(input, { ...context, dataMode: mode }, monitoringSnapshot, new Date(), monitoringOrigin);
    if (!next.appliedFields.length) { setMonitoringApplyError(next.reason); return; }
    setMonitoringApplyError(null);
    setForm({ input: next.input, context: next.context });
    if (result) setOutdated(true);
  };
  const loadDemo = () => {
    if (!monitoringSnapshot || !canLoadDemo || monitoringOrigin.kind !== "demo") return;
    const now = new Date();
    const scope: WsdWarningInput = { regionOrSite: monitoringSnapshot.feed.siteId, farmOrPondId: monitoringSnapshot.feed.pondId };
    const demoContext: WsdAssessmentContext = { dataMode: "example", inputProvenance: { demoSession: { ...monitoringOrigin, loadedAt: now.toISOString(), snapshot: structuredClone(monitoringSnapshot) } } };
    const next = applyMonitoringToWsd(scope, demoContext, monitoringSnapshot, now, monitoringOrigin);
    setForm({ input: next.input, context: next.context }); setMode("example"); setMonitoringApplyError(next.reason); setResult(null); setOutdated(false); setEvaluationError(false);
  };
  return <section aria-label={w("WSD assessment")} className="mt-10 space-y-6" id={idPrefix === "wsd" ? "warning-assessment" : `${idPrefix}-warning-assessment`}>
    <header className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-6 sm:p-8">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-teal-700"><Activity className="h-4 w-4" />{w("Rule assessment prototype")}</p>
      <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">{w("WSD / white spot disease")}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{w("Record the evidence you actually have. Missing observations remain missing. Rule conflicts need expert review; this tool provides screening support, not a diagnosis or a calibrated prediction.")}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white px-3 py-1 text-teal-800">{demo ? w("Demo · synthetic observations") : w("Manual input")}</span><span className="rounded-full bg-white px-3 py-1 text-slate-600">{w("Explicit point observations")}</span>{mode === "example" && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{w("Example data")}</span>}</div>
    </header>
    {loadError ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{w("WSD configuration could not be loaded.")}{" "}<button type="button" className="ml-2 underline" onClick={() => { setLoadError(false); setRetry((n) => n + 1); }}>{w("Retry configuration")}</button></div> : !config && <p role="status" className="text-sm text-slate-500">{w("Loading WSD configuration…")}</p>}
    {monitoringSnapshot && <section aria-label={w("Apply monitoring to WSD")} className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
      <h3 className="font-bold">{demo ? w("Use a synthetic scenario") : w("Use monitoring evidence")}</h3><p className="mt-2 break-words leading-6">{w("Selected:")}{" "}{w(monitoringSnapshot.feed.label)}{" "}{w("· Site")}{" "}{monitoringSnapshot.feed.siteId}{" "}{w("· Pond")}{" "}{monitoringSnapshot.feed.pondId}. {demo ? w("Loading replaces this demo draft with the fictional site, pond and usable temperature / pH only. Clinical and laboratory fields remain blank.") : w("Enter these exact IDs yourself. Only blank temperature and pH fields can be filled.")}</p>
      <button type="button" disabled={demo ? !canLoadDemo : !candidate?.appliedFields.length} onClick={demo ? loadDemo : applyMonitoring} className="mt-3 min-h-11 rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{demo ? w("Load demo observation into WSD") : w("Apply monitoring to empty WSD fields")}</button>
      <p className="mt-2 leading-6">{w(monitoringApplyError ?? (demo ? w("Load explicitly, then choose Evaluate WSD. Missing, expired and unverified values stay blank; dissolved oxygen stays in the preview.") : candidate?.reason ?? "Apply explicitly, then choose Evaluate WSD. Dissolved oxygen stays in the preview."))}</p>
    </section>}
    {Object.keys(monitoring).length > 0 && <section aria-label={w("Attached monitoring evidence")} className="rounded-2xl border border-teal-100 bg-white p-4 text-sm"><h3 className="font-bold text-teal-800">{w("Monitoring evidence attached")}</h3><ul className="mt-2 space-y-2 text-xs text-slate-600">{(["waterTemperatureC", "ph"] as const).map((field) => monitoring[field] && <li key={field} className="break-words">{field === "waterTemperatureC" ? w("Water temperature") : "pH"}: {monitoring[field]!.snapshot.observation?.reference}{" "}{w("· Applied")}{" "}{monitoring[field]!.appliedAt}</li>)}</ul><p className="mt-2 text-xs text-slate-500">{w("Editing a field removes its monitoring source. Changing the site or pond clears values still attached to monitoring.")}</p></section>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <form onSubmit={(event) => { event.preventDefault(); evaluate(); }} className="min-w-0 space-y-5">
        <WarningInputForm fields={WSD_FIELDS} input={input} onChange={update} prefix={idPrefix} />
        <div className="sticky bottom-3 flex flex-wrap gap-2 rounded-2xl border border-teal-100 bg-white/95 p-3 shadow-lg backdrop-blur">
          <button type="submit" disabled={!config} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"><ClipboardCheck className="h-4 w-4" />{w("Evaluate WSD")}</button>
          {!demo && <button type="button" onClick={() => { setForm({ input: { ...WSD_WORKBENCH_EXAMPLE }, context: {} }); setMode("example"); setMonitoringApplyError(null); setResult(null); setOutdated(false); setEvaluationError(false); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold"><FlaskConical className="h-4 w-4" />{w("Load WSD example")}</button>}
          <button type="button" onClick={() => { setForm(emptyForm(demo)); setMode(demo ? "example" : "manual"); setMonitoringApplyError(null); setResult(null); setOutdated(false); setEvaluationError(false); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600">{w("Reset WSD")}</button>
        </div>
      </form>
      <div className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        {evaluationError && <p role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{w("The configuration or inputs could not be evaluated. Review the supplied evidence and model source.")}</p>}
        {result ? <AssessmentResultPanel result={result} outdated={outdated} /> : <div className="rounded-3xl border border-dashed border-teal-200 bg-white p-7 text-sm leading-7 text-slate-500"><h3 className="font-bold text-slate-800">{w("No assessment yet")}</h3><p>{demo ? w("Load a synthetic observation or enter demo values. Choose Evaluate to review available evidence and missing information. Every result in this workspace is example data.") : w("Start with blank fields, or explicitly load an example. Choose Evaluate to review available evidence and missing information.")}</p><p className="mt-3">{w("The inherited WSD source has overlapping pH and grade boundaries. These will remain visible until the parameters are reviewed.")}</p></div>}
      </div>
    </div>
    <AiAssessmentPanel sampleAllowed={!demo && mode === "example" && Object.keys(context).length === 0 && JSON.stringify(input) === JSON.stringify(WSD_WORKBENCH_EXAMPLE)} request={aiRequest} active={aiActive && Boolean(config)} revision={aiRevision} />
  </section>;
}
