"use client";

import { Activity, Eye, Rocket, SearchCheck } from "lucide-react";

const valueCards = [
  {
    icon: SearchCheck,
    title: "Earlier detection",
    body: "Identify emerging disease risks before major losses occur.",
  },
  {
    icon: Eye,
    title: "Better situational awareness",
    body: "Combine disease events, environmental signals, and surveillance information into one view.",
  },
  {
    icon: Activity,
    title: "Faster decision support",
    body: "Help experts, managers, and farms respond with clearer and timelier actions.",
  },
  {
    icon: Rocket,
    title: "Scalable system design",
    body: "Support a pathway from knowledge integration to prototype, pilots, and future regional deployment.",
  },
];

export function WhyEarlyWarningMatters() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-teal-700">
            System value
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Why Early Warning Matters
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            Aquaculture disease risks often emerge through the convergence of
            environmental pressure, host susceptibility, pathogen presence, and
            management conditions. Early warning helps shift aquatic animal
            health management from delayed reaction to proactive risk reduction.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {valueCards.map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5 transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-950/10"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-950">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
