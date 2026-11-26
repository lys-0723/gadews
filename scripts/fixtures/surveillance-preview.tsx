"use client";

import { useState } from "react";
import { MapCanvas } from "@/components/gadews/risk-map/map-canvas";
import { PublicSnapshotStatus } from "@/components/gadews/risk-map/public-source-status";
import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import type { DiseaseFilter, LayerStats, QaadStatusFilter } from "@/lib/gadews/public-surveillance";

function Consumer({ enabled }: { enabled: boolean }) {
  return <output data-consumer-count>{usePublicSurveillance("wahis", enabled).records.length}</output>;
}
export default function SurveillancePreview() {
  const [wahis, setWahis] = useState(false); const [qaad, setQaad] = useState(false);
  const [consumer, setConsumer] = useState(false); const [disease, setDisease] = useState<DiseaseFilter>("all"); const [status, setStatus] = useState<QaadStatusFilter>("priority");
  const empty: LayerStats = { recordsDisplayed: 0, countriesCovered: 0, countries: [], topDisease: "--" };
  const [w, setW] = useState(empty); const [q, setQ] = useState(empty);
  return <main className="bg-white p-3 text-slate-950" data-fixture-ready>
    <div className="flex flex-wrap gap-2 [&_button]:rounded [&_button]:border [&_button]:p-2">
      <button aria-label={wahis ? "Disable WAHIS" : "Enable WAHIS"} onClick={() => setWahis(!wahis)}>WAHIS</button>
      <button aria-label={qaad ? "Disable QAAD" : "Enable QAAD"} onClick={() => setQaad(!qaad)}>QAAD</button>
      <button aria-label="Add WAHIS consumer" onClick={() => setConsumer(true)}>Add consumer</button>
      <button aria-label="Show WSD only" onClick={() => setDisease("WSD")}>WSD</button>
      <button aria-label="Show all QAAD statuses" onClick={() => setStatus("all")}>All statuses</button>
    </div>
    <div className="my-3 flex flex-wrap gap-4"><PublicSnapshotStatus source="wahis" enabled={wahis} /><PublicSnapshotStatus source="qaad" enabled={qaad} /></div>
    <p>WAHIS shown: <output data-wahis-count>{w.recordsDisplayed}</output> · QAAD shown: <output data-qaad-count>{q.recordsDisplayed}</output> · Consumer: <Consumer enabled={consumer} /></p>
    <div className="relative mt-3 h-[450px]"><MapCanvas showWahis={wahis} showQaad={qaad} diseaseFilter={disease} qaadStatusFilter={status} onWahisStatsChange={setW} onQaadStatsChange={setQ} /></div>
  </main>;
}
