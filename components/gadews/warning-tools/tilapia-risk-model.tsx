"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import { useEffect, useMemo, useRef, useState } from "react";
import { assessTilapia, createTilapiaDraftExamplePacket } from "@/lib/gadews/tilapia-assessment";
import type { KnowledgeResource, TilapiaAssessmentContext, TilapiaAssessmentInput, TilapiaAssessmentResult } from "@/lib/gadews/tilapia-types";
import { AssessmentResultPanel } from "./assessment-result-panel";
import { createEmptyTilapiaForm, tilapiaExampleToForm, tilapiaFormIssues, tilapiaFormToInput, type TilapiaFormState } from "./tilapia-form";
import { TilapiaInputForm } from "./tilapia-input-form";
import { TilapiaKnowledgePanel } from "./tilapia-knowledge-panel";
import { TilapiaTracePanel } from "./tilapia-trace-panel";
import { AiAssessmentPanel } from "./ai-assessment-panel";
import type { AiAssessmentRequest } from "@/lib/gadews/ai-assessment/types";

export function TilapiaRiskModel({ aiActive = true, aiRevision = 0 }: { aiActive?: boolean; aiRevision?: number } = {}) {
  const w = useWorkbenchText();
  const [knowledge, setKnowledge] = useState<KnowledgeResource | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState<TilapiaFormState>(createEmptyTilapiaForm);
  const [previewContext, setPreviewContext] = useState<TilapiaAssessmentContext | null>(null);
  const [exampleInput, setExampleInput] = useState<TilapiaAssessmentInput | null>(null);
  const [exampleDerived, setExampleDerived] = useState(false);
  const [result, setResult] = useState<TilapiaAssessmentResult | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [evaluationError, setEvaluationError] = useState(false);
  const labSequence = useRef(0);
  const aiRequest = useMemo<AiAssessmentRequest>(() => ({
    diseaseId: "tilapia-streptococcosis", standardId: "tilapia-demo-score-v0.1", locale: "en",
    input: tilapiaFormToInput(form), context: { dataMode: previewContext?.dataMode ?? "manual", ...(previewContext?.now ? { now: previewContext.now } : {}), inputProvenance: { exampleDerived } },
  }), [form, previewContext, exampleDerived]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    fetch("/data/knowledge/tilapia-streptococcosis.json", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Knowledge unavailable");
      const resource: KnowledgeResource = await response.json();
      if (resource.schemaVersion !== "1.0" || !resource.resourceId || !resource.source?.workbookName || !resource.source.sha256 || !Array.isArray(resource.rules) || !Array.isArray(resource.parameters) || !Array.isArray(resource.tables)) throw new Error("Invalid knowledge resource");
      if (active) { setKnowledge(resource); setLoadError(false); }
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; controller.abort(); };
  }, [retry]);
  function update(next: TilapiaFormState) {
    setForm(next); setExampleInput(null);
    if (previewContext?.dataMode === "draft-preview") {
      setPreviewContext({ dataMode: "draft-preview", now: previewContext.now, draftPreview: previewContext.draftPreview }); setExampleDerived(true);
    }
    if (result) setOutdated(true);
  }
  function evaluate() {
    if (!knowledge) return;
    const validationIssues = tilapiaFormIssues(form);
    const inputProvenance = { formDraft: form, validationIssues };
    const context: TilapiaAssessmentContext = previewContext?.dataMode === "draft-preview" ? { ...previewContext, inputProvenance } : { dataMode: "manual", now: new Date(), inputProvenance };
    try {
      const assessed = assessTilapia(exampleInput ?? tilapiaFormToInput(form), knowledge, context);
      assessed.quality.issues.push(...validationIssues);
      if (validationIssues.length && assessed.quality.state === "complete") assessed.quality.state = "partial";
      setResult(assessed); setOutdated(false); setEvaluationError(false);
    } catch { setEvaluationError(true); setResult(null); }
  }
  function loadExample() {
    const packet = createTilapiaDraftExamplePacket();
    setForm(tilapiaExampleToForm(packet.input)); setExampleInput(packet.input); setPreviewContext(packet.context);
    setExampleDerived(false); setResult(null); setOutdated(false); setEvaluationError(false);
  }
  function reset() {
    setForm(createEmptyTilapiaForm()); setPreviewContext(null); setExampleInput(null); setExampleDerived(false);
    setResult(null); setOutdated(false); setEvaluationError(false);
  }
  return <section aria-label={w("Tilapia assessment")} className="mt-8 min-w-0 space-y-6">
    <header className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">{w("Disabled knowledge draft")}</p>
      <h2 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">{w("Tilapia streptococcosis")}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{w("Record evidence for S. agalactiae (SAG) and S. iniae (SIN). Manual entry checks the supplied information while draft rules remain disabled. An explicit example lets you inspect supported draft logic.")}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-white px-3 py-1 text-slate-600">{w("No live monitoring connection")}</span>{previewContext ? <><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{w("Draft simulation")}</span>{exampleDerived && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{w("Example derived")}</span>}</> : <span className="rounded-full bg-white px-3 py-1 text-teal-800">{w("Manual input · draft rules disabled")}</span>}</div>
      {previewContext && <p className="mt-3 text-xs leading-6 text-amber-900">{w("Synthetic example with a fixed assessment time. Editing keeps simulation mode and removes example professional confirmations.")}</p>}
    </header>
    {loadError ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{w("Tilapia knowledge could not be loaded.")}{" "}<button type="button" className="ml-2 min-h-11 font-semibold underline" onClick={() => { setLoadError(false); setRetry((value) => value + 1); }}>{w("Retry knowledge")}</button></div> : !knowledge && <p role="status" className="text-sm text-slate-500">{w("Loading tilapia knowledge…")}</p>}
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <form className="min-w-0 space-y-5" onSubmit={(event) => { event.preventDefault(); evaluate(); }}>
        <TilapiaInputForm state={form} onChange={update} nextLabId={() => `manual-lab-${++labSequence.current}`} />
        <div className="sticky bottom-3 flex flex-wrap gap-2 rounded-2xl border border-teal-100 bg-white/95 p-3 shadow-lg backdrop-blur">
          <button type="submit" disabled={!knowledge} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">{w("Evaluate tilapia")}</button>
          <button type="button" onClick={loadExample} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">{w("Load tilapia draft example")}</button>
          <button type="button" onClick={reset} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600">{w("Reset tilapia")}</button>
        </div>
      </form>
      <div className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
        {evaluationError && <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{w("These inputs or knowledge could not be evaluated. Review the supplied records and sources.")}</p>}
        {result ? <><AssessmentResultPanel result={result} outdated={outdated} /><TilapiaTracePanel result={result} /></> : <div className="rounded-3xl border border-dashed border-teal-200 bg-white p-7 text-sm leading-7 text-slate-500"><h3 className="font-bold text-slate-800">{w("No tilapia assessment yet")}</h3><p>{w("Start with the evidence you have, then choose Evaluate. No value, laboratory result or professional confirmation is assumed.")}</p><p className="mt-3">{w("The form covers basic observations and separate laboratory findings. Continuous exposure records, vaccination, regional context and professional case reviews require other evidence sources.")}</p></div>}
      </div>
    </div>
    <AiAssessmentPanel sampleAllowed={exampleInput !== null && !exampleDerived} request={aiRequest} active={aiActive && Boolean(knowledge)} revision={aiRevision} />
    {knowledge && <TilapiaKnowledgePanel knowledge={knowledge} />}
  </section>;
}
