"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./real-map";
import { useCopy } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";

function MapLoading() { const c = useCopy(mapCopy); return <div role="status" className="flex h-full items-center justify-center bg-slate-100 p-6 text-lg text-slate-800">{c("loadingMap")}</div>; }
const RealMap = dynamic(() => import("./real-map"), { ssr: false, loading: MapLoading });
export function MapCanvas(props: MapProps) { return <div className="absolute inset-0 z-0 bg-slate-100"><RealMap {...props} /></div>; }
