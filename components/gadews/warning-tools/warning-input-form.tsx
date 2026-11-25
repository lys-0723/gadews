"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import { WARNING_GROUPS, fieldValue, type WarningField } from "./warning-fields";

export function WarningInputForm({ fields, input, onChange, prefix = "wsd" }: { fields: WarningField[]; input: Record<string, unknown>; onChange: (key: string, value: string | number | boolean | undefined) => void; prefix?: string }) {
  const w = useWorkbenchText();
  return <div className="space-y-4">{WARNING_GROUPS.map((group) => {
    const groupFields = fields.filter((f) => f.group === group.id);
    if (!groupFields.length) return null;
    return <fieldset key={group.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><legend className="px-2 font-bold text-slate-900">{w(group.title)}</legend><p className="mb-4 text-xs leading-5 text-slate-500">{w(group.description)}</p><div className="grid gap-4 sm:grid-cols-2">{groupFields.map((field) => {
      const raw = input[field.key]; const value = typeof raw === "boolean" ? raw ? "yes" : "no" : raw === undefined || raw === null ? "" : String(raw);
      const id = `${prefix}-${field.key}`;
      return <div key={field.key} className="min-w-0"><label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">{w(field.label)}{field.unit ? ` (${field.unit})` : ""}</label>{field.type === "select" || field.type === "boolean" ? <select id={id} name={field.key} value={value} onChange={(event) => onChange(field.key, fieldValue(field, event.target.value))} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"><option value="">{w("Not recorded")}</option>{(field.type === "boolean" ? [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }, { value: "unknown", label: "Unknown" }] : field.options ?? []).map((option) => <option key={option.value} value={option.value}>{w(option.label)}</option>)}</select> : <input id={id} name={field.key} type="text" inputMode={field.type === "number" ? "decimal" : undefined} value={value} onChange={(event) => onChange(field.key, fieldValue(field, event.target.value))} placeholder={w("Not recorded")} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />}</div>;
    })}</div></fieldset>;
  })}</div>;
}
