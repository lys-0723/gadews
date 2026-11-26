"use client";
import Link from "next/link";
import { Brand } from "./sticky-header";
import { useLocale } from "./locale-provider";

export function SiteFooter() {
  const { t } = useLocale();
  return <footer className="site-footer"><div className="site-footer-top"><div><Brand dark /></div><nav className="site-footer-links" aria-label={t("页脚导航", "Footer navigation")}><Link href="/">{t("首页", "Home")}</Link><Link href="/risk-map">{t("全球报告", "Global reports")}</Link><Link href="/warning-tools">{t("预警工具", "Warning tools")}</Link><Link href="/knowledge-bank">{t("知识资源", "Knowledge")}</Link></nav></div><div className="site-footer-note"><p>{t("公开资料是历史快照，地图点位为国家或地区中心点。当前预警为规则与知识草案原型，不提供发病概率；专业调查与实验室检测用于进一步复核。", "Public records are historical snapshots at country or territory centroids. Current assessments use rules and draft knowledge, with no disease probability. Professional investigation and laboratory evidence support further review.")}</p></div></footer>;
}
