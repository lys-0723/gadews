"use client";

import {
  AlertTriangle,
  Droplets,
  Thermometer,
  Wind,
  Waves,
  FlaskConical,
  ChevronRight,
} from "lucide-react";

const ALERTS = [
  {
    id: 1,
    type: "Salinity Crash → WSSV Risk Elevated",
    detail: "Salinity drop > 5 ppt in 24h — WSSV latent activation probability 84%",
    location: "Mekong Delta, Vietnam",
    status: "High Risk",
    statusColor: "text-red-400",
    statusBg: "bg-red-400/10 border-red-400/30",
    icon: Droplets,
    iconColor: "text-cyan-400",
    time: "12 min ago",
  },
  {
    id: 2,
    type: "Temp < 27°C — WSSV Risk Window",
    detail: "Water temp dropped to 26.3°C (+3°C swing in 6h) — optimal for WSSV replication",
    location: "Guangdong, China",
    status: "Warning",
    statusColor: "text-orange-400",
    statusBg: "bg-orange-400/10 border-orange-400/30",
    icon: Thermometer,
    iconColor: "text-orange-400",
    time: "28 min ago",
  },
  {
    id: 3,
    type: "Dissolved O₂ Critical — DO < 3.5 mg/L",
    detail: "DO at 2.8 mg/L, below critical threshold — hypoxic stress elevates host susceptibility",
    location: "East Java, Indonesia",
    status: "High Risk",
    statusColor: "text-red-400",
    statusBg: "bg-red-400/10 border-red-400/30",
    icon: Wind,
    iconColor: "text-red-400",
    time: "45 min ago",
  },
  {
    id: 4,
    type: "pH Anomaly — AHPND Trigger Detected",
    detail: "pH dropped to 6.8; Vibrio parahaemolyticus proliferates at pH < 7.0 (AHPND risk)",
    location: "Guayaquil, Ecuador",
    status: "Warning",
    statusColor: "text-orange-400",
    statusBg: "bg-orange-400/10 border-orange-400/30",
    icon: FlaskConical,
    iconColor: "text-yellow-400",
    time: "1h ago",
  },
  {
    id: 5,
    type: "Algal Bloom — Hypoxia Risk",
    detail: "Chlorophyll-a > 50 µg/L; nocturnal DO crash expected — pre-outbreak watch activated",
    location: "Nha Trang, Vietnam",
    status: "Monitoring",
    statusColor: "text-yellow-400",
    statusBg: "bg-yellow-400/10 border-yellow-400/30",
    icon: Waves,
    iconColor: "text-emerald-400",
    time: "2h ago",
  },
  {
    id: 6,
    type: "Rainfall Surge — Salinity Dilution",
    detail: "Monthly rainfall +180%; pond salinity falling toward 8 ppt — WSSV convergence model triggered",
    location: "Sóc Trăng, Vietnam",
    status: "High Risk",
    statusColor: "text-red-400",
    statusBg: "bg-red-400/10 border-red-400/30",
    icon: Droplets,
    iconColor: "text-blue-400",
    time: "1.5h ago",
  },
];

export function TriggerAlertFeed() {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Early Detection: Environmental Triggers
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Real-time anomaly detection from IoT sensor networks
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-red-400 uppercase">
            6 Active
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {ALERTS.map((alert) => (
          <div
            key={alert.id}
            className="group flex items-start gap-3 rounded-xl border border-border/30 bg-background/40 p-3.5 transition-colors hover:border-primary/20 hover:bg-background/60"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <alert.icon className={`h-4 w-4 ${alert.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {alert.type}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {alert.detail}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${alert.statusColor} ${alert.statusBg}`}
                >
                  {alert.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{alert.location}</span>
                <span className="text-border">|</span>
                <span>{alert.time}</span>
              </div>
            </div>
            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-primary" />
          </div>
        ))}
      </div>
    </div>
  );
}
