"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  ExternalLink,
  ShieldCheck,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const PONDS = [
  {
    name: "Pond 1",
    temperature: "28.5°C",
    ph: "pH 7.2",
    doLevel: "DO 5.8 mg/L",
    status: "Normal",
    concern: "Stable feeding and swimming behavior",
  },
  {
    name: "Pond 2",
    temperature: "28.3°C",
    ph: "pH 7.4",
    doLevel: "DO 5.5 mg/L",
    status: "Normal",
    concern: "Routine monitoring",
  },
  {
    name: "Pond 3",
    temperature: "29.1°C",
    ph: "pH 7.0",
    doLevel: "DO declining",
    status: "Watch",
    concern: "Urgent check for oxygen and behavior",
  },
];

const PRACTICAL_ACTIONS = [
  "Increase pond inspection frequency",
  "Check feeding activity and swimming behavior",
  "Measure pH, DO, ammonia, and salinity",
  "Remove weak or dead shrimp promptly",
  "Avoid sudden water exchange during high-risk periods",
  "Collect samples for WSSV testing if symptoms appear",
];

const INITIAL_CHECKLIST = [
  { id: "c1", label: "Disinfect water inlet and outlet equipment", checked: false },
  { id: "c2", label: "Check pond net or barrier integrity", checked: false },
  { id: "c3", label: "Review seed source and test records", checked: false },
  { id: "c4", label: "Confirm no abnormal mortality", checked: false },
  { id: "c5", label: "Avoid sharing tools across ponds without disinfection", checked: false },
  { id: "c6", label: "Record daily water quality and health observations", checked: false },
];

export function FarmerView() {
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const checkedCount = checklist.filter((item) => item.checked).length;

  const toggleCheck = (id: string) => {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5 sm:p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-950">Pond Risk Snapshot</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Pond-level risk awareness for daily inspection and practical
              biosecurity guidance.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PONDS.map((pond) => (
            <article
              key={pond.name}
              className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-white hover:shadow-lg hover:shadow-teal-950/5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-slate-950">{pond.name}</h3>
                <RiskBadge level={pond.status} />
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <Metric icon={Thermometer} value={pond.temperature} />
                <Metric icon={Droplets} value={pond.ph} />
                <Metric icon={Wind} value={pond.doLevel} />
              </div>
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                {pond.concern}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-950">
              Practical Action Guidance
            </h3>
          </div>
          <ul className="space-y-3">
            {PRACTICAL_ACTIONS.map((action) => (
              <li key={action} className="flex gap-3 text-sm leading-6 text-slate-700">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-teal-700" />
                {action}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Biosecurity Checklist
                </h3>
                <p className="text-sm text-slate-600">
                  Daily self-check for pond hygiene and disease prevention.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
              {checkedCount}/{checklist.length} complete
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                  item.checked
                    ? "border-teal-200 bg-teal-50"
                    : "border-slate-200 bg-slate-50/70 hover:border-teal-200 hover:bg-white"
                }`}
              >
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleCheck(item.id)}
                  className="mt-0.5"
                />
                <span
                  className={`text-sm leading-6 ${
                    item.checked ? "text-slate-500 line-through" : "text-slate-700"
                  }`}
                >
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-6 shadow-sm shadow-teal-950/5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-950">
                Run the WSD Risk Model
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Use environmental data, pathogen testing, clinical signs,
                pathology evidence, and background information to calculate an
                initial WSD/WSSV risk level.
              </p>
            </div>
          </div>
          <a
            href="#wsd-risk-model"
            className="inline-flex items-center justify-center rounded-full bg-teal-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-teal-700/15 transition hover:bg-teal-800"
          >
            Open WSD Risk Calculator
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, value }: { icon: typeof Thermometer; value: string }) {
  return (
    <p className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-teal-700" />
      {value}
    </p>
  );
}

function RiskBadge({ level }: { level: string }) {
  const classes =
    level === "Watch"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes}`}>
      {level}
    </span>
  );
}
