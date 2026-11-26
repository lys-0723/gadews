"use client";

import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import type { LoadState, PublicSource, SourceMetadata } from "@/lib/gadews/public-surveillance";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { mapCopy } from "@/lib/gadews/i18n/map";

interface StatusProps { title: string; state?: LoadState; metadata?: SourceMetadata; rejectedCount?: number; error?: string; retry?: () => void }
export function PublicSourceStatus({ title, state = "idle", metadata, rejectedCount = 0, error, retry }: StatusProps) {
  const c = useCopy(mapCopy);
  const { t } = useLocale();
  return <div className="space-y-1 break-words text-sm leading-6" data-public-source={title}>
    <p className="font-semibold">{title} · {c("snapshot")}</p>
    {state === "idle" && <p>{c("idle")}</p>}
    {state === "loading" && <p role="status">{t(`正在加载 ${title} 快照…`, `Loading ${title} snapshot…`)}</p>}
    {state === "empty" && <p>{c("empty")}</p>}
    {state === "error" && <div role="alert"><p>{t(`${title} 资料暂不可用，请重试。`, error ?? `${title} data unavailable.`)}</p><button type="button" aria-label={`${c("retry")} ${title}`} className="mt-1 rounded border border-current px-3 py-1 font-semibold" onClick={retry}>{c("retry")}</button></div>}
    {metadata && <><p>{c("coverage")}: {metadata.coverage.from ?? c("unknown")} – {metadata.coverage.to ?? c("unknown")}</p><p>{c("retrieved")}: {metadata.retrievedAt ?? c("unknown")}</p></>}
    {rejectedCount > 0 && <p>{t(`已跳过 ${rejectedCount} 条无效记录。`, `${rejectedCount} invalid record${rejectedCount === 1 ? "" : "s"} skipped.`)}</p>}
  </div>;
}
export function PublicSnapshotStatus({ source, enabled }: { source: PublicSource; enabled: boolean }) {
  const snapshot = usePublicSurveillance(source, enabled);
  const c = useCopy(mapCopy);
  const title = source === "wahis" ? "WOAH WAHIS" : "NACA QAAD";
  if (!enabled) return <p className="text-sm">{title} {c("hidden")}</p>;
  return <PublicSourceStatus title={title} {...snapshot} />;
}
