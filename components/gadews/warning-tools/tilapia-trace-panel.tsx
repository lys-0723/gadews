"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import { useLocale } from "@/components/gadews/locale-provider";
import { generatedText, rulePresentation } from "@/lib/gadews/i18n/workbench-evidence";
import { OriginalSource } from "./original-source";
import type { TilapiaAssessmentResult } from "@/lib/gadews/tilapia-types";

export function TilapiaTracePanel({ result }: { result: TilapiaAssessmentResult }) {
  const w = useWorkbenchText();
  const { locale } = useLocale();
  const explain = (text: string) => generatedText(locale, text);
  return <section aria-label={w("Tilapia rule traces")} className="min-w-0 space-y-5 rounded-3xl border border-teal-100 bg-white p-5 sm:p-7">
    <div><h3 className="text-lg font-bold">{w("Independent events")}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{w("Events stay separate. They are not a diagnosis, an overall disease grade or a probability.")}</p></div>
    {result.events.length ? <ul className="space-y-3">{result.events.map((event) => <li key={event.id} data-event-type={event.type} className="break-words rounded-xl bg-teal-50 p-4 text-sm"><p className="font-semibold">{explain(event.label)}</p><p className="mt-1 text-xs text-teal-800">{w(event.type)} · {event.ruleId}{" "}{w("· Draft simulation")}{event.pathogen ? ` · ${event.pathogen}` : ""}</p><p className="mt-2 leading-6 text-slate-600">{explain(event.explanation)}</p><p className="mt-2 break-all text-xs text-slate-500">{w("Evidence:")}{" "}{event.evidenceIds.join(", ") || w("No linked observation")}{event.recordId ? ` · ${w("Record")}: ${event.recordId}` : ""}</p><p className="mt-1 text-xs text-slate-500">{event.sourceRefs.map((ref) => `${ref.sheet}, ${w("row")} ${ref.row}`).join(" · ")}</p></li>)}</ul> : <p className="text-sm text-slate-500">{w("No event was generated. Disabled rules do not establish absence of disease.")}</p>}
    <details><summary className="cursor-pointer text-sm font-bold text-teal-800">{w("Rule traces (")}{result.ruleTraces.length})</summary><ul className="mt-4 space-y-3">{result.ruleTraces.map((trace) => <li key={trace.ruleId} data-rule-id={trace.ruleId} className="break-words rounded-xl border border-slate-200 p-4 text-xs leading-6"><p className="font-semibold">{trace.ruleId} · {rulePresentation(locale, trace.ruleId, trace.name, "", "tilapia").label}</p><p className="text-teal-800">{w(trace.support)} · {w(trace.enablement)} · {w(trace.execution)} · {w(trace.state)}</p><p>{w("Truth:")}{" "}{trace.truth === null ? w("Not evaluated") : trace.truth === "unknown" ? w("UNKNOWN") : trace.truth ? w("TRUE") : w("FALSE")}</p>{locale === "en" && <OriginalSource text={trace.name} language="zh-CN" />}{trace.reasons.map((reason, i) => <p key={i} className="text-slate-600">{explain(reason)}</p>)}<p className="break-all">{w("Evidence:")}{" "}{trace.evidenceIds.join(", ") || w("None")}</p><p className="text-slate-500">{trace.sourceRefs.map((ref) => `${ref.sheet}, ${w("row")} ${ref.row}`).join(" · ")}</p></li>)}</ul></details>
  </section>;
}
