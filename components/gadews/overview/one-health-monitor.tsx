"use client";

import { useEffect, useRef } from "react";

const RING_DATA = [
  { label: "Environmental\nPressure", color: "#22d3ee", angle: 0 },
  { label: "Pathogen\nPresence", color: "#ef4444", angle: 120 },
  { label: "Host\nImmunity", color: "#22c55e", angle: 240 },
];

function drawVenn(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number
) {
  ctx.clearRect(0, 0, w * dpr, h * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.22;
  const offset = radius * 0.55;

  const positions = RING_DATA.map((d) => {
    const rad = (d.angle - 90) * (Math.PI / 180);
    return {
      x: cx + Math.cos(rad) * offset,
      y: cy + Math.sin(rad) * offset,
      color: d.color,
      label: d.label,
    };
  });

  // Draw circles with glow
  positions.forEach((pos) => {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = pos.color + "18";
    ctx.fill();
    ctx.strokeStyle = pos.color + "60";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = pos.color + "20";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Center intersection glow
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.5);
  gradient.addColorStop(0, "rgba(255, 200, 50, 0.2)");
  gradient.addColorStop(1, "rgba(255, 200, 50, 0)");
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Labels
  positions.forEach((pos) => {
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const labelX = cx + dx * 2.4;
    const labelY = cy + dy * 2.4;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = pos.label.split("\n");
    lines.forEach((line, i) => {
      ctx.font = `600 ${11}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = pos.color;
      ctx.fillText(line, labelX, labelY + i * 14 - ((lines.length - 1) * 14) / 2);
    });
  });

  // Center text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 14px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#facc15";
  ctx.fillText("RISK", cx, cy - 8);
  ctx.font = `700 11px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText("NEXUS", cx, cy + 8);

  ctx.restore();
}

export function OneHealthMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      drawVenn(ctx, rect.width, rect.height, dpr);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <section className="relative py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-semibold tracking-[0.3em] text-primary uppercase">
            System Philosophy
          </p>
          <h2 className="text-balance text-2xl font-extrabold text-foreground sm:text-3xl">
            One Health Perspective
          </h2>
        </div>

        <div className="glass rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
            {/* Venn Diagram */}
            <div className="flex w-full items-center justify-center lg:w-1/2">
              <canvas
                ref={canvasRef}
                className="h-[320px] w-full max-w-[420px]"
                aria-label="One Health Venn Diagram showing interaction between Environmental Pressure, Pathogen Presence, and Host Immunity"
                role="img"
              />
            </div>

            {/* Description */}
            <div className="flex w-full flex-col gap-6 lg:w-1/2">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-xs font-bold tracking-wider text-yellow-400 uppercase">
                    Current Global Risk Level
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-orange-400">
                    MODERATE
                  </span>
                  <span className="text-sm text-muted-foreground">/ Elevated Watch</span>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                Disease outbreaks are triggered when{" "}
                <span className="font-semibold text-cyan-400">Environment Pressure</span>{" "}
                (SST anomaly, salinity crash, DO drop),{" "}
                <span className="font-semibold text-red-400">Pathogen Presence</span>{" "}
                (WSSV / AHPND / Vibrio density), and{" "}
                <span className="font-semibold text-emerald-400">Host Immunity</span>{" "}
                (stress index, feed response rate) converge. GADEWS monitors all three dimensions
                in real-time to detect risk convergence before outbreaks occur.
              </p>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Environment Pressure",
                    sublabel: "SST +1.8°C · Salinity −5.2 ppt",
                    value: "72",
                    unit: "/100",
                    color: "text-cyan-400",
                    bg: "bg-cyan-400/10",
                    border: "border-cyan-400/20",
                    trend: "↑ Rising",
                    trendColor: "text-red-400",
                  },
                  {
                    label: "Pathogen Presence",
                    sublabel: "WSSV prevalence: 38% sites",
                    value: "58",
                    unit: "/100",
                    color: "text-red-400",
                    bg: "bg-red-400/10",
                    border: "border-red-400/20",
                    trend: "↑ High",
                    trendColor: "text-red-400",
                  },
                  {
                    label: "Host Immunity",
                    sublabel: "Avg DO: 4.5 mg/L · Feed rate −20%",
                    value: "65",
                    unit: "/100",
                    color: "text-emerald-400",
                    bg: "bg-emerald-400/10",
                    border: "border-emerald-400/20",
                    trend: "↓ Declining",
                    trendColor: "text-amber-400",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border ${s.border} ${s.bg} p-3 text-center`}
                  >
                    <p className={`text-2xl font-extrabold ${s.color}`}>
                      {s.value}
                      <span className="text-xs font-normal text-muted-foreground">{s.unit}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-[9px] text-muted-foreground/70 leading-tight">{s.sublabel}</p>
                    <p className={`mt-1 text-[9px] font-bold ${s.trendColor}`}>{s.trend}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
