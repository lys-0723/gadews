"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import type { ReactNode } from "react";
import type { LaboratoryDraft, ObservationDraft, TilapiaFormState } from "./tilapia-form";
import { createTilapiaLabRow } from "./tilapia-form";

const controlClass = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";
function TextField({ id, label, value, onChange, placeholder, numeric = false }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; numeric?: boolean }) {
  const w = useWorkbenchText();
  return <label htmlFor={id} className="block min-w-0 text-xs font-semibold text-slate-700">{w(label)}<input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ? w(placeholder) : undefined} inputMode={numeric ? "decimal" : undefined} autoComplete="off" className={controlClass} /></label>;
}
function Choice<T extends string>({ id, label, value, onChange, options }: { id: string; label: string; value: T; onChange: (value: T) => void; options: readonly (readonly [T, string])[] }) {
  const w = useWorkbenchText();
  return <label htmlFor={id} className="block min-w-0 text-xs font-semibold text-slate-700">{w(label)}<select id={id} value={value} onChange={(event) => onChange(event.target.value as T)} className={controlClass}>{options.map(([key, name]) => <option key={key} value={key}>{w(name)}</option>)}</select></label>;
}
const truths = [["unknown", "Unknown / not recorded"], ["yes", "Yes"], ["no", "No"]] as const;
function Group({ title, children }: { title: string; children: ReactNode }) {
  const w = useWorkbenchText();
  return <fieldset className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5"><legend className="px-2 text-sm font-bold text-teal-900">{w(title)}</legend><div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div></fieldset>;
}
function Metadata({ prefix, draft, onChange }: { prefix: string; draft: ObservationDraft; onChange: (patch: Partial<ObservationDraft>) => void }) {
  const w = useWorkbenchText();
  return <>
    <TextField id={`tilapia-${prefix}-observedAt`} label={w("Observation time")} value={draft.observedAt} onChange={(observedAt) => onChange({ observedAt })} placeholder="2026-10-28T11:00:00Z" />
    <TextField id={`tilapia-${prefix}-receivedAt`} label={w("Received time (optional)")} value={draft.receivedAt} onChange={(receivedAt) => onChange({ receivedAt })} placeholder={w("ISO time including timezone")} />
    <TextField id={`tilapia-${prefix}-sourceRef`} label={w("Observation source / record reference")} value={draft.sourceRef} onChange={(sourceRef) => onChange({ sourceRef })} />
    <Choice id={`tilapia-${prefix}-quality`} label={w("Observation quality")} value={draft.quality} onChange={(quality) => onChange({ quality })} options={[["", "Not established"], ["valid", "Valid"], ["missing", "Missing"], ["invalid", "Invalid"], ["stale", "Stale"]]} />
  </>;
}
export function TilapiaInputForm({ state, onChange, nextLabId }: { state: TilapiaFormState; onChange: (state: TilapiaFormState) => void; nextLabId: () => string }) {
  const w = useWorkbenchText();
  const group = <K extends "waterTemperature" | "dissolvedOxygen" | "clinical" | "mortality">(key: K, patch: Partial<TilapiaFormState[K]>) => onChange({ ...state, [key]: { ...state[key], ...patch } });
  const lab = (id: string, patch: Partial<LaboratoryDraft>) => onChange({ ...state, laboratory: state.laboratory.map((row) => row.id === id ? { ...row, ...patch } : row) });
  return <div className="min-w-0 space-y-5">
    <p className="text-xs leading-6 text-slate-500">{w("Times must include a timezone, for example 2026-10-28T11:00:00Z. Leave absent observations blank. Each group keeps its own time, source and quality.")}</p>
    <Group title={w("Scope and assessment window")}>
      {(["siteId", "unitId", "batchId"] as const).map((key) => <TextField key={key} id={`tilapia-${key}`} label={w({ siteId: "Site ID", unitId: "Unit / pond ID", batchId: "Batch ID" }[key])} value={state[key]} onChange={(value) => onChange({ ...state, [key]: value })} />)}
      <div className="text-xs text-slate-600"><p className="font-semibold">{w("Target pathogens")}</p><div className="mt-2 flex flex-wrap gap-4">{(["SAG", "SIN"] as const).map((pathogen) => <label key={pathogen} className="flex min-h-8 items-center gap-2"><input type="checkbox" checked={state.targetPathogens.includes(pathogen)} onChange={(event) => onChange({ ...state, targetPathogens: event.target.checked ? [...state.targetPathogens, pathogen] : state.targetPathogens.filter((value) => value !== pathogen) })} />{pathogen}</label>)}</div></div>
      <TextField id="tilapia-assessment-startAt" label={w("Assessment start")} value={state.assessmentWindow.startAt} onChange={(startAt) => onChange({ ...state, assessmentWindow: { ...state.assessmentWindow, startAt } })} />
      <TextField id="tilapia-assessment-endAt" label={w("Assessment end")} value={state.assessmentWindow.endAt} onChange={(endAt) => onChange({ ...state, assessmentWindow: { ...state.assessmentWindow, endAt } })} />
    </Group>
    {(["waterTemperature", "dissolvedOxygen"] as const).map((key) => <Group key={key} title={key === "waterTemperature" ? w("Water temperature") : w("Dissolved oxygen")}>
      <TextField id={`tilapia-${key}-value`} label={key === "waterTemperature" ? w("Water temperature (°C)") : w("Dissolved oxygen (mg/L)")} value={state[key].value} onChange={(value) => group(key, { value })} numeric />
      <p className="self-center text-xs leading-6 text-slate-500">{w("A single reading does not establish a continuous exposure window.")}</p>
      <Metadata prefix={key} draft={state[key]} onChange={(patch) => group(key, patch)} />
    </Group>)}
    <Group title={w("Clinical observations")}>
      <Choice id="tilapia-clinical-signsPresent" label={w("Clinical signs present")} value={state.clinical.signsPresent} onChange={(signsPresent) => group("clinical", { signsPresent })} options={truths} />
      <Choice id="tilapia-clinical-persistentAbnormality" label={w("Persistent clinical abnormality")} value={state.clinical.persistentAbnormality} onChange={(persistentAbnormality) => group("clinical", { persistentAbnormality })} options={truths} />
      <Choice id="tilapia-clinical-respiratoryDistressObserved" label={w("Respiratory distress observed")} value={state.clinical.respiratoryDistressObserved} onChange={(respiratoryDistressObserved) => group("clinical", { respiratoryDistressObserved })} options={truths} />
      <p className="self-center text-xs leading-6 text-slate-500">{w("Observed signs are separate from professional case confirmation.")}</p>
      <Metadata prefix="clinical" draft={state.clinical} onChange={(patch) => group("clinical", patch)} />
    </Group>
    <Group title={w("Mortality observations")}>
      <TextField id="tilapia-mortality-deadCount" label={w("Deaths in count window")} value={state.mortality.deadCount} onChange={(deadCount) => group("mortality", { deadCount })} numeric />
      <TextField id="tilapia-mortality-stockStartCount" label={w("Starting stock in count window")} value={state.mortality.stockStartCount} onChange={(stockStartCount) => group("mortality", { stockStartCount })} numeric />
      <TextField id="tilapia-mortality-startAt" label={w("Count window start")} value={state.mortality.startAt} onChange={(startAt) => group("mortality", { startAt })} />
      <TextField id="tilapia-mortality-endAt" label={w("Count window end")} value={state.mortality.endAt} onChange={(endAt) => group("mortality", { endAt })} />
      <Choice id="tilapia-mortality-abnormalityReported" label={w("Abnormal mortality reported")} value={state.mortality.abnormalityReported} onChange={(abnormalityReported) => group("mortality", { abnormalityReported })} options={truths} />
      <Choice id="tilapia-mortality-abnormalityPersistent" label={w("Persistent abnormal mortality")} value={state.mortality.abnormalityPersistent} onChange={(abnormalityPersistent) => group("mortality", { abnormalityPersistent })} options={truths} />
      <Metadata prefix="mortality" draft={state.mortality} onChange={(patch) => group("mortality", patch)} />
    </Group>
    <fieldset className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5"><legend className="px-2 text-sm font-bold text-teal-900">{w("Independent laboratory findings")}</legend>
      <p className="text-xs leading-6 text-slate-500">{w("Add one record for each sample, pathogen and assay. An incomplete record remains missing; no pathogen or negative result is supplied for you.")}</p>
      <div className="mt-4 space-y-5">{state.laboratory.map((row, index) => <fieldset key={row.id} className="min-w-0 rounded-2xl border border-teal-100 bg-teal-50/40 p-4"><legend className="max-w-full break-all px-2 text-xs font-semibold">{w("Finding")}{" "}{index + 1} · {row.id}</legend><div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <TextField id={`tilapia-${row.id}-sampleId`} label={w("Sample ID")} value={row.sampleId} onChange={(sampleId) => lab(row.id, { sampleId })} />
        <TextField id={`tilapia-${row.id}-assayId`} label={w("Assay ID")} value={row.assayId} onChange={(assayId) => lab(row.id, { assayId })} />
        <Choice id={`tilapia-${row.id}-pathogen`} label={w("Tested pathogen")} value={row.pathogen} onChange={(pathogen) => lab(row.id, { pathogen })} options={[["", "Not recorded"], ["SAG", "SAG"], ["SIN", "SIN"]]} />
        <Choice id={`tilapia-${row.id}-matrix`} label={w("Sample matrix")} value={row.matrix} onChange={(matrix) => lab(row.id, { matrix })} options={[["", "Not recorded"], ["fish_tissue", "Fish tissue"], ["environment", "Environment"]]} />
        <Choice id={`tilapia-${row.id}-result`} label={w("Laboratory result")} value={row.result} onChange={(result) => lab(row.id, { result })} options={[["", "Not recorded"], ["positive", "Positive"], ["negative", "Negative"], ["inconclusive", "Inconclusive"], ["invalid", "Invalid"], ["not_tested", "Not tested"]]} />
        <Choice id={`tilapia-${row.id}-controlsPassed`} label={w("Laboratory controls passed")} value={row.controlsPassed} onChange={(controlsPassed) => lab(row.id, { controlsPassed })} options={truths} />
        <Choice id={`tilapia-${row.id}-matrixValidated`} label={w("Assay validated for this matrix")} value={row.matrixValidated} onChange={(matrixValidated) => lab(row.id, { matrixValidated })} options={truths} />
        <Metadata prefix={row.id} draft={row} onChange={(patch) => lab(row.id, patch)} />
      </div><button type="button" onClick={() => onChange({ ...state, laboratory: state.laboratory.filter((value) => value.id !== row.id) })} className="mt-3 min-h-11 text-xs font-semibold text-rose-700">{w("Remove finding")}{" "}{index + 1}</button></fieldset>)}</div>
      <button type="button" onClick={() => onChange({ ...state, laboratory: [...state.laboratory, createTilapiaLabRow(nextLabId())] })} className="mt-4 min-h-11 rounded-xl border border-teal-300 px-4 text-sm font-semibold text-teal-800">{w("Add laboratory finding")}</button>
    </fieldset>
  </div>;
}
