"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { Footer } from "@/components/gadews/footer";
import { LiteratureOverview } from "@/components/gadews/knowledge/literature-overview";
import { useCopy } from "@/components/gadews/locale-provider";
import { literatureCopy } from "@/lib/gadews/i18n/knowledge";

export default function KnowledgeBankPage() {
  const c = useCopy(literatureCopy);
  return <main className="min-h-screen bg-[#eaf3f5] text-slate-950"><StickyHeader />
    <header className="bg-[#051724] text-white"><div className="mx-auto max-w-7xl px-5 pb-16 pt-32 lg:px-8"><Link className="mb-9 inline-flex min-h-10 items-center gap-2 text-sm text-[#d6edf2] hover:underline" href="/"><ArrowLeft className="h-4 w-4" />{c("home")}</Link><h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">{c("heading")}</h1><p className="mt-7 max-w-3xl text-[17px] leading-8 text-[#d6edf2] sm:text-lg">{c("intro")}</p></div></header>
    <LiteratureOverview /><Footer />
  </main>;
}
