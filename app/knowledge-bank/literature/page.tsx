"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { Footer } from "@/components/gadews/footer";
import { useCopy } from "@/components/gadews/locale-provider";
import { LiteratureRepository } from "@/components/gadews/knowledge/literature-repository";
import { literatureCopy } from "@/lib/gadews/i18n/knowledge";

function LiteratureContent() {
  const params = useSearchParams(); const c = useCopy(literatureCopy);
  return <main className="min-h-screen bg-[#eaf3f5] text-slate-950">
    <StickyHeader />
    <header className="mx-auto max-w-7xl px-5 pb-10 pt-32 lg:px-8">
      <nav className="mb-8 flex flex-wrap items-center gap-3 text-sm text-slate-700" aria-label={c("bank")}><Link className="inline-flex min-h-10 items-center gap-2 hover:underline" href="/"><ArrowLeft className="h-4 w-4" />{c("home")}</Link><span aria-hidden="true">/</span><Link className="hover:underline" href="/knowledge-bank">{c("bank")}</Link></nav>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{c("repository")}</h1><p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-700 sm:text-lg">{c("intro")}</p><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{c("originalNote")}</p>
    </header>
    <LiteratureRepository initialCollection={params.get("collection") ?? "wssv"} />
    <Footer />
  </main>;
}
function LiteratureFallback() { const c = useCopy(literatureCopy); return <main className="min-h-screen bg-[#eaf3f5]"><StickyHeader /><p role="status" className="px-6 pt-36 text-lg text-slate-700">{c("loading")}</p></main>; }
export default function LiteraturePage() { return <Suspense fallback={<LiteratureFallback />}><LiteratureContent /></Suspense>; }
