"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import { latestWahisEvents } from "@/lib/gadews/public-surveillance";
import { useLocale } from "@/components/gadews/locale-provider";
import { PublicSourceStatus, PublicSnapshotStatus } from "@/components/gadews/risk-map/public-source-status";

export function RecentSnapshotEvents() {
  const { t } = useLocale();
  const snapshot = usePublicSurveillance("wahis", true);
  const events = latestWahisEvents(snapshot.records);
  return <aside className="recent-snapshot-events">
    <div className="list-label"><span>{t("快照中的近期事件", "Recent events in snapshot")}</span><span>WOAH WAHIS ↗</span></div>
    <p className="mb-5 mt-3 text-sm text-slate-600">{t("按有效事件开始日期排序，最多八条。", "Sorted by event start date. Up to eight records.")}</p>
    <div className="mb-5 rounded-xl border border-slate-300 bg-white p-4"><PublicSourceStatus title="WOAH WAHIS" {...snapshot} /></div>
    <div className="report-list">
      {events.map(event => <article key={`${event.event_id}-${event.sourceIndex}`} data-public-event={event.event_id} className="report-row">
        <div><p className="report-type">{event.disease_id.length <= 12 ? event.disease_id : t("其他病种", "Other diseases")} · {t("公开历史报告", "Public historical report")}</p><h3>{event.country}</h3><p className="report-source-name">{event.disease_name}</p><p><span>{t("事件开始日期", "Event start date")}</span><span>{event.event_start_date ?? t("日期不可用", "Date unavailable")}</span></p>{event.dashboard_url?.startsWith("https://wahis.woah.org/") && <a className="report-official-link" href={event.dashboard_url} target="_blank" rel="noopener noreferrer">{t("查看官方报告", "View official report")} ↗</a>}</div><ArrowUpRight className="row-arrow" aria-hidden="true" />
      </article>)}
    </div>
    <div className="mt-6 rounded-xl border border-slate-300 bg-white p-4"><PublicSnapshotStatus source="qaad" enabled /></div>
    <p className="reports-explainer">{t("公开报告点位为国家或地区中心点，不代表实际塘口暴发位置。事件开始、报告提交和资料获取日期含义不同；历史快照不等于实时疫情或模型预测。", "Public report layers represent country/territory centroids, not farm-level outbreak locations. Event, report and retrieval dates have different meanings. Historical snapshots are not real-time alerts or predictions.")}</p>
    <Link href="/risk-map" className="source-link">{t("打开完整公开报告地图", "View public reports")}<ArrowUpRight size={20} /></Link>
  </aside>;
}
