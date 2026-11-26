"use client";

import {
  Activity,
  ArrowRight,
  Database,
  Eye,
  GitBranch,
  Layers3,
  Network,
  SearchCheck,
} from "lucide-react";

import { FaoJourneyTimeline } from "@/components/gadews/home/development-pathway-timeline";

const storyBlocks = [
  {
    icon: SearchCheck,
    title: "Early Warning Concept",
    text: "GADEWS connects field observations, pathogen detection, environmental signals, public disease information, and expert knowledge to identify risks before major losses occur.",
    points: ["Recognize early signals", "Assess risk in context", "Support timely response"],
  },
  {
    icon: Eye,
    title: "System Value",
    text: "The system helps farmers, laboratories, competent authorities, and regional managers share situational awareness and translate risk information into practical action.",
    points: [
      "Earlier detection",
      "Better situational awareness",
      "Faster decision support",
      "More coordinated response",
    ],
  },
  {
    icon: Network,
    title: "How GADEWS Works",
    text: "GADEWS combines disease intelligence, environmental context, structured knowledge, rule-based warning logic, and visualization tools into one integrated workflow.",
    points: ["Disease intelligence", "Environmental context", "Knowledge and rules", "Decision support"],
  },
  {
    icon: GitBranch,
    title: "Current Prototype Progress",
    text: "The current prototype demonstrates key building blocks, including a frontend portal, public disease data layers, NASA POWER weather integration, structured knowledge resources, and a WSD rule-based warning model.",
    points: [
      "Web portal framework",
      "WAHIS and QAAD public report layers",
      "NASA POWER environmental data",
      "WSD and streptococcosis knowledge resources",
      "WSD warning model in Warning Tools",
    ],
  },
];

const signalFlow = [
  { icon: Activity, label: "Signals" },
  { icon: Database, label: "Risk Intelligence" },
  { icon: Layers3, label: "Warning" },
  { icon: ArrowRight, label: "Action" },
];

export function WhyGadewsMatters() {
  return (
    <section
      id="why-gadews-matters"
      className="relative overflow-hidden bg-[#f4fbfa] py-20 sm:py-28"
    >
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white to-transparent" />
      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-teal-700">
              Why GADEWS Matters
            </p>
            <h2 className="text-balance text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Turning disease signals into earlier action.
            </h2>
          </div>
          <p className="text-base leading-8 text-slate-600 sm:text-lg">
            Aquaculture disease risks emerge from the interaction of pathogens,
            environmental stress, host susceptibility, and management conditions.
            GADEWS brings these signals together into a practical early warning
            and decision-support framework, helping stakeholders move from
            reactive response toward proactive aquatic biosecurity.
          </p>
        </div>

        <div className="mt-10 rounded-[2rem] border border-teal-100 bg-white/80 p-4 shadow-xl shadow-teal-950/5 backdrop-blur sm:p-5">
          <div className="grid gap-3 md:grid-cols-4">
            {signalFlow.map((item, index) => (
              <div
                key={item.label}
                className="relative flex items-center gap-3 rounded-2xl bg-teal-50 px-4 py-4"
              >
                {index > 0 && (
                  <div className="absolute -left-3 top-1/2 hidden h-px w-6 bg-teal-300 md:block" />
                )}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-black text-slate-900">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {storyBlocks.map((block) => (
            <article
              key={block.title}
              className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5 transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-2xl hover:shadow-teal-950/10"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white">
                  <block.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-950">{block.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{block.text}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {block.points.map((point) => (
                  <span
                    key={point}
                    className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <FaoJourneyTimeline embedded />
      </div>
    </section>
  );
}
