"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import type { AssessmentResult } from "@/lib/gadews/warning-assessment";
import { useLocale } from "@/components/gadews/locale-provider";
import { driverPresentation, generatedText, qualityPresentation } from "@/lib/gadews/i18n/workbench-evidence";
import { OriginalSource } from "./original-source";
import { serializeAssessmentReport } from "@/lib/gadews/assessment-report";
import { presentationForAssessment, type AssessmentTone } from "@/lib/gadews/assessment-presentation";

const alertStyles: Record<AssessmentTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
  low: "border-emerald-300 bg-emerald-50 text-emerald-950",
  medium: "border-amber-300 bg-amber-50 text-amber-950",
  high: "border-orange-300 bg-orange-50 text-orange-950",
  urgent: "border-red-300 bg-red-50 text-red-950",
};

export function AssessmentResultPanel({ result, outdated = false }: { result: AssessmentResult; outdated?: boolean }) {
  const w = useWorkbenchText();
  const { locale } = useLocale();
  const explain = (text: string) => generatedText(locale, text);
  const rulesDisabled = result.diseaseId === "tilapia-streptococcosis" && result.status === "draft_disabled";
  const signal = presentationForAssessment(result, outdated);
  const statusKey = result.status === "insufficient_data" ? "Insufficient data" : result.status === "partial" ? "Partial assessment" : result.status === "draft_disabled" ? "Draft rules disabled" : result.status === "draft_preview" ? "Draft preview" : result.status === "not_configured" ? "Model not configured" : "Complete assessment";
  function downloadReport() {
    if (outdated) return;
    const content = serializeAssessmentReport(result, outdated);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");
    try {
      link.href = url;
      link.download = `gadews-${result.diseaseId}-${result.assessedAt.replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  }
  return <section aria-label={w("Assessment result")} className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-7" data-assessment-status={result.status}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">{w("Assessment result")}</h3><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">{result.dataMode === "example" ? w("Example data") : result.dataMode === "draft-preview" ? w("Draft preview · not production") : w("Manual observation")}</span></div>
    <button type="button" disabled={outdated} onClick={downloadReport} className="mt-4 rounded-xl border border-teal-200 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50">{w("Download JSON")}</button>
    <div role={outdated ? "alert" : "status"} aria-label={w("Current risk signal")} data-alert-tone={signal.tone} data-alert-kind={signal.kind} className={"mt-5 rounded-2xl border-l-4 p-5 " + alertStyles[signal.tone]}>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">{w("Current risk signal")}</p>{statusKey !== signal.labelKey && <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">{w(statusKey)}</span>}</div>
      <p className="mt-2 text-2xl font-black" data-attention={result.minimumAttention}>{w(signal.labelKey)}</p>
      <p className="mt-2 text-sm leading-7">{w(signal.detailKey)}</p>
      <p className="mt-2 text-xs">{w("Screening support, not confirmation")}</p>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{w("Known evidence subtotal")}</p><p className="mt-1 text-2xl font-black" data-known-score>{result.knownScore ?? w("Not scored")}</p><p className="text-xs text-slate-500">{w("Only supported, usable evidence")}</p></div>
      <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{w("Overall grade")}</p><p className="mt-1 text-lg font-bold" data-overall-grade>{result.status === "complete" && result.level ? w(result.level.label) : w("Awaiting complete assessment")}</p><p className="text-xs text-slate-500">{result.riskIndex === null ? w("No complete risk index") : `${w("Rule index")}: ${result.riskIndex} / 100 · ${w("not a probability")}`}</p></div>
    </div>
    <div className="mt-5 rounded-2xl border border-slate-100 p-4 text-sm"><p className="font-semibold">{w("Input quality")}</p><p className="mt-1 text-slate-600">{rulesDisabled ? w("Rules not evaluated. Input checks below do not execute disabled draft rules.") : `${result.quality.observedFields.length} / ${result.quality.expectedFields.length} ${w("core fields observed")} · ${w(result.quality.state)}`}</p>
      <details className="mt-3" open={result.quality.issues.length <= 6}><summary className="cursor-pointer font-semibold text-teal-800">{rulesDisabled ? w("Input checks") : w("Quality and rule issues")} ({result.quality.issues.length})</summary><ul className="mt-2 space-y-2">{result.quality.issues.map((issue, i) => <li key={`${issue.field}-${issue.code}-${i}`} className="break-words rounded-lg bg-slate-50 p-2"><code className="text-xs">{issue.field} · {issue.code}{issue.ruleId ? ` · ${issue.ruleId}` : ""}</code><p className="mt-1 text-xs text-slate-600">{qualityPresentation(locale, issue)}</p>{qualityPresentation(locale, issue) !== issue.message && <OriginalSource text={issue.message} />}</li>)}</ul></details>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-2"><div><h4 className="font-semibold">{w("Evidence and rules")}</h4>{result.drivers.length ? <ul className="mt-2 space-y-2">{result.drivers.map((driver, i) => { const display = driverPresentation(locale, driver); return <li className="rounded-xl bg-slate-50 p-3 text-sm" key={`${driver.ruleId}-${i}`}><span className="font-semibold">{display.label}</span><span className="ml-2 text-xs text-teal-700">{driver.ruleId}{typeof driver.score === "number" ? ` · ${driver.score}` : ""}</span><p className="mt-1 text-xs text-slate-600">{display.explanation}</p>{display.explanation !== driver.explanation && <OriginalSource text={`${driver.label}\n${driver.explanation}`} language="zh-CN" />}<p className="mt-2 break-all text-xs text-slate-600">{w("Source:")}{" "} {driver.sourceRefs.join(" · ")}</p></li>; })}</ul> : <p className="mt-2 text-sm text-slate-500">{result.diseaseId === "tilapia-streptococcosis" ? rulesDisabled ? w("Draft rules were not evaluated. Review input checks and inactive rule traces below.") : w("Review the independent events and rule traces below.") : w("No supported positive driver from the current inputs.")}</p>}</div><div><h4 className="font-semibold">{w("Review and next actions")}</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">{result.actions.map((action, i) => <li key={i}>{explain(action)}</li>)}</ul></div></div>
    {result.unsupportedRules.length > 0 && <p className="mt-4 break-words text-xs text-slate-500">{w("Unsupported rules:")}{" "}{result.unsupportedRules.map(explain).join(", ")}</p>}
    <details className="mt-5 rounded-2xl bg-teal-50 p-4 text-sm text-slate-700"><summary className="cursor-pointer font-semibold">{w("Model and source")}</summary><footer className="mt-3 break-words text-sm leading-7 text-slate-600"><p>{w("Model:")}{" "}{result.model.id} · {result.model.version} · {w(result.model.state)}</p><p>{w("Source:")}{" "}{result.model.source.join(" · ")}</p><p>{w("Assessed:")}{" "}{result.assessedAt}</p>{result.model.warnings.map((warning, i) => <p key={i}>{explain(warning)}</p>)}<p>{w("Prediction:")}{" "}{w(result.prediction.state)}{w(". No calibrated probability or forecast horizon is available.")}</p></footer></details>
  </section>;
}
