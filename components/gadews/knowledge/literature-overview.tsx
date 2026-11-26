"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { knowledgeCollections, literatureCopy, type LiteratureItem } from "@/lib/gadews/i18n/knowledge";
import { LiteratureLoadState, useLiterature } from "./literature-repository";

function CollectionCard({ id, items }: { id: "wssv" | "streptococcosis"; items: LiteratureItem[] }) {
  const collection = knowledgeCollections.find(item => item.id === id)!; const { t } = useLocale(); const c = useCopy(literatureCopy);
  const latest = [...items].sort((a, b) => b.Pub_Year - a.Pub_Year).slice(0, 3);
  return <article className="flex min-w-0 flex-col rounded-3xl border border-slate-300 bg-white p-6 shadow-sm sm:p-8">
    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf3f5] text-[#14556c]"><BookOpen className="h-6 w-6" /></div>
    <p className="text-sm font-medium text-[#14556c]">{t(collection.sublabel[0], collection.sublabel[1])}</p><h3 className="mt-2 text-2xl font-semibold text-slate-950">{t(collection.label[0], collection.label[1])}</h3><p className="mt-4 text-[17px] leading-7 text-slate-700">{t(collection.description[0], collection.description[1])}</p>
    <div className="my-6 flex flex-wrap gap-6 border-y border-slate-200 py-5"><p className="text-sm text-slate-700"><strong className="mr-2 font-mono text-3xl font-semibold text-[#103d50]">{items.length}</strong>{c("papers")}</p><p className="text-sm text-slate-700"><strong className="mr-2 font-mono text-3xl font-semibold text-[#103d50]">{new Set(items.map(item => item.Category)).size}</strong>{c("categories")}</p></div>
    <p className="mb-3 text-sm font-semibold text-slate-700">{c("recent")}</p><ul className="mb-7 space-y-4">{latest.map(paper => <li key={paper.file_name} className="flex items-start gap-3"><span className="pt-0.5 font-mono text-sm text-[#14556c]">{paper.Pub_Year}</span><span className="text-base leading-7 text-slate-800">{paper.Title}</span></li>)}</ul>
    <Link href={`/knowledge-bank/literature?collection=${id}`} className="mt-auto inline-flex min-h-12 items-center justify-between gap-4 rounded-full bg-[#103d50] px-5 py-3 text-base font-semibold text-white hover:bg-[#18556d]">{c("browse")}<ArrowRight className="h-5 w-5 shrink-0" /></Link>
  </article>;
}

export function LiteratureOverview() {
  const { data, status, retry } = useLiterature(); const c = useCopy(literatureCopy);
  return <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><h2 className="mb-8 max-w-3xl text-3xl font-semibold tracking-tight text-[#153d4c] sm:text-4xl">{c("collectionTitle")}</h2>
    <LiteratureLoadState status={status} retry={retry} />
    {status === "ready" && <div className="grid gap-6 lg:grid-cols-2">{knowledgeCollections.map(collection => <CollectionCard key={collection.id} id={collection.id} items={data.filter(item => item.collection === collection.id)} />)}</div>}
    <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-slate-300 bg-white p-6 sm:flex-row sm:items-center"><div><p className="text-base font-semibold text-[#153d4c]">{c("original")}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{c("originalNote")}</p></div><Link href="/knowledge-bank/literature" className="inline-flex shrink-0 items-center gap-2 text-base font-semibold text-[#14556c] underline underline-offset-4">{c("enter")}<ArrowRight className="h-5 w-5" /></Link></div>
  </section>;
}
