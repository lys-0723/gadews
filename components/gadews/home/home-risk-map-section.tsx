"use client";

import { MapCanvas } from "@/components/gadews/risk-map/map-canvas";
import { RecentSnapshotEvents } from "./recent-snapshot-events";

export function HomeRiskMapSection() {
  return (
    <section id="global-risk-map" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-[92rem] px-4 lg:px-8">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.9fr_1fr] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-teal-700">
              Global disease monitoring
            </p>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Global Risk Map
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Monitor disease-related events, surveillance signals, and regional
              risk patterns through an integrated map-based view.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Public reports", "WOAH WAHIS"],
              ["Surveillance", "NACA QAAD"],
              ["Basemap", "OpenStreetMap"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.45fr)]">
          <div className="relative min-h-[620px] rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-950/10 lg:min-h-[70vh]">
            <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
              <MapCanvas
                showCases={false}
                showHeatmap={false}
                showWahis
                showQaad
                diseaseFilter="all"
                qaadStatusFilter="priority"
              />
            </div>
            <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-2xl bg-white/90 px-4 py-3 shadow-lg shadow-slate-950/10 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
                Country-level visualization
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Public reports and regional surveillance overlays
              </p>
            </div>
            <style jsx global>{`
              #global-risk-map .leaflet-popup-pane {
                z-index: 700;
              }
              #global-risk-map .leaflet-popup-content-wrapper {
                border-radius: 18px;
                box-shadow: 0 22px 55px rgba(15, 23, 42, 0.22);
              }
              #global-risk-map .leaflet-popup-content {
                margin: 14px;
                max-height: 360px;
                overflow-y: auto;
                overflow-x: hidden;
              }
            `}</style>
          </div>

          <RecentSnapshotEvents />
        </div>
      </div>
    </section>
  );
}
