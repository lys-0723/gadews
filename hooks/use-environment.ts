"use client";
import { useEffect, useState } from "react";
import type { Delivery } from "@/lib/gadews/environment/snapshot";
export function useEnvironment() {
  const [data, setData] = useState<Delivery | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const r = await fetch("/api/environment", { signal: ctrl.signal });
        if (!r.ok) throw new Error("environment");
        const next: Delivery = await r.json();
        if (next.snapshot.schemaVersion !== 1 || !Array.isArray(next.snapshot.feeds))
          throw new Error("snapshot");
        if (!ctrl.signal.aborted) {
          setData(next);
          setError(false);
        }
      } catch {
        if (!ctrl.signal.aborted) setError(true);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 600000);
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, [attempt]);
  return { data, error, retry: () => setAttempt((n) => n + 1) };
}
