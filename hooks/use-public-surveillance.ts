"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { publicSurveillanceStore } from "@/lib/gadews/public-surveillance-loader";
import type { PublicSource } from "@/lib/gadews/public-surveillance";

export const PublicSurveillanceContext = createContext(publicSurveillanceStore);

export function usePublicSurveillance<S extends PublicSource>(source: S, enabled: boolean) {
  const store = useContext(PublicSurveillanceContext);
  const subscribe = useCallback((notify: () => void) => enabled ? store.subscribe(source, notify) : () => {}, [store, source, enabled]);
  const getSnapshot = useCallback(() => enabled ? store.getSnapshot(source) : store.getServerSnapshot(source), [store, source, enabled]);
  const getServerSnapshot = useCallback(() => store.getServerSnapshot(source), [store, source]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const retry = useCallback(() => store.retry(source), [store, source]);
  return { ...snapshot, retry };
}
