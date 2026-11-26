"use client";

import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import Link from "next/link";
import { ArrowRight, Globe2, MapPinned } from "lucide-react";

type GlobeMarker = {
  location: [number, number];
  size: number;
  label: string;
  region: string;
};

const globeMarkers: GlobeMarker[] = [
  { location: [13.75, 100.5], size: 0.07, label: "Shrimp disease signals", region: "Southeast Asia" },
  { location: [23.13, 113.26], size: 0.06, label: "Aquaculture health reports", region: "East Asia" },
  { location: [16.51, 80.64], size: 0.055, label: "Regional surveillance signal", region: "South Asia" },
  { location: [41.9, 12.5], size: 0.05, label: "Technical coordination", region: "Mediterranean / Europe" },
  { location: [6.52, 3.38], size: 0.05, label: "Environmental pressure watch", region: "Africa" },
  { location: [-2.17, -79.9], size: 0.06, label: "Shrimp production risk context", region: "Latin America" },
];

export function EwsGlobeSection() {
  const [activeMarker, setActiveMarker] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveMarker((index) => (index + 1) % globeMarkers.length);
    }, 2600);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section id="ews" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-[88rem] px-4 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-teal-700">
              Early Warning Concept
            </p>
            <h2 className="text-balance text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              What is an aquatic disease early warning system?
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">
              An aquatic disease early warning system (EWS) is a decision-support
              framework that connects disease events, environmental signals,
              surveillance data, and expert knowledge to help detect emerging
              risks earlier and support timely response.
            </p>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              GADEWS uses this concept to connect public disease intelligence,
              environmental context, knowledge rules, and warning tools into a
              practical platform for aquaculture biosecurity.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/why-gadews-matters"
                className="inline-flex items-center justify-center rounded-full bg-teal-700 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-teal-700/20 transition hover:bg-teal-800"
              >
                Why GADEWS Matters
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/#global-risk-map"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-teal-300 hover:text-teal-800"
              >
                Explore Map
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.25rem] border border-teal-100 bg-gradient-to-br from-[#f4fbfa] via-white to-cyan-50 p-5 shadow-2xl shadow-teal-950/12 sm:p-8 lg:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
            <div className="absolute -bottom-28 left-12 h-72 w-72 rounded-full bg-teal-200/30 blur-3xl" />
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
                  Global Signal View
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Demo disease-event markers for future global aquatic health intelligence.
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                <Globe2 className="h-5 w-5" />
              </div>
            </div>
            <InteractiveGlobe />
            <div className="relative mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {globeMarkers.map((marker, index) => (
                <button
                  type="button"
                  key={marker.region}
                  onMouseEnter={() => setActiveMarker(index)}
                  onFocus={() => setActiveMarker(index)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm shadow-sm transition ${
                    activeMarker === index
                      ? "border-teal-300 bg-white text-slate-950 shadow-teal-950/10"
                      : "border-white bg-white/75 text-slate-700 hover:border-teal-200 hover:bg-white"
                  }`}
                >
                  <p className="flex items-center gap-2 font-bold">
                    <MapPinned className="h-3.5 w-3.5 text-teal-700" />
                    {marker.region}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{marker.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InteractiveGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerMovement = useRef(0);
  const r = useRef(0);

  useEffect(() => {
    let phi = 0;
    let width = 0;

    const onResize = () => {
      if (canvasRef.current) width = canvasRef.current.offsetWidth;
    };

    window.addEventListener("resize", onResize);
    onResize();

    if (!canvasRef.current) return undefined;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.28,
      dark: 0,
      diffuse: 1.35,
      mapSamples: 22000,
      mapBrightness: 2.45,
      baseColor: [0.62, 0.88, 0.86],
      markerColor: [0.0, 0.72, 0.68],
      glowColor: [0.76, 0.96, 0.93],
      markers: globeMarkers.map((marker) => ({
        location: marker.location,
        size: marker.size,
      })),
      onRender: (state) => {
        if (!pointerInteracting.current) phi += 0.0035;
        state.phi = phi + r.current;
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[680px]">
      <div className="absolute inset-4 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="absolute inset-16 rounded-full border border-white/70" />
      <canvas
        ref={canvasRef}
        className="relative h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(event) => {
          pointerInteracting.current = event.clientX - pointerMovement.current;
          canvasRef.current?.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          pointerInteracting.current = null;
          canvasRef.current?.releasePointerCapture(event.pointerId);
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
        }}
        onPointerMove={(event) => {
          if (pointerInteracting.current !== null) {
            const delta = event.clientX - pointerInteracting.current;
            pointerMovement.current = delta;
            r.current = delta / 220;
          }
        }}
        aria-label="Interactive rotating globe with demo disease-event markers"
        role="img"
      />
    </div>
  );
}
