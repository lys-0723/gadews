"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ExternalLink, FileText, LayoutGrid, List, Search, X } from "lucide-react";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { Root as Dialog, Portal as DialogPortal, Content as DialogContent, Title as DialogTitle, Description as DialogDescription } from "@radix-ui/react-dialog";
import { categoryCopy, doiLink, knowledgeCollections, literatureCategory, literatureCopy, literatureFullText, type LiteratureItem } from "@/lib/gadews/i18n/knowledge";

export function useLiterature() {
  const [data, setData] = useState<LiteratureItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [request, setRequest] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/literature.json", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("literature"); return response.json(); })
      .then((json: LiteratureItem[]) => { if (!Array.isArray(json)) throw new Error("literature"); if (!controller.signal.aborted) { setData(json); setStatus("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [request]);
  return { data, status, retry: () => { setStatus("loading"); setRequest(previous => previous + 1); } };
}

export function LiteratureLoadState({ status, retry }: { status: "loading" | "ready" | "error"; retry: () => void }) {
  const c = useCopy(literatureCopy);
  if (status === "ready") return null;
  return <div className="rounded-2xl border border-slate-300 bg-white p-8 text-center" role={status === "error" ? "alert" : "status"}>
    <p className="text-lg text-slate-700">{c(status === "loading" ? "loading" : "error")}</p>
    {status === "error" && <button className="mt-4 rounded-full bg-[#103d50] px-6 py-3 font-semibold text-white hover:bg-[#18556d]" onClick={retry}>{c("retry")}</button>}
  </div>;
}

function OriginalLabel() { const c = useCopy(literatureCopy); return <p className="text-sm font-medium text-slate-600">{c("original")}</p>; }
function AbstractText({ text }: { text: string }) {
  const c = useCopy(literatureCopy); const [expanded, setExpanded] = useState(false);
  return <div className="space-y-2">
    <p className={`text-[17px] leading-7 text-slate-700 ${expanded ? "" : "line-clamp-3"}`}>{text || c("noAbstract")}</p>
    {text && <button className="min-h-10 text-sm font-semibold text-[#14556c] underline underline-offset-4" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{c(expanded ? "collapse" : "expand")}</button>}
  </div>;
}

function PaperActions({ item }: { item: LiteratureItem }) {
  const c = useCopy(literatureCopy);
  return <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-sm font-semibold">
    {item.DOI && <a className="inline-flex min-h-10 items-center gap-2 text-[#14556c] underline underline-offset-4" href={doiLink(item.DOI)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{c("doi")}</a>}
    <a className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-[#103d50] px-4 py-2 text-white hover:bg-[#18556d]" href={literatureFullText(item)} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" />{c("fullText")}</a>
  </div>;
}

function PaperCard({ item, onOpen, list }: { item: LiteratureItem; onOpen: (item: LiteratureItem, opener: HTMLElement) => void; list: boolean }) {
  const { t } = useLocale(); const c = useCopy(literatureCopy); const category = categoryCopy(item.Category);
  return <article className={`flex min-w-0 flex-col rounded-2xl border border-slate-300 bg-white p-6 shadow-sm ${list ? "gap-3 sm:p-7" : "gap-4"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="rounded-md bg-[#eaf3f5] px-2.5 py-1 font-semibold text-[#153d4c]">{t(...category)}</span><span className="font-mono text-slate-700">{item.Pub_Year || "—"}</span></div>
    <div><OriginalLabel /><h3 className="mt-2 text-xl font-semibold leading-7 text-slate-950"><button className="max-w-full text-left [overflow-wrap:anywhere] hover:text-[#14556c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14556c]" onClick={event => onOpen(item, event.currentTarget)}>{item.Title}</button></h3></div>
    {item.Authors && <p className="break-words text-sm leading-6 text-slate-700">{item.Authors}</p>}
    <p className="flex items-start gap-2 text-sm leading-6 text-slate-700"><BookOpen className="mt-1 h-4 w-4 shrink-0 text-[#14556c]" />{item["Journal/Publisher"] || c("unknownPublisher")}</p>
    {!list && <AbstractText text={item.Abstract} />}
    <div className="mt-auto"><PaperActions item={item} /></div>
  </article>;
}

function PaperDrawer({ item, onClose, opener }: { item: LiteratureItem | null; onClose: () => void; opener: React.RefObject<HTMLElement | null> }) {
  const c = useCopy(literatureCopy); const { t, locale, setLocale } = useLocale();
  return <Dialog modal={false} open={!!item} onOpenChange={open => { if (!open) onClose(); }}><DialogPortal><DialogContent
    onInteractOutside={event => event.preventDefault()}
    className="fixed z-[1300] inset-y-0 left-auto right-0 top-0 flex h-dvh max-h-dvh w-[100dvw] max-w-2xl translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-slate-300 bg-white p-0 text-slate-950 sm:rounded-none [&>button]:hidden"
    onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}
  >{item && <>
    <nav className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-5 py-3 text-sm sm:px-7" aria-label={t("详情导航与语言", "Detail navigation and language")}><Link href="/" className="inline-flex min-h-10 items-center font-semibold text-[#14556c] underline underline-offset-4">{c("home")}</Link><div className="flex items-center gap-1"><button className="min-h-10 rounded-full px-3 font-semibold text-[#14556c] aria-pressed:bg-[#eaf3f5]" aria-pressed={locale === "zh-CN"} onClick={() => setLocale("zh-CN")}>Chinese</button><span aria-hidden="true">/</span><button className="min-h-10 rounded-full px-3 font-semibold text-[#14556c] aria-pressed:bg-[#eaf3f5]" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button></div></nav>
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-300 px-5 py-3 sm:px-7"><OriginalLabel /><button className="shrink-0 rounded-full border border-slate-300 p-3 hover:bg-slate-100" aria-label={c("close")} onClick={onClose}><X className="h-5 w-5" /></button></div>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 text-[17px] leading-7 sm:p-7">
      <div><DialogTitle className="break-words text-2xl leading-8 [overflow-wrap:anywhere]">{item.Title}</DialogTitle><DialogDescription className="mt-3 text-sm leading-6 text-slate-600">{c("originalNote")}</DialogDescription></div>
      {item.Authors && <section><h3 className="mb-2 text-sm font-semibold text-[#14556c]">{c("authors")}</h3><p className="break-words">{item.Authors}</p></section>}
      <dl className="grid gap-4 rounded-xl bg-[#eaf3f5] p-5"><div><dt className="text-sm font-semibold text-[#14556c]">{c("journal")}</dt><dd className="mt-1">{item["Journal/Publisher"] || c("unknownPublisher")}</dd></div><div className="flex flex-wrap gap-x-8 gap-y-3"><div><dt className="text-sm font-semibold text-[#14556c]">{c("year")}</dt><dd>{item.Pub_Year || "—"}</dd></div><div><dt className="text-sm font-semibold text-[#14556c]">{c("category")}</dt><dd>{t(...categoryCopy(item.Category))}</dd></div></div></dl>
      <section><h3 className="mb-3 text-sm font-semibold text-[#14556c]">{c("abstract")}</h3><p className="whitespace-pre-line break-words">{item.Abstract || c("noAbstract")}</p></section>
      {item.DOI && <p className="break-all text-sm text-slate-700">DOI: {item.DOI}</p>}
    </div><div className="shrink-0 border-t border-slate-300 px-5 pb-5 sm:px-7"><PaperActions item={item} /></div>
  </>}</DialogContent></DialogPortal></Dialog>;
}

export function LiteratureRepository({ initialCollection = "wssv" }: { initialCollection?: string }) {
  const { data, status, retry } = useLiterature(); const c = useCopy(literatureCopy); const { t } = useLocale();
  const [activeCollection, setActiveCollection] = useState(initialCollection === "streptococcosis" ? "streptococcosis" : "wssv");
  const [activeCategory, setActiveCategory] = useState("all"); const [query, setQuery] = useState(""); const [sort, setSort] = useState("year_desc"); const [view, setView] = useState("grid"); const [selected, setSelected] = useState<LiteratureItem | null>(null); const opener = useRef<HTMLElement | null>(null);
  const collectionData = useMemo(() => data.filter(item => item.collection === activeCollection), [data, activeCollection]);
  const categories = useMemo(() => Array.from(new Set(collectionData.map(item => literatureCategory(item.Category)))).filter(Boolean), [collectionData]);
  const results = useMemo(() => collectionData.filter(item => (activeCategory === "all" || literatureCategory(item.Category) === activeCategory) && (!query.trim() || [item.Title, item.Authors, item.Abstract, item["Journal/Publisher"], item.Category, ...categoryCopy(item.Category)].some(value => value?.toLowerCase().includes(query.trim().toLowerCase())))).sort((a, b) => sort === "year_desc" ? b.Pub_Year - a.Pub_Year : a.Pub_Year - b.Pub_Year), [collectionData, activeCategory, query, sort]);
  function open(item: LiteratureItem, element: HTMLElement) { opener.current = element; setSelected(item); }
  return <>
    <section className="mx-auto max-w-7xl px-5 pb-8 lg:px-8" aria-label={c("collections")}>
      <div className="grid gap-4 sm:grid-cols-2">{knowledgeCollections.map(collection => {
        const items = data.filter(item => item.collection === collection.id); const active = activeCollection === collection.id;
        return <button key={collection.id} aria-pressed={active} className={`rounded-2xl border p-5 text-left sm:p-6 ${active ? "border-[#14556c] bg-[#103d50] text-white ring-2 ring-[#9ce9d7]" : "border-slate-300 bg-white text-slate-800 hover:border-[#14556c]"}`} onClick={() => { if (!active) { setActiveCollection(collection.id); setActiveCategory("all"); setQuery(""); const url = new URL(window.location.href); url.searchParams.set("collection", collection.id); window.history.replaceState(null, "", url); } }}>
          <span className="block text-xl font-semibold">{t(collection.label[0], collection.label[1])}</span><span className={`mt-1 block text-sm ${active ? "text-[#d6edf2]" : "text-slate-600"}`}>{t(collection.sublabel[0], collection.sublabel[1])}</span><span className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm"><span className="font-mono">{status === "ready" ? items.length : "—"} {c("papers")}</span><span>{status === "ready" ? new Set(items.map(item => item.Category)).size : "—"} {c("categories")}</span></span>
        </button>;
      })}</div>
    </section>
    <section className="border-y border-slate-300 bg-white py-6" aria-label={c("search")}><div className="mx-auto max-w-7xl space-y-5 px-5 lg:px-8">
      <div className="flex flex-wrap gap-2"><button aria-pressed={activeCategory === "all"} onClick={() => setActiveCategory("all")} className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold ${activeCategory === "all" ? "border-[#103d50] bg-[#103d50] text-white" : "border-slate-300 text-slate-700 hover:bg-[#eaf3f5]"}`}>{c("all")} ({collectionData.length})</button>{categories.map(category => <button key={category} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)} className={`min-h-10 rounded-full border px-4 py-2 text-sm font-semibold ${activeCategory === category ? "border-[#103d50] bg-[#103d50] text-white" : "border-slate-300 text-slate-700 hover:bg-[#eaf3f5]"}`}>{t(...categoryCopy(category))} ({collectionData.filter(item => literatureCategory(item.Category) === category).length})</button>)}</div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end"><label className="min-w-0 flex-1"><span className="mb-2 block text-sm font-semibold text-slate-700">{c("search")}</span><span className="relative block"><Search className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-slate-600" /><input aria-label={c("search")} type="search" className="h-12 w-full rounded-lg border border-slate-400 bg-[#f5f8fa] pl-12 pr-4 text-base text-slate-950 placeholder:text-slate-600 focus:outline focus:outline-2 focus:outline-[#14556c]" placeholder={c("searchPlaceholder")} value={query} onChange={event => setQuery(event.target.value)} /></span></label>
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1"><span className="mb-2 block text-sm font-semibold text-slate-700">{c("sort")}</span><select aria-label={c("sort")} className="h-12 w-full rounded-lg border border-slate-400 bg-[#f5f8fa] px-3 text-sm text-slate-800" value={sort} onChange={event => setSort(event.target.value)}><option value="year_desc">{c("newest")}</option><option value="year_asc">{c("oldest")}</option></select></label><div className="flex rounded-lg border border-slate-400">{(["grid", "list"] as const).map(mode => <button key={mode} aria-label={c(mode)} aria-pressed={view === mode} onClick={() => setView(mode)} className={`flex h-12 w-12 items-center justify-center first:rounded-l-lg last:rounded-r-lg ${view === mode ? "bg-[#103d50] text-white" : "bg-white text-slate-700"}`}>{mode === "grid" ? <LayoutGrid className="h-5 w-5" /> : <List className="h-5 w-5" />}</button>)}</div></div></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><LiteratureLoadState status={status} retry={retry} />{status === "ready" && <><div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-base text-slate-700"><p aria-live="polite">{c("results")}: <strong className="font-mono text-[#103d50]">{results.length}</strong>{query && ` · “${query}”`}</p>{query && <button className="min-h-10 font-semibold text-[#14556c] underline underline-offset-4" onClick={() => setQuery("")}>{c("clear")}</button>}</div>
      {results.length === 0 ? <div className="rounded-2xl border border-slate-300 bg-white p-10 text-center"><p className="text-xl font-semibold">{c("empty")}</p><p className="mt-3 text-[17px] text-slate-700">{c("emptyHelp")}</p></div> : <div className={view === "grid" ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4"}>{results.map(item => <PaperCard key={`${item.collection}:${item.file_name}`} item={item} onOpen={open} list={view === "list"} />)}</div>}
    </>}</section><PaperDrawer item={selected} onClose={() => setSelected(null)} opener={opener} />
  </>;
}
