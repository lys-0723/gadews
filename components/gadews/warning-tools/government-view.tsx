"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Microscope,
  RadioTower,
} from "lucide-react";

const REGIONAL_ROWS = [
  {
    region: "Mekong Delta",
    trigger: "Salinity crash + WSSV signal",
    risk: "Critical",
    action: "Intensify sampling and restrict water exchange",
    evidence: "PCR pending",
  },
  {
    region: "Guangdong",
    trigger: "Temperature fluctuation",
    risk: "Watch",
    action: "Increase pond inspection",
    evidence: "Environmental signal",
  },
  {
    region: "East Java",
    trigger: "WSSV report signal",
    risk: "High",
    action: "Verify with laboratory testing",
    evidence: "Public report",
  },
  {
    region: "Guayaquil",
    trigger: "pH anomaly",
    risk: "Moderate",
    action: "Water quality stabilization",
    evidence: "Environmental signal",
  },
  {
    region: "Tamil Nadu",
    trigger: "No major signal",
    risk: "Low",
    action: "Routine monitoring",
    evidence: "Normal",
  },
];

const REGIONAL_ACTIONS = [
  "Intensify sampling in high-risk zones",
  "Notify local laboratories for confirmatory testing",
  "Recommend temporary restriction of water exchange in affected areas",
  "Review recent public disease reports and QAAD/WAHIS signals",
  "Coordinate expert review if pathogen evidence is positive",
];

export function GovernmentView() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <RadioTower className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Regional Risk Summary
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Regional-level risk status across monitored areas and public
                report signals.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            1 critical region
          </span>
        </div>

        <div className="hidden rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid lg:grid-cols-[1.1fr_1.45fr_0.75fr_1.55fr_1fr] lg:gap-4">
          <span>Region</span>
          <span>Main trigger</span>
          <span>Risk</span>
          <span>Suggested action</span>
          <span>Evidence</span>
        </div>
        <div className="mt-3 space-y-3">
          {REGIONAL_ROWS.map((row) => (
            <article
              key={row.region}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-950/5 lg:grid-cols-[1.1fr_1.45fr_0.75fr_1.55fr_1fr] lg:items-center"
            >
              <div>
                <p className="text-sm font-black text-slate-950">{row.region}</p>
                <p className="mt-1 text-xs text-slate-500 lg:hidden">{row.trigger}</p>
              </div>
              <p className="hidden text-sm text-slate-600 lg:block">{row.trigger}</p>
              <RiskBadge level={row.risk} />
              <p className="text-sm leading-6 text-slate-700">{row.action}</p>
              <p className="text-xs font-semibold text-slate-500">{row.evidence}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Regional Risk Assessment
              </h3>
              <p className="text-sm text-slate-600">Weekly regional risk brief</p>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <InfoRow label="Coverage" value="Selected regions / monitored countries" />
            <InfoRow label="Data layers" value="Public reports, environmental signals, knowledge rules" />
            <InfoRow label="Status" value="Draft generated / ready for review" />
          </div>
          <button className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/15 transition hover:bg-teal-800">
            <ClipboardList className="mr-2 h-4 w-4" />
            Generate Risk Brief
          </button>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
              <Microscope className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-950">
              Recommended Regional Actions
            </h3>
          </div>
          <ul className="space-y-3">
            {REGIONAL_ACTIONS.map((action) => (
              <li key={action} className="flex gap-3 text-sm leading-6 text-slate-700">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-700" />
                {action}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-base font-black">Evidence and uncertainty</h3>
          </div>
          <p className="text-sm leading-7 text-slate-700">
            Risk outputs combine environmental triggers, public disease
            information, knowledge rules, and user-submitted observations. They
            should support prioritization and expert review, not replace official
            diagnosis or reporting procedures.
          </p>
        </section>
      </aside>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const classes =
    level === "Critical"
      ? "border-red-200 bg-red-50 text-red-700"
      : level === "High"
      ? "border-orange-200 bg-orange-50 text-orange-700"
      : level === "Watch" || level === "Moderate"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${classes}`}>
      {level}
    </span>
  );
}
