"use client";
/* eslint-disable @next/next/no-img-element */
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef } from "react";
import { useLocale } from "@/components/gadews/locale-provider";
import type { LifePhotoSource, LifeStage } from "@/lib/gadews/life-visuals";

// Small verified provenance remains available even if the separately fetched manifest fails.
const fallbackSources: LifePhotoSource[] = [
  { id: "tilapia", nameZh: "尼罗罗非鱼", nameEn: "Nile tilapia", scientificName: "Oreochromis niloticus", photo: "tilapia-reference.jpg", originalPhoto: "tilapia-original.jpg", fallback: "tilapia-static.svg", sourceUrl: "https://commons.wikimedia.org/wiki/File:OreoniloticusMax.jpg", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", credit: "Max Taub / FishBase, via Wikimedia Commons" },
  { id: "shrimp", nameZh: "凡纳滨对虾（幼虾）", nameEn: "Whiteleg shrimp (juvenile)", scientificName: "Penaeus vannamei", photo: "shrimp-reference.jpg", originalPhoto: "shrimp-original.jpg", fallback: "shrimp-static.svg", sourceUrl: "https://commons.wikimedia.org/wiki/File:Penaeus_vannamei_01.jpg", license: "Public domain · USDA ARS", licenseUrl: "https://commons.wikimedia.org/wiki/File:Penaeus_vannamei_01.jpg#Licensing", credit: "USDA Agricultural Research Service · Image K3507-12" },
];
export function PhotoReferenceDialog({ stage, source, open, onOpenChange }: { stage: LifeStage; source?: LifePhotoSource; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { locale, t } = useLocale();
  const trigger = useRef<HTMLButtonElement>(null), skipRestore = useRef(false);
  useEffect(() => {
    const assistant = (event: Event) => { if ((event as CustomEvent<{ open: boolean }>).detail?.open) skipRestore.current = true; };
    window.addEventListener("gadews:assistant-visibility", assistant);
    return () => window.removeEventListener("gadews:assistant-visibility", assistant);
  }, []);
  const animal = stage < 2, photo = source ?? fallbackSources[stage === 1 ? 1 : 0];
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Trigger asChild><button ref={trigger} type="button" onClick={() => { skipRestore.current = false; }}>{animal ? t("原图对照", "Photo reference") : t("形态说明", "Morphology notes")}</button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="life-reference-backdrop" /><Dialog.Content className="life-reference-content" onCloseAutoFocus={event => {
      event.preventDefault();
      if (skipRestore.current) return;
      const button = trigger.current, rect = button?.getBoundingClientRect();
      if (button?.isConnected && rect && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) button.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>(".gadews-header a")?.focus({ preventScroll: true });
    }}>
      <Dialog.Title>{animal ? `${locale === "zh-CN" ? photo.nameZh : photo.nameEn} · ${photo.scientificName}` : stage === 2 ? t("细胞结构 · 简化示意", "Cell structure · simplified schematic") : t("病原形态 · 文献依据", "Pathogen morphology · references")}</Dialog.Title>
      <Dialog.Description>{animal ? t("同一照片的轮廓与纹理采样。浅层点云起伏不表示恢复了三维解剖结构。", "Contour and texture sampled from the same photograph. Shallow point depth does not reconstruct three-dimensional anatomy.") : t("程序生成的结构示意，非显微照片、病原鉴定或诊断结果。", "Procedural structure schematics, not micrographs, pathogen identification or diagnosis.")}</Dialog.Description>
      {animal ? <><div className="life-reference-grid"><figure><img src={`/media/gadews/life/${photo.photo}`} alt={locale === "zh-CN" ? photo.nameZh : photo.nameEn} /><figcaption>{t("来源照片（取景裁剪）", "Source photograph (cropped view)")}</figcaption></figure><figure><img className="life-reference-outline" src={`/media/gadews/life/${photo.fallback}`} alt={t("同一照片的采样轮廓", "Sampled outline of the same photograph")} /><figcaption>{t("照片采样轮廓", "Photo-derived sampled outline")}</figcaption></figure></div><p>{stage === 1 ? t("只采样上方真实幼虾，排除下方倒影与背景；触须和附肢沿原图可见路径保留。", "Only the upper real juvenile is sampled; the reflection and background are excluded. Antennae and appendages follow visible photographic paths.") : t("保留完整侧面轮廓与鳍尾，背景不参与采样。", "The full side profile, fins and tail are retained; the background is excluded.")}</p><p className="life-photo-credit">{photo.credit}</p><div className="life-reference-links"><a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">{t("原始来源", "Original source")}</a><a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a><a href={`/media/gadews/life/${photo.originalPhoto}`} target="_blank" rel="noopener noreferrer">{t("未裁剪原图", "Uncropped photograph")}</a></div></> : stage === 2 ? <p>{t("细胞膜、细胞核与细胞器经过简化，不对应某个实测细胞，也不代表实际比例。", "The membrane, nucleus and organelles are simplified general structures, not a measured cell or anatomical scale.")}</p> : <><p>{t("链状球菌参考 Streptococcus iniae 文献中的成链形态；杆状病毒参考 ICTV 对 WSSV 椭圆至杆状包膜粒子及末端细丝的描述。两种形态分别示意，大小不代表实际比例。", "Chain cocci follow published Streptococcus iniae morphology. The bacilliform virion follows ICTV’s description of ellipsoid-to-bacilliform WSSV particles and a terminal thread. The two forms are separate schematics and are not drawn to a shared scale.")}</p><div className="life-reference-links"><a href="https://ictv.global/report/chapter/nimaviridae/nimaviridae" target="_blank" rel="noopener noreferrer">ICTV · Nimaviridae / WSSV</a><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC1828557/" target="_blank" rel="noopener noreferrer">Streptococcus iniae · {t("原始研究", "primary research")}</a></div></>}
      <Dialog.Close className="life-reference-close" aria-label={t("关闭原图与形态说明", "Close photo and morphology reference")}>×</Dialog.Close>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
