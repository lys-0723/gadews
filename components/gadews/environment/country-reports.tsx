"use client";
import { useState } from "react";
import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import { useLocale } from "../locale-provider";
import type { Site } from "@/lib/gadews/environment/snapshot";

import { siteCountries } from "@/lib/gadews/environment/site-countries";

export function CountryReports({ site }: { site: Site }) {
  const { t } = useLocale(),
    [open, setOpen] = useState(false);
  const wahis = usePublicSurveillance("wahis", open),
    qaad = usePublicSurveillance("qaad", open);
  const [zh, country] = siteCountries[site];
  return (
    <details className="mt-4 border-t border-slate-200 pt-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">
        {t("对照历史报告", "Compare historical reports")} · {t(zh, country)}
      </summary>
      {open && (
        <>
          <p className="mt-2 text-sm">
            {t(
              "以下按国家和原报告期统计。与环境图层同屏只提供复核线索，零条也不能推断无疫。",
              "Counts are by country and original reporting period. Co-display supports review. Zero records cannot establish absence.",
            )}
          </p>
          {(
            [
              ["WAHIS", wahis, wahis.records.filter((r) => r.country === country).length],
              ["QAAD", qaad, qaad.records.filter((r) => r.country_or_territory === country).length],
            ] as const
          ).map(([name, s, n]) => (
            <p key={name} className="mt-1 text-sm">
              {name} ·{" "}
              {s.state === "success" || s.state === "empty" ? (
                <>
                  {n}{" "}
                  {name === "WAHIS"
                    ? t("条历史报告", "historical reports")
                    : t("条监测期记录", "surveillance records")}{" "}
                  · {s.metadata?.coverage.from} — {s.metadata?.coverage.to}
                </>
              ) : s.state === "error" ? (
                <button className="underline" onClick={s.retry}>
                  {t("资料未取得，重试", "Unavailable · retry")}
                </button>
              ) : (
                t("读取中…", "Loading…")
              )}
            </p>
          ))}
        </>
      )}
    </details>
  );
}
