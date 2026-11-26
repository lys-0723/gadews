"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CloudRain,
  ExternalLink,
  Gauge,
  Loader2,
  MapPin,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { overviewCopy } from "@/lib/gadews/i18n/overview";

interface WeatherTimeseriesRecord {
  site_id: string;
  site_name: string;
  country: string;
  latitude: number;
  longitude: number;
  date: string;
  t2m: number | null;
  t2m_max: number | null;
  t2m_min: number | null;
  air_temperature_range: number | null;
  precipitation: number | null;
  rh2m: number | null;
  ws2m: number | null;
  source: string;
  source_url: string;
}

interface SiteOption {
  site_id: string;
  site_name: string;
  country: string;
  latitude: number;
  longitude: number;
  source_url: string;
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function maxValue(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color?: string }>;
  label?: string;
}) {
  const c = useCopy(overviewCopy);
  if (!active || !payload?.length) return null;

  const labels: Record<string, string> = {
    t2m: c("air"),
    precipitation: c("precip"),
    air_temperature_range: c("range"),
  };

  const units: Record<string, string> = {
    t2m: "deg C",
    precipitation: "mm",
    air_temperature_range: "deg C",
  };

  return (
    <div className="glass-strong rounded-lg px-3 py-2 shadow-xl">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-sm text-slate-700">
          <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span>
            {labels[item.dataKey] ?? item.dataKey}
          </span>
          {": "}
          <span className="font-bold text-foreground">
            {formatNumber(item.value, item.dataKey === "precipitation" ? 2 : 1)}
          </span>{" "}
          {units[item.dataKey] ?? ""}
        </p>
      ))}
    </div>
  );
}

export function EnvironmentalDataPanel() {
  const c = useCopy(overviewCopy);
  const { t } = useLocale();
  const [records, setRecords] = useState<WeatherTimeseriesRecord[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/weather-timeseries.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load weather-timeseries.json (${response.status})`);
        }
        return response.json();
      })
      .then((data: WeatherTimeseriesRecord[]) => {
        setRecords(data);
        setSelectedSiteId(data[0]?.site_id ?? "");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load environmental data");
      })
      .finally(() => setLoading(false));
  }, []);

  const siteOptions = useMemo<SiteOption[]>(() => {
    const sites = new Map<string, SiteOption>();
    records.forEach((record) => {
      if (!sites.has(record.site_id)) {
        sites.set(record.site_id, {
          site_id: record.site_id,
          site_name: record.site_name,
          country: record.country,
          latitude: record.latitude,
          longitude: record.longitude,
          source_url: record.source_url,
        });
      }
    });
    return Array.from(sites.values());
  }, [records]);

  const selectedRecords = useMemo(
    () =>
      records
        .filter((record) => record.site_id === selectedSiteId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [records, selectedSiteId]
  );

  const selectedSite = siteOptions.find((site) => site.site_id === selectedSiteId);
  const dateRange =
    selectedRecords.length > 0
      ? `${selectedRecords[0].date} – ${selectedRecords[selectedRecords.length - 1].date}`
      : "--";

  const stats = [
      {
        label: c("avgAir"),
        value: formatNumber(average(selectedRecords.map((record) => record.t2m)), 1),
        unit: "deg C",
        icon: Thermometer,
        color: "text-orange-800",
        bg: "bg-orange-400/10",
      },
      {
        label: c("maxRain"),
        value: formatNumber(maxValue(selectedRecords.map((record) => record.precipitation)), 2),
        unit: "mm",
        icon: CloudRain,
        color: "text-cyan-800",
        bg: "bg-cyan-400/10",
      },
      {
        label: c("maxRange"),
        value: formatNumber(
          maxValue(selectedRecords.map((record) => record.air_temperature_range)),
          1
        ),
        unit: "deg C",
        icon: Gauge,
        color: "text-yellow-800",
        bg: "bg-yellow-400/10",
      },
      {
        label: c("humidity"),
        value: formatNumber(average(selectedRecords.map((record) => record.rh2m)), 1),
        unit: "%",
        icon: Waves,
        color: "text-emerald-800",
        bg: "bg-emerald-400/10",
      },
      {
        label: c("wind"),
        value: formatNumber(average(selectedRecords.map((record) => record.ws2m)), 2),
        unit: "m/s",
        icon: Wind,
        color: "text-blue-800",
        bg: "bg-blue-400/10",
      },
    ];

  return (
    <section className="py-10">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground sm:text-2xl">
              {c("title")}
            </h3>
            <p className="mt-2 max-w-2xl text-lg leading-8 text-slate-700">
              {c("intro")}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {c("site")}
            </span>
            <select aria-label={c("selectSite")} value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)} className="min-h-11 w-full rounded-lg border border-slate-400 bg-white p-2 text-sm text-slate-900 sm:w-[280px]">
              <option value="" disabled>{c("selectSite")}</option>
              {siteOptions.map(site => <option key={site.site_id} value={site.site_id}>{site.site_id} - {site.site_name}</option>)}
            </select>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 lg:p-6">
          {loading && (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">{c("loading")}</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-center">
              <p role="alert" className="text-base text-red-800">{t("气象快照加载失败。请刷新页面重试。", error)}</p>
            </div>
          )}

          {!loading && !error && selectedRecords.length === 0 && <p role="status">{c("empty")}</p>}
          {!loading && !error && selectedRecords.length > 0 && (
            <div className="space-y-6">
              <p className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-base leading-7 text-slate-700">{c("missing")}</p>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h4 className="text-base font-bold text-foreground">
                      {selectedSite?.site_name}
                    </h4>
                    <span className="rounded-md border border-border/30 bg-secondary/50 px-2 py-0.5 text-sm font-semibold text-muted-foreground">
                      {selectedSiteId}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedSite?.country} · {selectedSite?.latitude.toFixed(2)},{" "}
                    {selectedSite?.longitude.toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    {c("source")}: {" "}
                    <span className="font-semibold text-foreground/80">NASA POWER</span>
                  </span>
                  <span className="hidden h-4 w-px bg-border/40 sm:block" />
                  <span>{dateRange}</span>
                  <span className="hidden h-4 w-px bg-border/40 sm:block" />
                  <span>{selectedRecords.length} {c("records")}</span>
                  {selectedSite?.source_url && (
                    <>
                      <span className="hidden h-4 w-px bg-border/40 sm:block" />
                      <a
                        href={selectedSite.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
                        title={selectedSite.source_url}
                      >
                        {c("sourceUrl")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border/30 bg-background/35 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </span>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </span>
                    </div>
                    <p className={`text-2xl font-extrabold ${stat.color}`}>
                      {stat.value}
                      <span className="ml-1 text-sm font-medium text-muted-foreground">
                        {stat.unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-[7fr_5fr]">
                <div className="rounded-xl border border-border/30 bg-background/35 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {c("chart")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {c("notPond")}
                      </p>
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={selectedRecords}
                        margin={{ top: 10, right: 6, left: -12, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="hsl(210, 30%, 18%)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 14, fill: "#475569" }}
                          minTickGap={18}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(210, 30%, 18%)" }}
                        />
                        <YAxis
                          yAxisId="temp"
                          tick={{ fontSize: 14, fill: "#475569" }}
                          tickLine={false}
                          axisLine={false}
                          unit="°"
                        />
                        <YAxis
                          yAxisId="rain"
                          orientation="right"
                          tick={{ fontSize: 14, fill: "#475569" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar
                          isAnimationActive={false}
                          yAxisId="rain"
                          dataKey="precipitation"
                          fill="#22d3ee"
                          fillOpacity={0.7}
                          radius={[4, 4, 0, 0]}
                          name={c("precip")}
                        />
                        <Line
                          isAnimationActive={false}
                          yAxisId="temp"
                          type="monotone"
                          dataKey="t2m"
                          stroke="#c2410c"
                          strokeWidth={2.4}
                          dot={false}
                          connectNulls={false}
                          name={c("air")}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-border/30 bg-background/35 p-4">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-foreground">
                      {c("rangeTitle")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {c("rangeInfo")}
                    </p>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selectedRecords}
                        margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#eab308" stopOpacity={0.32} />
                            <stop offset="100%" stopColor="#eab308" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="hsl(210, 30%, 18%)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 14, fill: "#475569" }}
                          minTickGap={18}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(210, 30%, 18%)" }}
                        />
                        <YAxis
                          tick={{ fontSize: 14, fill: "#475569" }}
                          tickLine={false}
                          axisLine={false}
                          unit="°"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="air_temperature_range"
                          stroke="#a16207"
                          strokeWidth={2}
                          fill="url(#rangeGradient)"
                          dot={false}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
