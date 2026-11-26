"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Handshake,
  MapPinned,
  Network,
  Route,
  UsersRound,
} from "lucide-react";

type Milestone = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  tags: string[];
  image?: {
    src: string;
    alt: string;
    caption: string;
  };
  focus: {
    headline: string;
    text: string;
    pills: string[];
  };
  icon: typeof Compass;
};

const milestones: Milestone[] = [
  {
    id: "fao-initiative",
    eyebrow: "Initiation",
    title: "FAO Initiative",
    detail:
      "FAO initiated the exploration of an aquatic disease early warning framework to support farm-level biosecurity, earlier detection, and coordinated response for priority aquatic diseases. The initiative responds to the need to connect field signals, disease intelligence, environmental context, and decision-support workflows into a practical early warning system.",
    tags: ["Initiative", "Biosecurity", "Early warning"],
    focus: {
      headline: "From concept to coordinated early warning.",
      text: "The initiative establishes the need for a practical EWS that connects farm-level signals with regional and institutional response.",
      pills: ["Concept framing", "Biosecurity need", "Field signals", "Coordinated response"],
    },
    icon: Compass,
  },
  {
    id: "qingdao-workshop",
    eyebrow: "Qingdao · Technical Workshop",
    title: "Qingdao Workshop",
    detail:
      "The Qingdao workshop brought together specialists in aquatic animal health, epidemiology, biosecurity, data systems, and digital innovation. The discussion helped clarify the EWS concept, technical scope, system modules, data needs, privacy considerations, and early development pathway.",
    tags: ["Consultation", "Technical scope", "Data systems"],
    image: {
      src: "/images/fao-qingdao.jpg",
      alt: "Group photo from the Qingdao EWS technical workshop",
      caption: "Qingdao technical workshop group photo",
    },
    focus: {
      headline: "Defining the technical scope.",
      text: "The workshop helps translate expert consultation into system requirements, data needs, technical modules, and development priorities.",
      pills: ["Expert consultation", "System requirements", "Data needs", "Development priorities"],
    },
    icon: UsersRound,
  },
  {
    id: "rome-workshop",
    eyebrow: "Rome · Validation Workshop",
    title: "Rome Workshop",
    detail:
      "The Rome workshop reviewed and refined earlier outcomes, helping consolidate the technical roadmap. The discussion supported validation of the system architecture, governance considerations, data flows, phased implementation, pilot design, and international collaboration.",
    tags: ["Validation", "Governance", "Pilot planning"],
    image: {
      src: "/images/fao-rome.png",
      alt: "Group photo from the Rome EWS validation workshop",
      caption: "Rome validation workshop group photo",
    },
    focus: {
      headline: "Validating the roadmap.",
      text: "The validation process helps consolidate architecture, governance, data flows, pilot logic, and implementation pathways.",
      pills: ["Roadmap validation", "Governance", "Pilot logic", "Collaboration"],
    },
    icon: Handshake,
  },
  {
    id: "twg-coordination",
    eyebrow: "TWG Coordination",
    title: "Technical Working Group",
    detail:
      "The technical working group process supports continued refinement of the EWS roadmap, including knowledge product development, system architecture, human-in-the-loop validation, data governance, model strategy, and partnership coordination.",
    tags: ["Knowledge structure", "Model strategy", "Governance"],
    focus: {
      headline: "Refining knowledge, governance, and model logic.",
      text: "The TWG process supports the detailed work needed to turn the roadmap into a reliable and explainable platform.",
      pills: ["Knowledge structure", "Data governance", "Model strategy", "Partnerships"],
    },
    icon: Network,
  },
  {
    id: "mvp-pilot-roadmap",
    eyebrow: "2026-2028+",
    title: "MVP & Pilot Roadmap",
    detail:
      "The roadmap moves from design and governance toward MVP construction, pilot verification, and phased scale-up. The early platform will focus on practical modules such as reporting workflows, risk maps, knowledge banks, warning tools, and rule-based risk interpretation.",
    tags: ["MVP", "Pilot", "Scale-up"],
    focus: {
      headline: "Moving toward prototype and pilot implementation.",
      text: "The roadmap connects knowledge structures, reporting workflows, risk interpretation, and decision-support modules into a phased implementation plan.",
      pills: ["MVP construction", "Pilot verification", "Risk interpretation", "Scale-up"],
    },
    icon: Route,
  },
];

export function FaoJourneyTimeline({ embedded = false }: { embedded?: boolean }) {
  const [activeId, setActiveId] = useState(milestones[1].id);
  const activeMilestone =
    milestones.find((milestone) => milestone.id === activeId) ?? milestones[0];
  const activeIndex = milestones.findIndex(
    (milestone) => milestone.id === activeMilestone.id
  );

  return (
    <section className={embedded ? "mt-16 overflow-hidden" : "overflow-hidden bg-white py-20 sm:py-28"}>
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-teal-700">
            Development pathway
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Development Pathway
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            From FAO initiative to technical roadmap, GADEWS is evolving through
            expert consultation, international coordination, prototype
            development, and pilot-oriented validation.
          </p>
        </div>

        <div className="relative hidden lg:block">
          <div className="relative rounded-[2rem] border border-slate-200 bg-slate-50/80 px-8 pb-10 pt-12 shadow-sm shadow-slate-950/5">
            <div className="absolute left-16 right-16 top-[6.2rem] h-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-400 to-sky-400 transition-all duration-500"
                style={{
                  width: `${(activeIndex / (milestones.length - 1)) * 100}%`,
                }}
              />
            </div>

            <div className="relative z-10 grid grid-cols-5 gap-5">
              {milestones.map((milestone, index) => (
                <TimelineNode
                  key={milestone.id}
                  milestone={milestone}
                  index={index}
                  active={milestone.id === activeId}
                  onActivate={() => setActiveId(milestone.id)}
                />
              ))}
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
              <MilestoneDetail key={activeMilestone.id} milestone={activeMilestone} />
              <CurrentFocusCard key={`${activeMilestone.id}-focus`} milestone={activeMilestone} />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:hidden">
          {milestones.map((milestone, index) => {
            const isActive = milestone.id === activeId;
            const Icon = milestone.icon;

            return (
              <div
                key={milestone.id}
                className="relative rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/5"
              >
                {index < milestones.length - 1 && (
                  <div className="absolute bottom-[-1.25rem] left-8 h-5 w-px bg-gradient-to-b from-teal-300 to-slate-200" />
                )}
                <button
                  type="button"
                  onClick={() => setActiveId(milestone.id)}
                  onFocus={() => setActiveId(milestone.id)}
                  className="flex w-full items-start gap-4 text-left"
                  aria-expanded={isActive}
                  aria-label={`Show details for ${milestone.title}`}
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition ${
                      isActive
                        ? "border-teal-500 bg-teal-600 text-white shadow-lg shadow-teal-700/20"
                        : "border-slate-200 bg-slate-50 text-teal-700"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">
                      {milestone.eyebrow}
                    </span>
                    <span className="mt-1 block text-lg font-black text-slate-950">
                      {milestone.title}
                    </span>
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="pt-4">
                      <MilestoneDetail milestone={milestone} compact />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TimelineNode({
  milestone,
  index,
  active,
  onActivate,
}: {
  milestone: Milestone;
  index: number;
  active: boolean;
  onActivate: () => void;
}) {
  const Icon = milestone.icon;

  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      aria-label={`Show details for ${milestone.title}`}
      aria-pressed={active}
      className="group flex min-h-44 flex-col items-center text-center outline-none"
    >
      <span className="mb-5 text-xs font-black text-slate-400">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-white transition duration-300 group-hover:scale-105 group-focus-visible:scale-105 ${
          active
            ? "border-teal-500 text-teal-700 shadow-xl shadow-teal-600/20 ring-8 ring-teal-100"
            : "border-slate-200 text-slate-500 shadow-sm group-hover:border-teal-300 group-focus-visible:border-teal-300"
        }`}
      >
        <Icon className="h-6 w-6" />
        {milestone.image && <TimelineThumbnail image={milestone.image} />}
      </span>
      <span className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
        {milestone.eyebrow}
      </span>
      <span className="mt-2 text-lg font-black text-slate-950">
        {milestone.title}
      </span>
    </button>
  );
}

function TimelineThumbnail({ image }: { image: NonNullable<Milestone["image"]> }) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <span className="absolute -right-2 -top-2 h-8 w-8 overflow-hidden rounded-full border-2 border-white shadow-md">
      <Image
        src={image.src}
        alt=""
        fill
        sizes="32px"
        className="object-cover"
        onError={() => setHidden(true)}
      />
    </span>
  );
}

function CurrentFocusCard({ milestone }: { milestone: Milestone }) {
  return (
    <article className="flex flex-col justify-between rounded-[1.75rem] border border-teal-100 bg-white p-7 shadow-xl shadow-teal-950/8 transition duration-300 motion-safe:animate-[pathwayFade_260ms_ease-out]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal-700">
          Current focus
        </p>
        <h3 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
          {milestone.focus.headline}
        </h3>
        <p className="mt-5 text-sm leading-7 text-slate-600">
          {milestone.focus.text}
        </p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {milestone.focus.pills.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-bold text-slate-800"
          >
            <CheckCircle2 className="h-4 w-4 text-teal-700" />
            {item}
          </div>
        ))}
      </div>
    </article>
  );
}

function MilestoneDetail({
  milestone,
  compact = false,
}: {
  milestone: Milestone;
  compact?: boolean;
}) {
  return (
    <article
      className={`rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-950/8 transition duration-300 motion-safe:animate-[pathwayFade_260ms_ease-out] ${
        compact ? "p-4" : "p-6 lg:p-7"
      }`}
    >
      {milestone.image && (
        <MeetingPhoto image={milestone.image} compact={compact} />
      )}
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-teal-700" />
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">
          {milestone.eyebrow}
        </p>
      </div>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
        {milestone.title}
      </h3>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        {milestone.detail}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {milestone.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-6 inline-flex items-center text-sm font-black text-teal-700">
        View milestone details
        <ArrowRight className="ml-2 h-4 w-4" />
      </div>
      <style jsx global>{`
        @keyframes pathwayFade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </article>
  );
}

function MeetingPhoto({
  image,
  compact,
}: {
  image: NonNullable<Milestone["image"]>;
  compact: boolean;
}) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <figure className="mb-5">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100 shadow-lg shadow-slate-950/10">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={compact ? "100vw" : "(max-width: 1024px) 100vw, 42vw"}
          className="object-cover"
          onError={() => setHidden(true)}
        />
      </div>
      <figcaption className="mt-2 text-xs font-medium text-slate-500">
        {image.caption}
      </figcaption>
    </figure>
  );
}
