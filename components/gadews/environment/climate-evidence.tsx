"use client";
import Image from "next/image";
import { useLocale } from "../locale-provider";
import type { Feed, Site } from "@/lib/gadews/environment/snapshot";
import { names, station } from "@/lib/gadews/environment/snapshot";

export function RainFrame({ feed, site }: { feed: Feed; site: Site }) {
  const { t } = useLocale();
  const frame = feed.frames?.find((item) => item.site === site);
  if (!frame) return null;
  const [zh, en, lat, lon] = station[site];
  const rate = frame.rate;
  return <figure className="my-3 space-y-2">
    <h3 className="font-semibold">{t(...names.imerg)} · {t(zh, en)}</h3>
    <p>{feed.imageryTime} UTC · {t("半小时平均降水率（mm/h）", "Half-hour mean precipitation rate (mm/h)")}</p>
    <div className="relative w-fit border bg-slate-100">
      <Image src={"data:image/png;base64," + frame.png} unoptimized width={257} height={257}
        alt={t(zh + "周边卫星降水率和海岸线", "Satellite precipitation and coastlines around " + en)} />
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black ring-1 ring-white" />
    </div>
    <figcaption className="space-y-1 text-sm">
      <p>{t("圆圈中心", "Circle centre")} {lat}°, {lon}° · {t("东西、南北各覆盖 6°", "6° span in longitude and latitude")}</p>
      <p>{rate ? t("中心像元色标区间", "Centre pixel legend interval") + " · " +
        (rate[0] === "Rain Rate" ? t("雨", "Rain") : t("雪", "Snow")) + " · " +
        (rate[2] === null ? "≥ " + rate[1] : "[" + rate[1] + ", " + rate[2] + ")") + " mm/h"
        : t("中心像元无可判读色阶。透明区域可能是微量降水或无资料。", "No identifiable rate class at the centre. Transparent areas can indicate insignificant precipitation or missing data.")}</p>
      <a className="underline" href={frame.url}>{t("查看 NASA 原图", "NASA source image")}</a>{" · "}
      <a className="underline" href="https://gibs.earthdata.nasa.gov/legends/GPM_Precipitation_Rate_H.svg">{t("降水色标", "Precipitation legend")}</a>
    </figcaption>
  </figure>;
}

export function EnsoOutlook({feed}: {feed: Feed}) {
  const { t } = useLocale();
  if (!feed.seasons) return null;
  return <>
    <p className="my-2">{t("发布月份", "Issue month")} {feed.issueMonth?.slice(0,7)} · {t("赤道太平洋 ENSO 状态的三个月概率，按滚动季度更新展示。", "Probabilities for the equatorial Pacific ENSO state in overlapping three-month periods.")}</p>
    <table className="w-full max-w-2xl text-left text-sm">
      <thead><tr>{[t("时段", "Period"), t("拉尼娜", "La Niña"), t("中性", "Neutral"), t("厄尔尼诺", "El Niño")].map(h => <th key={h} scope="col" className="py-2">{h}</th>)}</tr></thead>
      <tbody>{feed.seasons.map(s => <tr className="border-t" key={s.start}><th scope="row" className="py-1 font-normal">{s.start.slice(0,7)} – {s.end.slice(0,7)}</th><td>{s.cold}%</td><td>{s.neutral}%</td><td>{s.warm}%</td></tr>)}</tbody>
    </table>
    <a className="underline text-sm" href={feed.catalogUrl}>{t("查看 CPC 概率表", "CPC probability table")}</a>
  </>;
}
