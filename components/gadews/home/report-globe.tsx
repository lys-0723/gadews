"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePublicSurveillance } from "@/hooks/use-public-surveillance";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { PublicSourceStatus } from "@/components/gadews/risk-map/public-source-status";
import { globeCopy } from "@/lib/gadews/i18n/globe";
import {
  DISEASE_FILTERS,
  hasCoordinates,
  validDate,
  type DiseaseFilter,
  type WahisRecord,
} from "@/lib/gadews/public-surveillance";
import {
  filterGlobeReports,
  groupGlobeReports,
  officialReportUrl,
  placeGlobeLabel,
  type GlobeReportGroup,
  type Rect,
} from "@/lib/gadews/globe-reports";
import type { GlobeAnchor, GlobeScene } from "./globe-scene";

export function ReportGlobe({
  accessTarget,
}: { accessTarget?: HTMLElement | null } = {}) {
  const c = useCopy(globeCopy);
  const { locale, setLocale, t } = useLocale();
  const snapshot = usePublicSurveillance("wahis", true);
  const [filter, setFilter] = useState<DiseaseFilter>("all");
  const [reduced, setReduced] = useState(false);
  const [rendererState, setRendererState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<GlobeScene | null>(null);
  const labels = useRef(new Map<string, HTMLButtonElement>());
  const groups = useMemo(
    () => groupGlobeReports(snapshot.records, filter),
    [snapshot.records, filter],
  );
  const records = useMemo(
    () => filterGlobeReports(snapshot.records, filter),
    [snapshot.records, filter],
  );
  const groupsRef = useRef(groups);
  const openRef = useRef(open);
  const reducedRef = useRef(reduced);
  const browse = useRef<HTMLButtonElement>(null);
  const dialogFilterId = useId();
  const keyFor = (record: WahisRecord) =>
    `${record.event_id}:${record.sourceIndex}`;
  const dialogRecords = selectedGroupId
    ? (groups.find((group) => group.id === selectedGroupId)?.reports ?? [])
    : records;
  const selected =
    dialogRecords.find((record) => keyFor(record) === selectedKey) ??
    dialogRecords[0];

  function openReports(group?: GlobeReportGroup) {
    scene.current?.setPaused(true);
    setSelectedGroupId(group?.id ?? null);
    if (group) setSelectedKey(keyFor(group.reports[0]));
    setOpen(true);
  }
  const openReportsRef = useRef(openReports);
  useEffect(() => {
    openReportsRef.current = openReports;
  });
  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(preference?.matches ?? false);
    };
    change();
    preference?.addEventListener("change", change);
    return () => preference?.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mount.current || !host.current) return;
    let cancelled = false;
    const viewport = mount.current;
    const container = host.current;
    function project(anchors: GlobeAnchor[]) {
      const rect = container.getBoundingClientRect();
      const bounds: Rect = {
        left: Math.max(rect.left + 8, 8),
        top: Math.max(rect.top + 8, 8),
        right: Math.min(rect.right - 8, window.innerWidth - 8),
        bottom: Math.min(rect.bottom - 8, window.innerHeight - 8),
      };
      const protectedRects = [
        ...document.querySelectorAll<HTMLElement>(
          ".hero-copy,.globe-caption,.globe-tools,.globe-help,.gadews-header,.report-globe-source,.report-globe-dialog",
        ),
      ]
        .filter((node) => !node.hidden)
        .map((node) => node.getBoundingClientRect())
        .filter((zone) => zone.width > 0 && zone.height > 0);
      const occupied: Rect[] = [...protectedRects];
      // Read label sizes and resolve collisions before writing any positions.
      // Writing a position between size reads forces a layout for each label.
      const placements = new Map<HTMLButtonElement, Rect>();
      const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
      labels.current.forEach((label, id) => {
        const anchor = byId.get(id);
        if (!anchor?.front || placements.size >= 4) return;
        // Measure the actual translated text and padding, without a fixed width estimate.
        const width = label.offsetWidth;
        const height = label.offsetHeight;
        const x = rect.left + anchor.x;
        const y = rect.top + anchor.y;
        const candidates = [
          { left: x + 18, top: y - height - 9 },
          { left: x - width - 18, top: y - height - 9 },
          { left: x + 18, top: y + 9 },
          { left: x - width - 18, top: y + 9 },
        ];
        for (const candidate of candidates) {
          const placement = placeGlobeLabel(
            {
              ...candidate,
              right: candidate.left + width,
              bottom: candidate.top + height,
            },
            occupied,
            bounds,
          );
          if (placement) {
            placements.set(label, placement);
            occupied.push(placement);
            break;
          }
        }
      });

      labels.current.forEach((label) => {
        const placement = placements.get(label);
        if (!placement) {
          if (label.tabIndex === 0) {
            if (document.activeElement === label)
              browse.current?.focus({ preventScroll: true });
            label.style.visibility = "hidden";
            label.tabIndex = -1;
          }
          return;
        }
        label.style.left = `${placement.left - rect.left}px`;
        label.style.top = `${placement.top - rect.top}px`;
        if (label.tabIndex !== 0) {
          label.style.visibility = "visible";
          label.tabIndex = 0;
        }
      });
    }
    if (!("WebGLRenderingContext" in window)) {
      // This is a renderer failure, independent from snapshot loading / empty / request errors.
      queueMicrotask(() => {
        if (!cancelled) setRendererState("error");
      });
      return () => {
        cancelled = true;
      };
    }
    import("./globe-scene")
      .then(({ createGlobeScene }) => {
        if (cancelled) return;
        const instance = createGlobeScene(viewport, {
          onProject: project,
          onSelect: (id) => {
            const group = groupsRef.current.find((item) => item.id === id);
            if (group) {
              openReportsRef.current(group);
            }
          },
          onReady: () => {
            if (!cancelled) setRendererState("ready");
          },
          onError: () => {
            if (!cancelled) {
              setRendererState("error");
              project([]);
            }
          },
        });
        scene.current = instance;
        instance.setGroups(groupsRef.current);
        instance.setPaused(openRef.current);
        instance.setReducedMotion(reducedRef.current);
      })
      .catch(() => {
        if (!cancelled) setRendererState("error");
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    groupsRef.current = groups;
    scene.current?.setGroups(groups);
  }, [groups]);
  useEffect(() => {
    openRef.current = open;
    scene.current?.setPaused(open);
  }, [open]);
  useEffect(() => {
    reducedRef.current = reduced;
    scene.current?.setReducedMotion(reduced);
  }, [reduced]);
  useEffect(() => {
    scene.current?.redraw();
  }, [locale, open]);

  const filterSelect = (id: string) => (
    <label className="report-globe-filter" htmlFor={id}>
      <span>{c("filter")}</span>
      <select
        id={id}
        value={filter}
        onChange={(event) => setFilter(event.target.value as DiseaseFilter)}
      >
        {DISEASE_FILTERS.map((value) => (
          <option key={value} value={value}>
            {value === "all"
              ? c("all")
              : value === "other"
                ? c("other")
                : value}
          </option>
        ))}
      </select>
    </label>
  );
  const missing = records.filter((record) => !hasCoordinates(record)).length;
  const access = (
    <div className="report-globe-access">
      <div className="report-globe-access-row">
        <p className="report-globe-count" aria-live="polite">
          {t(
            `${records.length} 份报告 · ${groups.length} 个位置${missing ? ` · ${missing} 份无坐标` : ""}`,
            `${records.length} reports · ${groups.length} locations${missing ? ` · ${missing} without coordinates` : ""}`,
          )}
        </p>
        <button ref={browse} type="button" onClick={() => openReports()}>
          {c("browse")} ↗
        </button>
      </div>
      {snapshot.state === "success" && rendererState === "error" && (
        <p className="report-globe-fallback" role="status">
          {c("fallback")}
        </p>
      )}
      {snapshot.state === "success" && rendererState === "loading" && (
        <p role="status">{c("sceneLoading")}</p>
      )}
      {snapshot.state === "success" && !records.length && (
        <p>{c("noMatches")}</p>
      )}
      {snapshot.state !== "success" && (
        <PublicSourceStatus title="WOAH WAHIS" {...snapshot} />
      )}
    </div>
  );
  return (
    <div
      className="report-globe"
      ref={host}
      aria-label={c("title")}
      data-renderer={rendererState}
      data-motion={reduced ? "reduced" : open ? "reading" : "auto"}
    >
      {rendererState === "error" && (
        <div className="report-globe-static" aria-hidden="true">
          <svg viewBox="0 0 720 360" preserveAspectRatio="xMidYMid meet">
            <image
              href="/globe/earth-blue-marble.png"
              width="720"
              height="360"
            />
            {groups.map((group) => (
              <circle
                key={group.id}
                cx={(group.longitude + 180) * 2}
                cy={(90 - group.latitude) * 2}
                r="3.5"
                fill="#f0ba6d"
                stroke="#082336"
                strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>
      )}
      <div ref={mount} className="report-globe-canvas" />
      <div className="report-globe-labels">
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            ref={(node) => {
              if (node) labels.current.set(group.id, node);
              else labels.current.delete(group.id);
            }}
            tabIndex={-1}
            className="report-globe-label"
            onClick={() => openReports(group)}
            onFocus={(event) => {
              if (event.currentTarget.matches(":focus-visible"))
                scene.current?.setPaused(true);
            }}
            onBlur={() => scene.current?.setPaused(openRef.current)}
          >
            {group.reports[0].country} · {group.reports.length}{" "}
            {t("份报告", "reports")}
          </button>
        ))}
      </div>
      {accessTarget === undefined
        ? access
        : accessTarget
          ? createPortal(access, accessTarget)
          : null}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="report-globe-backdrop" />
          <Dialog.Content
            className="report-globe-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              browse.current?.focus({ preventScroll: true });
            }}
          >
            <div className="report-globe-dialog-nav">
              <Link href="/">{c("home")}</Link>
              <label>
                <span className="sr-only">Chinese / English</span>
                <select
                  aria-label="Chinese / English"
                  value={locale}
                  onChange={(event) =>
                    setLocale(event.target.value as "zh-CN" | "en")
                  }
                >
                  <option value="zh-CN">中文</option>
                  <option value="en">English</option>
                </select>
              </label>
              <Dialog.Close aria-label={c("close")}>
                {c("close")} ×
              </Dialog.Close>
            </div>
            <Dialog.Title>{c("reports")}</Dialog.Title>
            <Dialog.Description>{c("original")}</Dialog.Description>
            {filterSelect(dialogFilterId)}
            {selectedGroupId && (
              <div className="report-globe-location-summary">
                <p>
                  {dialogRecords[0]?.country ?? c("noMatches")} ·{" "}
                  {dialogRecords.length} {t("份报告", "reports")}
                </p>
                <button type="button" onClick={() => setSelectedGroupId(null)}>
                  {c("browse")}
                </button>
              </div>
            )}
            <div className="report-globe-dialog-body">
              <div
                className="report-globe-report-list"
                aria-label={c("reports")}
              >
                {dialogRecords.map((record) => (
                  <button
                    type="button"
                    key={keyFor(record)}
                    data-globe-report={record.event_id}
                    aria-pressed={selected === record}
                    onClick={() => setSelectedKey(keyFor(record))}
                  >
                    <strong>{record.country}</strong>
                    <span>
                      {record.disease_id} · {record.event_id}
                    </span>
                  </button>
                ))}
                {!dialogRecords.length && <p>{c("noMatches")}</p>}
              </div>
              {selected && <ReportDetail record={selected} />}
            </div>
            <div className="report-globe-dialog-source">
              <PublicSourceStatus title="WOAH WAHIS" {...snapshot} />
              <p>{c("geographic")}</p>
              <p>{c("credits")}</p>
              <p>{c("boundaries")}</p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function ReportDetail({ record }: { record: WahisRecord }) {
  const c = useCopy(globeCopy);
  const url =
    officialReportUrl(record.last_report_url) ??
    officialReportUrl(record.dashboard_url);
  const submitted =
    record.latest_report_detail?.report_date ??
    record.dashboard_summary?.latest_reporting_date;
  return (
    <article className="report-globe-detail" aria-live="polite">
      <h3>{record.country}</h3>
      <p>{record.disease_name}</p>
      <p>
        {record.disease_id} · {record.event_id}
      </p>
      <dl>
        <div>
          <dt>{c("eventDate")}</dt>
          <dd>{record.event_start_date ?? c("unknownDate")}</dd>
        </div>
        <div>
          <dt>{c("submitted")}</dt>
          <dd>{validDate(submitted) ? submitted : c("unknownDate")}</dd>
        </div>
        <div>
          <dt>{c("precision")}</dt>
          <dd>{hasCoordinates(record) ? c("centroid") : c("noCoordinates")}</dd>
        </div>
      </dl>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {c("official")} ↗
        </a>
      ) : (
        <p>{c("noLink")}</p>
      )}
    </article>
  );
}
