"use client";
/* Real ecological photography is used as context, never as disease evidence. */
/* eslint-disable @next/next/no-img-element */
import { useState, type CSSProperties } from "react";
import { useCopy, useLocale } from "@/components/gadews/locale-provider";
import { homeCopy } from "@/lib/gadews/i18n/home";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { SiteFooter } from "@/components/gadews/site-footer";
import { ReportGlobe } from "./report-globe";
import { OceanFilm } from "./ocean-film";
import { RecentSnapshotEvents } from "./recent-snapshot-events";
import { useOceanNarrative } from "./ocean-atmosphere";
import { HeroIntro, HeroTitle } from "./hero-intro";
import { LifeParticles } from "./life-particles";

export function HomePage() {
  const { t } = useLocale();
  const c = useCopy(homeCopy);
  const root = useOceanNarrative();
  const [globeAccess, setGlobeAccess] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={root} className="ocean-home">
      <StickyHeader variant="dark" />
      <div className="page-progress" aria-hidden="true" />
      <main>
        <section
          className="hero ocean-hero"
          id="top"
          aria-labelledby="hero-title"
        >
          <div className="hero-grain" aria-hidden="true" />
          <HeroIntro />
          <div className="hero-copy">
            <HeroTitle
              lines={[
                t("感知水域变化，", "A changing ocean."),
                t("守护同一健康。", "A shared future."),
              ]}
            />
            <p className="hero-intro">
              {t(
                "从一片水域，到同一个地球。连接环境、养殖与疫病证据，让值得关注的变化更早被看见。",
                "From one body of water to one shared planet. Connecting environmental, aquaculture and disease evidence to make important changes easier to see.",
              )}
            </p>
            <div className="hero-actions">
              <a href="#reports" className="primary-link">
                {t("探索全球报告", "Explore reports")}
                <span className="link-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a href="#prototype" className="secondary-link">
                {t("了解预警原型", "Our prototype")}
                <span className="link-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
            <p className="hero-disclaimer">
              {t(
                "公开历史资料，非实时疫情。当前预警为规则与知识草案原型，未连接训练预测服务。",
                "Historical public records, not real-time outbreaks. Current assessments use rules and draft knowledge; no trained prediction service is connected.",
              )}
            </p>
          </div>
          <div className="globe-stage">
            <ReportGlobe accessTarget={globeAccess} />
          </div>
          <div className="globe-access-slot" ref={setGlobeAccess}>
            <div className="globe-caption">
              <span>
                {t(
                  "公开报告 · 国家或地区中心点",
                  "Public reports · Country or territory centroids",
                )}
              </span>
            </div>
          </div>
          <LifeParticles />
        </section>
        <section
          className="one-health"
          id="one-health"
          aria-labelledby="health-title"
        >
          <div className="section-inner">
            <div className="health-header">
              <h2 className="section-heading" id="health-title" data-reveal="">
                <span>{c("h002")}</span>
                <span>{c("h003")}</span>
              </h2>
              <p
                className="section-intro"
                data-reveal=""
                style={{ "--reveal-delay": "120ms" } as CSSProperties}
              >
                {c("h004")}
              </p>
            </div>
            <div className="health-photos">
              <figure className="photo-block ocean-photo" data-reveal="">
                <div className="photo-clip" data-parallax="0.075">
                  <img
                    src="/images/pexels-pham-t-tri-139436170-16296413.jpg"
                    alt={t(
                      "蓝绿色海水上的养殖网具与作业小船",
                      "Aquaculture gear and a working boat on turquoise water",
                    )}
                    loading="lazy"
                  />
                  <div className="photo-title">
                    <h3>{c("h005")}</h3>
                    <span>{c("h006")}</span>
                  </div>
                </div>
                <figcaption>{c("h007")}</figcaption>
              </figure>
              <figure
                className="photo-block farm-photo"
                data-reveal=""
                style={{ "--reveal-delay": "150ms" } as CSSProperties}
              >
                <div className="photo-clip" data-parallax="-0.065">
                  <img
                    src="/images/pexels-nairodreyes-20712511.jpg"
                    alt={t(
                      "海岸附近的海水养殖网箱",
                      "Marine aquaculture cages near a coast",
                    )}
                    loading="lazy"
                  />
                  <div className="photo-title">
                    <h3>{c("h008")}</h3>
                  </div>
                </div>
                <figcaption>{c("h009")}</figcaption>
              </figure>
            </div>
            <div className="health-foot" data-reveal="">
              <div className="health-connections">
                <span>{c("h010")}</span>
                <i aria-hidden="true">↔</i>
                <span>{c("h011")}</span>
                <i aria-hidden="true">↔</i>
                <span>{c("h012")}</span>
              </div>
              <p>{c("h013")}</p>
            </div>
          </div>
        </section>

        <OceanFilm></OceanFilm>

        <section
          className="evidence"
          id="prototype"
          aria-labelledby="evidence-title"
        >
          <div className="section-inner">
            <div className="evidence-layout">
              <div className="evidence-stage">
                <h2 id="evidence-title" data-reveal="">
                  <span>{c("h015")}</span>
                  <span style={{ color: "#e4f1f5" } as CSSProperties}>
                    {c("h016")}
                  </span>
                </h2>
                <p data-reveal="">{c("h017")}</p>
                <div
                  className="signal-diagram"
                  aria-label={t(
                    "环境、病原、证据到风险筛查的路径",
                    "Environment, pathogens and evidence leading to risk review",
                  )}
                >
                  <svg viewBox="0 0 600 285" fill="none" aria-hidden="true">
                    <ellipse
                      className="signal-orbit"
                      cx="302"
                      cy="137"
                      rx="265"
                      ry="93"
                    ></ellipse>
                    <path
                      className="trace-base"
                      d="M63 140C125 140 127 79 209 79S303 189 384 189s88-49 151-49"
                    ></path>
                    <path
                      className="trace-active"
                      d="M63 140C125 140 127 79 209 79S303 189 384 189s88-49 151-49"
                      pathLength="1000"
                    ></path>
                    <g
                      className="signal-node is-current"
                      data-node="0"
                      transform="translate(63 140)"
                    >
                      <circle r="30"></circle>
                      <path d="M-16 2c5-7 10 7 16 0s11 7 16 0m-30 9c5-7 10 7 16 0s10 7 14 0M-2-17c-8 9-9 13-1 13s8-4 1-13Z"></path>
                      <text x="0" y="59">
                        {c("h018")}
                      </text>
                    </g>
                    <g
                      className="signal-node"
                      data-node="1"
                      transform="translate(209 79)"
                    >
                      <circle r="30"></circle>
                      <circle r="9"></circle>
                      <path d="M0-17v5M0 12v5M-17 0h5m24 0h5m-29-12 4 4m16 16 4 4m-24 0 4-4m16-16 4-4"></path>
                      <text x="0" y="59">
                        {c("h019")}
                      </text>
                    </g>
                    <g
                      className="signal-node"
                      data-node="2"
                      transform="translate(384 189)"
                    >
                      <circle r="30"></circle>
                      <path d="M-12-16H6l7 7v25h-25v-32Zm18 0v8h7M-6-2H7M-6 5H7m-13 7H2"></path>
                      <text x="0" y="59">
                        {c("h020")}
                      </text>
                    </g>
                    <g
                      className="signal-node"
                      data-node="3"
                      transform="translate(535 140)"
                    >
                      <circle r="30"></circle>
                      <path d="m-14-1 9 10 20-21M-17 13h34"></path>
                      <text x="0" y="59">
                        {c("h021")}
                      </text>
                    </g>
                  </svg>
                </div>
                <p className="stage-status">{c("h022")}</p>
                <p className="prototype-note">{c("h023")}</p>
              </div>
              <div className="evidence-steps">
                <article className="evidence-step is-current" data-step="0">
                  <h3>{c("h024")}</h3>
                  <p>{c("h025")}</p>
                  <p className="step-detail">{c("h026")}</p>
                </article>
                <article className="evidence-step" data-step="1">
                  <h3>{c("h027")}</h3>
                  <p>{c("h028")}</p>
                  <p className="step-detail">{c("h029")}</p>
                </article>
                <article className="evidence-step" data-step="2">
                  <h3>{c("h030")}</h3>
                  <p>{c("h031")}</p>
                  <p className="step-detail">{c("h032")}</p>
                </article>
                <article className="evidence-step" data-step="3">
                  <h3>{c("h033")}</h3>
                  <p>{c("h034")}</p>
                  <p className="step-detail">{c("h035")}</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section
          className="reports"
          id="reports"
          aria-labelledby="reports-title"
        >
          <div className="section-inner">
            <div className="reports-header">
              <h2 className="section-heading" id="reports-title" data-reveal="">
                <span>{c("h037")}</span>
                <span>{c("h038")}</span>
              </h2>
              <p
                className="section-intro"
                data-reveal=""
                style={{ "--reveal-delay": "120ms" } as CSSProperties}
              >
                {c("h039")}
              </p>
            </div>
            <div className="reports-layout">
              <div data-reveal="">
                <RecentSnapshotEvents></RecentSnapshotEvents>
              </div>
              <figure
                className="report-feature"
                data-reveal=""
                style={{ "--reveal-delay": "180ms" } as CSSProperties}
              >
                <div className="photo-clip" data-parallax="0.06">
                  <img
                    src="/images/pexels-andromeda99-36922184.jpg"
                    alt={t(
                      "水下甲壳类动物的真实生态特写",
                      "Ecological close-up of an underwater crustacean",
                    )}
                    loading="lazy"
                  />
                  <div className="image-label">{c("h040")}</div>
                </div>
                <figcaption>
                  <h3>{c("h041")}</h3>
                  <p>{c("h042")}</p>
                </figcaption>
              </figure>
            </div>
            <div className="report-sources" data-reveal="">
              <span>{c("h043")}</span>
              <div className="source-names">
                <a
                  href="https://wahis.woah.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WOAH WAHIS<small>{c("h044")}</small>
                </a>
                <a
                  href="https://enaca.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  NACA · QAAD<small>{c("h045")}</small>
                </a>
                <a
                  href="https://power.larc.nasa.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  NASA POWER<small>{c("h046")}</small>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          className="closing"
          id="explore"
          aria-labelledby="closing-title"
        >
          <div className="closing-copy">
            <h2 id="closing-title" data-reveal="">
              <span style={{ color: "#e8f3f6" } as CSSProperties}>
                {c("h048")}
              </span>
              <span>{c("h049")}</span>
            </h2>
            <p data-reveal="">{c("h050")}</p>
            <div className="hero-actions" data-reveal="">
              <a
                className="primary-link"
                href="/warning-tools"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{c("h051")}</span>
                <span className="link-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a
                className="secondary-link"
                href="/why-gadews-matters"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{c("h052")}</span>
                <span className="link-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
