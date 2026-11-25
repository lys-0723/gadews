"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import "@/components/gadews/warning-tools/workbench.css";
import Link from "next/link";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { WarningWorkbench } from "@/components/gadews/warning-tools/warning-workbench";
import { Info, ShieldCheck } from "lucide-react";

export default function WarningToolsPage() {
  const w = useWorkbenchText();
  return <main className="warning-workbench relative min-h-screen">
    <StickyHeader />
    <section className="workbench-intro"><div className="mx-auto max-w-7xl px-4 lg:px-8">
      <Link href="/" className="text-sm font-semibold text-teal-700 hover:text-teal-900">{w("GADEWS Home")}</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end"><div><h1 className="text-balance text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{w("Warning Tools")}</h1></div><div><p className="text-base leading-8 text-slate-600 sm:text-lg">{w("Review evidence for WSD and tilapia streptococcosis, inspect missing information, and save the current assessment on your device.")}</p><div className="intro-note mt-5 flex gap-3 rounded-3xl border border-teal-100 bg-white/80 p-4 text-sm leading-6 text-slate-600 shadow-sm"><Info className="mt-1 h-4 w-4 shrink-0 text-teal-700" /><p>{w("These tools support risk interpretation and action planning. They do not replace laboratory confirmation or official reporting procedures.")}</p></div></div></div>
    </div></section>
    <section className="pb-20 pt-8 sm:pt-10"><div className="mx-auto max-w-7xl px-4 lg:px-8"><WarningWorkbench /></div></section>
    <section className="border-t border-teal-100 bg-white py-8"><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 text-sm text-slate-500 lg:px-8"><ShieldCheck className="h-4 w-4 shrink-0 text-teal-700" /><p>{w("Model outputs support early warning and prioritization. No calibrated prediction service is configured.")}</p></div></section>
  </main>;
}
