"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const OPENING_MS = 1450;
const TITLE_MS = 2200;
const TITLE_START_MS = 620;
const TITLE_SPAN_MS = 1380;

/** The SSR state is always readable. Motion is a short, optional enhancement. */
function useIntroMotion<T extends HTMLElement>(duration: number, content = "") {
  const root = useRef<T>(null);
  const initialContent = useRef(content);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      element.dataset.introState = "complete";
    };
    if (reduced.matches || document.hidden || window.scrollY > 0) {
      finish();
      return;
    }
    element.dataset.introState = "running";
    const timer = window.setTimeout(finish, duration);
    const preference = () => {
      if (reduced.matches) finish();
    };
    const visibility = () => {
      if (document.hidden) finish();
    };
    reduced.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(timer);
      reduced.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      finish();
    };
  }, [duration]);

  useEffect(() => {
    // Switching language should reveal the replacement immediately, not replay it.
    if (content !== initialContent.current && root.current) {
      root.current.dataset.introState = "complete";
    }
  }, [content]);

  return root;
}

const PARTICLES = [
  [12, 63],
  [19, 39],
  [27, 73],
  [33, 25],
  [41, 51],
  [48, 16],
  [55, 79],
  [62, 32],
  [69, 61],
  [77, 19],
  [82, 45],
  [91, 68],
] as const;

/** A non-interactive ocean/light opening, contained entirely inside the hero. */
export function HeroIntro() {
  const root = useIntroMotion<HTMLDivElement>(OPENING_MS);
  return (
    <div
      ref={root}
      className="hero-opening"
      data-intro-state="complete"
      aria-hidden="true"
    >
      <div className="hero-opening-scene">
        <div className="hero-opening-horizon" />
        <div className="hero-opening-orbit" />
        <div className="hero-opening-orbit hero-opening-orbit-outer" />
        <div className="hero-opening-sweep" />
        <div className="hero-opening-particles">
          {PARTICLES.map(([x, y], index) => (
            <i
              key={index}
              style={
                {
                  "--particle-x": `${x}%`,
                  "--particle-y": `${y}%`,
                  animationDelay: `${index * 32}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="hero-opening-brand">
          <div className="hero-opening-wordmark">
            {[..."GADEWS"].map((letter, index) => (
              <span
                key={index}
                style={{ animationDelay: `${140 + index * 70}ms` }}
              >
                {letter}
              </span>
            ))}
          </div>
          <div className="hero-opening-health">ONE WATER · ONE HEALTH</div>
        </div>
      </div>
    </div>
  );
}

/** One semantic heading, with a measured full line beneath decorative letters. */
export function HeroTitle({ lines }: { lines: readonly [string, string] }) {
  const root = useIntroMotion<HTMLHeadingElement>(TITLE_MS, lines.join("\n"));
  const count = [...lines[0], ...lines[1]].length;
  const step = Math.min(72, TITLE_SPAN_MS / Math.max(1, count - 1));
  return (
    <h1
      ref={root}
      id="hero-title"
      className="hero-title"
      data-intro-state="complete"
    >
      {lines.map((line, lineIndex) => {
        const start = lineIndex === 0 ? 0 : [...lines[0]].length;
        return (
          <span
            key={lineIndex}
            className={`hero-title-line${lineIndex === 1 ? " soft" : ""}`}
          >
            <span className="hero-title-full">{line}</span>
            <span className="hero-title-letters" aria-hidden="true">
              {[...line].map((character, index) => (
                <span
                  key={index}
                  className="hero-title-character"
                  style={{
                    animationDelay: `${TITLE_START_MS + (start + index) * step}ms`,
                  }}
                >
                  {character}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </h1>
  );
}
