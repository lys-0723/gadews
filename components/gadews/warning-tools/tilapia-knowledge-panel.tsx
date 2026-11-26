"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import { useState } from "react";
import { useLocale } from "@/components/gadews/locale-provider";
import { rulePresentation } from "@/lib/gadews/i18n/workbench-evidence";
import { OriginalSource } from "./original-source";
import type { KnowledgeResource } from "@/lib/gadews/tilapia-types";

function display(value: unknown): string { return value === null ? "null" : typeof value === "object" ? JSON.stringify(value) : String(value); }
function safeLink(value: string | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" ? url.href : null; } catch { return null; }
}
export function TilapiaKnowledgePanel({ knowledge }: { knowledge: KnowledgeResource }) {
  const w = useWorkbenchText();
  const { locale } = useLocale();
  const [openSheets, setOpenSheets] = useState<Record<string, boolean>>({});
  const supported = knowledge.rules.filter((rule) => rule.executionSupport === "deterministic").length;
  return <section aria-label={w("Tilapia knowledge")} className="min-w-0 rounded-3xl border border-teal-100 bg-white p-5 sm:p-7">
    <h3 className="text-lg font-bold">{w("Knowledge and sources")}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-600">{knowledge.rules.length}{" "}{w("draft rules ·")}{" "}{supported}{" "}{w("supported ·")}{" "}{knowledge.rules.length - supported}{" "}{w("unsupported. All rules remain disabled. Candidate parameters are unsigned and are not adopted automatically.")}</p>
    <p className="mt-2 break-all text-xs leading-6 text-slate-500">{knowledge.resourceId}{" "}{w("· schema")}{" "}{knowledge.schemaVersion}<br />{w("Workbook:")}{" "}{knowledge.source.workbookName}<br />SHA-256: {knowledge.source.sha256}</p>
    <details className="mt-5 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-teal-800">{w("Registered rules (")}{knowledge.rules.length})</summary><ul className="mt-4 space-y-3">{knowledge.rules.map((rule) => <li key={rule.id} className="break-words rounded-xl bg-slate-50 p-3 text-xs leading-6"><p className="font-semibold">{rule.id} · {rulePresentation(locale, rule.id, rule.name, rule.logic, "tilapia").label}</p><p>{w(rule.executionSupport)} · {w(rule.enablement)}</p><p>{rulePresentation(locale, rule.id, rule.name, rule.logic, "tilapia").explanation}</p>{locale === "en" && <OriginalSource text={`${rule.name}\n${rule.logic}`} language="zh-CN" />}<p className="break-all">{w("Evidence:")}{" "}{rule.evidenceIds.join(", ") || w("None")}{" "}{w("· Sources:")}{" "}{rule.sourceIds.join(", ") || w("None")}{" "}{w("· Parameters:")}{" "}{rule.parameterIds.join(", ") || w("None")}</p><p>{rule.sourceRefs.map((ref) => `${ref.sheet}, ${w("row")} ${ref.row}`).join(" · ")}</p></li>)}</ul></details>
    <details className="mt-3 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-teal-800">{w("Candidate parameter register (")}{knowledge.parameters.length})</summary><ul className="mt-3 space-y-3">{knowledge.parameters.map((parameter) => <li key={parameter.id} className="break-words rounded-xl bg-slate-50 p-3 text-xs leading-6"><p className="font-semibold">{parameter.id}</p><p>{w("Candidate:")}{" "}{display(parameter.candidateValue)}{" "}{w("· Duration hours:")}{" "}{display(parameter.candidateDurationHours)}</p><p>{w("Adopted:")}{" "}{display(parameter.adoptedValue)}{" "}{w("· Signed by:")}{" "}{parameter.signedBy ?? w("Unsigned")}{" "}{w("· Signed at:")}{" "}{parameter.signedAt ?? w("Unsigned")}</p><p>{parameter.sourceRefs.map((ref) => `${ref.sheet}, ${w("row")} ${ref.row}`).join(" · ")}</p></li>)}</ul></details>
    <details className="mt-3 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-teal-800">{w("Original workbook rows, evidence and sources")}</summary><p className="mt-3 text-xs leading-6 text-slate-500">{w("Original source text")} · {w("Original wording and every cell are preserved below. Expand a worksheet to inspect its row numbers and links.")}</p><div className="mt-3 space-y-3">{knowledge.tables.map((table) => <details key={table.name} onToggle={(event) => { const open = event.currentTarget.open; setOpenSheets((current) => current[table.name] === open ? current : { ...current, [table.name]: open }); }} className="min-w-0 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer break-words text-xs font-semibold text-teal-800">{table.name} ({table.rows.length}{" "}{w("rows)")}</summary>{openSheets[table.name] && <div className="mt-3 space-y-3">{table.rows.map((row) => <article key={row.row} className="min-w-0 rounded-xl bg-slate-50 p-3"><h4 className="text-xs font-bold">{table.name}{" "}{w("· row")}{" "}{row.row}</h4><dl className="mt-2 space-y-2 text-xs leading-6">{Object.entries(row.cells).map(([column, value]) => {
      const href = safeLink(row.hyperlinks[column]);
      return <div key={column} className="min-w-0"><dt className="font-semibold text-slate-500">{table.headers[column.replace(/\d+$/, "")] ?? column} · {column}</dt><dd className="break-words [overflow-wrap:anywhere]">{href ? <a href={href} target="_blank" rel="noreferrer noopener" className="text-teal-800 underline underline-offset-2">{display(value)}</a> : display(value)}</dd>{row.hyperlinks[column] && <dd className="break-all text-slate-500">{w("Link:")}{" "}{row.hyperlinks[column]}</dd>}</div>;
    })}</dl></article>)}</div>}</details>)}</div></details>
  </section>;
}
