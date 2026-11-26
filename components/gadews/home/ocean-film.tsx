"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/gadews/locale-provider";
import { shouldAutoplayMedia } from "@/lib/gadews/media-policy";

export function OceanFilm() {
  const { t } = useLocale();
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const play = () => {
    const element = video.current;
    if (!element) return;
    void element
      .play()
      .then(() => {
        if (!visible.current || document.hidden) element.pause();
      })
      .catch(() => setPlaying(false));
  };
  useEffect(() => {
    const element = video.current,
      container = section.current;
    if (!element || !container) return;
    const narrow = window.matchMedia("(max-width: 760px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget & { saveData?: boolean };
      }
    ).connection;
    const update = () => {
      const allowed = shouldAutoplayMedia({
        visible: visible.current,
        hidden: document.hidden,
        narrow: narrow.matches,
        reducedMotion: reduced.matches,
        saveData: Boolean(connection?.saveData),
        userPaused: userPaused.current,
      });
      if (allowed)
        void element
          .play()
          .then(() => {
            if (!visible.current || document.hidden) element.pause();
          })
          .catch(() => {});
      else if (
        !visible.current ||
        document.hidden ||
        reduced.matches ||
        connection?.saveData
      )
        element.pause();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              visible.current =
                entries[0].isIntersecting &&
                entries[0].intersectionRatio >= 0.35;
              update();
            },
            { threshold: [0, 0.35] },
          );
    observer?.observe(container);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    narrow.addEventListener("change", update);
    connection?.addEventListener("change", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      reduced.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
      element.pause();
    };
  }, []);
  return (
    <section
      ref={section}
      className="ocean-film"
      id="ocean-life"
      aria-labelledby="ocean-life-title"
    >
      <video
        ref={video}
        id="ocean-life-film"
        muted
        loop
        playsInline
        preload="none"
        poster="/media/gadews/ocean-life-poster.jpg"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          setPlaying(false);
        }}
        aria-hidden="true"
      >
        <source src="/media/gadews/ocean-life.mp4" type="video/mp4" />
      </video>
      <div className="film-copy" data-reveal>
        <span>
          {t(
            "OCEAN LIFE · 真实生态影像",
            "OCEAN LIFE · REAL UNDERWATER FOOTAGE",
          )}
        </span>
        <h2 id="ocean-life-title">
          {t(
            "海洋的健康，\n与我们相连。",
            "A healthy ocean.\nA shared future.",
          )}
        </h2>
        <p>
          {t(
            "从鱼群与栖息环境，到水产养殖和人的生计。把彼此关联的健康放在一起理解，是我们观察变化的起点。",
            "From fish and habitats to aquaculture and livelihoods. Connected health is where our observation begins.",
          )}
        </p>
      </div>
      <div className="film-controls">
        <div className="film-caption">
          {t("生态影像", "Ecological footage")} · JUN HO LEE / Pexels ·{" "}
          <a
            href="https://www.pexels.com/video/underwater-school-of-fish-in-motion-33924271/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("来源", "Source")}
          </a>
          {failed && (
            <span role="status">
              {" "}
              ·{" "}
              {t(
                "影像暂不可用，保留静态海报。",
                "Footage unavailable; the poster remains visible.",
              )}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-pressed={playing}
          onClick={() => {
            if (video.current?.paused) {
              userPaused.current = false;
              play();
            } else {
              userPaused.current = true;
              video.current?.pause();
            }
          }}
        >
          {playing
            ? t("暂停影像", "Pause footage")
            : t("播放生态影像", "Play footage")}
        </button>
      </div>
    </section>
  );
}
