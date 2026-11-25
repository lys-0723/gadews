"use client";

import { X } from "lucide-react";
import { useLocale } from "@/components/gadews/locale-provider";
import {
  REGIONAL_DEMO_SITES, getRegionalDemoSummary, type RegionalDemoGroup, type RegionalDemoRadius,
  type RegionalDemoSiteId,
} from "@/lib/gadews/regional-monitoring-demo";

export type RegionalDemoSummary = ReturnType<typeof getRegionalDemoSummary>;

export const groupLabels: Record<RegionalDemoGroup, [string, string]> = {
  same: ["同水系", "Same water system"],
  other: ["其他水系", "Other water system"],
  unknown: ["水系未知", "Unknown water system"],
};

interface RegionalDemoPanelProps {
  summary: RegionalDemoSummary;
  onSiteChange: (site: RegionalDemoSiteId) => void;
  onRadiusChange: (radius: RegionalDemoRadius) => void;
  onClose: () => void;
}

export function RegionalDemoPanel({ summary, onSiteChange, onRadiusChange, onClose }: RegionalDemoPanelProps) {
  const { t } = useLocale();
  const { site, radiusMeters, records, counts } = summary;
  const radiusKm = radiusMeters / 1000;
  const additionalRecords = radiusMeters === 5000
    ? records.length - getRegionalDemoSummary(site.id, 3000).records.length
    : null;
  return (
    <section className="regional-demo-panel pointer-events-auto" aria-label={t("区域监测演示", "Regional monitoring demo")}>
      <div className="regional-demo-description">
        <h2>{t("试点附近有哪些监测记录？", "What was recorded near this site?")}</h2>
        <p>{t("选一个试点，切换3或5公里范围。点圈内标记，查看巡查或水质记录。",
          "Choose a site and a 3 or 5 km radius. Select a marker to open its health or water quality record.")}</p>
        <p>{t("记录为2025年5月的模拟数据。符号表示与试点的水系关系，不能据此判断发病或传播。",
          "May 2025 sample records. Symbols show water-system groups. These groups alone cannot indicate disease or spread.")}</p>
      </div>
      <div className="regional-demo-selects">
        <label>{t("虚构试点", "Fictional site")}
          <select id="regional-demo-site-select" value={site.id} onChange={e => onSiteChange(e.target.value as RegionalDemoSiteId)}>
            {REGIONAL_DEMO_SITES.map(pilot => <option key={pilot.id} value={pilot.id}>{t("试点", "Site")} {pilot.id} · {pilot.waterSystem}</option>)}
          </select>
        </label>
        <label>{t("直线半径", "Straight-line radius")}
          <select value={radiusMeters} onChange={e => onRadiusChange(Number(e.target.value) as RegionalDemoRadius)}>
            <option value={3000}>3 km</option><option value={5000}>5 km</option>
          </select>
        </label>
      </div>
      <div className="regional-demo-summary" aria-live="polite" aria-atomic="true">
        <strong>{t(`试点 ${site.id} 周边 ${radiusKm} 公里内有 ${records.length} 条记录`, `${records.length} records within ${radiusKm} km of Site ${site.id}`)}</strong>
        {additionalRecords !== null && <p>{t(`比3公里范围多 ${additionalRecords} 条`, `${additionalRecords} more records than at 3 km`)}</p>}
        <dl>{(Object.keys(groupLabels) as RegionalDemoGroup[]).map(group => (
          <div key={group}><dt><i className={`regional-symbol symbol-${group}`} aria-hidden="true" />{t(...groupLabels[group])}</dt><dd>{counts[group]}</dd></div>
        ))}</dl>
      </div>
      <button className="regional-demo-close" type="button" onClick={onClose} aria-label={t("关闭区域监测演示", "Close regional monitoring demo")}><X size={19} aria-hidden="true" /></button>
    </section>
  );
}
