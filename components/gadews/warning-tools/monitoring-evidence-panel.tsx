"use client";

import { useWorkbenchText } from "@/components/gadews/warning-tools/workbench-locale";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseMonitoringFeeds, parseMonitoringSnapshot, type MonitoringFeed, type MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import { publishedMonitoringSource, type MonitoringDataSource } from "@/lib/gadews/monitoring-source";

type PanelStatus = "idle" | "loading-feeds" | "ready" | "loading-observation" | "success" | "empty" | "error";
const safeErrors = ["Monitoring is not configured or is temporarily unavailable.", "Monitoring could not be loaded. Retry the request.", "Monitoring identity could not be verified. Reload the feeds."];
export function MonitoringEvidencePanel({ disease, onSnapshot, source = publishedMonitoringSource, startRequest = 0 }: { disease: "wsd" | "tilapia"; onSnapshot: (snapshot: MonitoringSnapshot | null) => void; source?: MonitoringDataSource; startRequest?: number }) {
  const w = useWorkbenchText();
  const [feeds, setFeeds] = useState<MonitoringFeed[]>([]);
  const [feedId, setFeedId] = useState("");
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [error, setError] = useState("");
  const [previewTime, setPreviewTime] = useState(0);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const catalog = useRef<MonitoringFeed[]>([]);
  const retryRequest = useRef<{ kind: "feeds" | "latest"; id: string; previewFirst: boolean }>({ kind: "feeds", id: "", previewFirst: false });
  const onSnapshotRef = useRef(onSnapshot);
  const previousSource = useRef(source);
  const handledStart = useRef(0);
  useEffect(() => { onSnapshotRef.current = onSnapshot; }, [onSnapshot]);
  const cancel = useCallback(() => { sequence.current += 1; controller.current?.abort(); }, []);
  const request = useCallback(async (kind: "feeds" | "latest", id = "", previewFirst = false) => {
    cancel(); const current = sequence.current; const abort = new AbortController(); controller.current = abort;
    retryRequest.current = { kind, id, previewFirst };
    setSnapshot(null); onSnapshotRef.current(null); setError(""); setStatus(kind === "feeds" ? "loading-feeds" : "loading-observation");
    if (kind === "feeds") { catalog.current = []; setFeeds([]); setFeedId(""); }
    try {
      let chosenId = id;
      if (kind === "feeds") {
        const loaded = await source.listFeeds(abort.signal);
        if (current !== sequence.current || abort.signal.aborted) return;
        const parsed = parseMonitoringFeeds({ schemaVersion: "1.0", feeds: loaded });
        catalog.current = parsed; setFeeds(parsed); setStatus(parsed.length ? "ready" : "empty");
        if (!previewFirst || !parsed.length) return;
        chosenId = parsed.find((feed) => feed.id === "demo-usable")?.id ?? parsed[0].id;
        setFeedId(chosenId); setStatus("loading-observation"); retryRequest.current = { kind: "latest", id: chosenId, previewFirst: false };
      }
      const loaded = await source.readLatest(chosenId, abort.signal);
      if (current !== sequence.current || abort.signal.aborted) return;
      const parsed = parseMonitoringSnapshot(loaded);
      const chosen = catalog.current.find((feed) => feed.id === chosenId);
      if (!chosen || parsed.feed.id !== chosen.id || parsed.feed.siteId !== chosen.siteId || parsed.feed.pondId !== chosen.pondId) throw new Error("Monitoring identity could not be verified. Reload the feeds.");
      setPreviewTime(Date.now()); setSnapshot(parsed); onSnapshotRef.current(parsed); setStatus(parsed.observation ? "success" : "empty");
    } catch (failure) {
      if (current !== sequence.current || abort.signal.aborted) return;
      const safe = failure instanceof Error && safeErrors.includes(failure.message) ? failure.message : "Monitoring returned invalid data. Retry the request.";
      setError(safe); setStatus("error");
    }
  }, [cancel, source]);
  useEffect(() => {
    // Source changes discard the catalog. Disease changes retain that source's catalog only.
    const sourceChanged = previousSource.current !== source;
    const explicitStart = source.kind === "demo" && startRequest > 0 && handledStart.current !== startRequest;
    previousSource.current = source;
    handledStart.current = startRequest;
    cancel(); const current = sequence.current;
    queueMicrotask(() => {
      if (current !== sequence.current) return;
      setFeedId(""); setSnapshot(null); setError(""); onSnapshotRef.current(null);
      retryRequest.current = { kind: "feeds", id: "", previewFirst: false };
      if (sourceChanged) { catalog.current = []; setFeeds([]); setStatus("idle"); }
      else setStatus(catalog.current.length ? "ready" : "idle");
      if (explicitStart) void request("feeds", "", true);
    });
    return cancel;
  }, [disease, source, startRequest, cancel, request]);
  const buttonClass = "min-h-11 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50";
  const observation = snapshot?.observation;
  const expired = observation?.observedAt ? previewTime - Date.parse(observation.observedAt) > snapshot!.feed.maxAgeHours * 3_600_000 : false;
  return <section aria-label={w("Monitoring observations")} data-monitoring-state={status} data-monitoring-source={source.kind} className="mt-6 min-w-0 space-y-4 rounded-3xl border border-teal-100 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">{w("Monitoring observations")}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{source.kind === "demo" ? w("Synthetic point observations are generated when you select or refresh a scenario. These are fictional examples, not device measurements.") : w("Read the latest published point observation on request. This does not show device availability or continuous exposure.")}</p></div><button type="button" className={buttonClass} disabled={status === "loading-feeds"} onClick={() => { void request("feeds"); }}>{source.kind === "demo" ? w("Load demo scenarios") : w("Load monitoring feeds")}</button></div>
    {disease === "tilapia" && <p className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{w("Read-only for tilapia. Point observations do not supply a batch or a temperature exposure window.")}</p>}
    {feeds.length > 0 && <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><label htmlFor="monitoring-feed" className="mb-1 block text-sm font-semibold text-slate-700">{w("Monitoring feed")}</label><select id="monitoring-feed" value={feedId} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm" onChange={(event) => { const id = event.target.value; setFeedId(id); if (id) void request("latest", id); else { cancel(); setSnapshot(null); onSnapshotRef.current(null); setError(""); setStatus("ready"); } }}><option value="">{source.kind === "demo" ? w("Choose a synthetic scenario") : w("Choose a published site / pond / device feed")}</option>{feeds.map((feed) => <option key={feed.id} value={feed.id}>{w(feed.label)} · {feed.siteId} / {feed.pondId}</option>)}</select></div><button type="button" className={buttonClass} disabled={!feedId || status === "loading-observation"} onClick={() => { void request("latest", feedId); }}>{w("Refresh observation")}</button></div>}
    {status === "idle" && <p className="text-sm text-slate-500">{w("No monitoring request has been made.")}</p>}
    {(status === "loading-feeds" || status === "loading-observation") && <p role="status" className="text-sm text-slate-500">{status === "loading-feeds" ? source.kind === "demo" ? w("Loading synthetic scenarios…") : w("Loading published feeds…") : w("Loading latest observation…")}</p>}
    {status === "error" && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{w(error)}<button type="button" className="ml-3 min-h-11 underline" onClick={() => { const retry = retryRequest.current; void request(retry.kind, retry.id, retry.previewFirst); }}>{w("Retry monitoring")}</button></div>}
    {status === "empty" && <p role="status" className="text-sm text-slate-600">{feedId ? w("No observation is available for this feed.") : source.kind === "demo" ? w("No synthetic scenarios are available.") : w("No published monitoring feeds are available.")}</p>}
    {snapshot && <div className="min-w-0 space-y-3 text-sm"><div className="break-words rounded-xl bg-teal-50 p-3 leading-6 text-teal-950"><p className="font-semibold">{w(snapshot.feed.label)}</p><p>{w("Site:")}{" "}{snapshot.feed.siteId}{" "}{w("· Pond:")}{" "}{snapshot.feed.pondId}</p>{source.kind === "demo" && <p>{w("Scenario:")}{" "}{snapshot.feed.id}{" "}{w("· Generated:")}{" "}{snapshot.fetchedAt}</p>}<p>{w("Unit verification:")}{" "}{w(snapshot.feed.unitVerificationRef ?? "Not verified — preview only")}</p><p>{w("Maximum age:")}{" "}{snapshot.feed.maxAgeHours}{" "}{w("hours · Fetched:")}{" "}{snapshot.fetchedAt}</p>{observation && <><p>{w("Observed:")}{" "}{observation.observedAt ?? w("Invalid or missing time")}{" "}{w("· Ingested:")}{" "}{observation.ingestedAt ?? w("Invalid or missing time")}</p><p>{w("Source:")}{" "}{observation.reference}</p></>}</div>
      {observation && <div className="grid gap-3 sm:grid-cols-3">{(["waterTemperatureC", "dissolvedOxygenMgL", "ph"] as const).map((key) => { const metric = observation.metrics[key]; const label = key === "waterTemperatureC" ? w("Water temperature") : key === "dissolvedOxygenMgL" ? w("Dissolved oxygen") : "pH"; const state = expired && metric.state === "usable" ? "stale" : metric.state; return <div key={key} className="min-w-0 rounded-xl border border-slate-200 p-3"><h3 className="font-semibold text-slate-700">{label}</h3><p className="mt-2 text-xl font-bold text-slate-950">{metric.value === null ? w("Not recorded") : `${metric.value} ${metric.unit}`}</p><p className="mt-1 break-words text-xs text-slate-600">{w(state)}{metric.issues.length ? ` · ${metric.issues.map(w).join(", ")}` : ""}</p></div>; })}</div>}
      <p className="text-xs leading-6 text-slate-500">{w("Standard field units are shown above. Unverified units, missing values and quality issues remain visible. Previewing does not change an assessment.")}</p>
    </div>}
  </section>;
}
