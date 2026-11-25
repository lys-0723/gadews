"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useLocale } from "./locale-provider";

const links = [
  ["/", "首页", "Home"],
  ["/overview", "环境总览", "Overview"],
  ["/risk-map", "全球报告", "Global reports"],
  ["/warning-tools", "预警工具", "Warning tools"],
  ["/knowledge-bank", "知识资源", "Knowledge"],
  ["/accounts", "账号管理", "Accounts"],
  ["/why-gadews-matters", "走近 GADEWS", "About GADEWS"],
] as const;

export function Brand({ dark = false }: { dark?: boolean }) {
  const { t } = useLocale();
  return <Link href="/" className={`site-brand ${dark ? "brand-dark" : ""}`} aria-label={t("GADEWS 首页", "GADEWS Home")}>
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 27C8 15 19 7 39 7c-1 20-8 31-21 31M10 32C17 23 26 16 36 11M8 35c8-5 13 5 21 0s12-5 15-3M5 41c8-5 13 5 21 0s12-5 15-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="m19 25-1-11m8 4 10 1" stroke="currentColor" strokeWidth="1.4"/></svg>
    <span><span className="brand-name">GAD<span>EWS</span></span></span>
  </Link>;
}

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return <div className="site-language" aria-label="Chinese / English"><button type="button" aria-pressed={locale === "zh-CN"} onClick={() => setLocale("zh-CN")}>Chinese</button><span aria-hidden="true">/</span><button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button></div>;
}

export function StickyHeader({ variant = "light" }: { variant?: "light" | "dark" | "map" }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 24);
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape" && open) { setOpen(false); trigger.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (open && event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    scroll(); window.addEventListener("scroll", scroll, { passive: true }); document.addEventListener("keydown", keydown); document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("scroll", scroll); document.removeEventListener("keydown", keydown); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  const nav = links.map(([href, zh, en]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>{t(zh, en)}</Link>);
  return <header ref={root} className={`gadews-header header-${variant} ${scrolled ? "is-scrolled" : ""} ${open ? "menu-open" : ""}`}>
    <Brand dark={variant !== "light"} />
    <nav className="site-desktop-nav" aria-label={t("主导航", "Main navigation")}>{nav}</nav>
    <LanguageSwitch />
    <button ref={trigger} type="button" className="site-menu-trigger" onClick={() => setOpen(value => !value)} aria-controls="site-mobile-nav" aria-expanded={open} aria-label={open ? t("关闭导航菜单", "Close navigation menu") : t("打开导航菜单", "Open navigation menu")}>{open ? <X /> : <Menu />}</button>
    {open && <nav id="site-mobile-nav" className="site-mobile-nav" aria-label={t("移动导航", "Mobile navigation")}>{nav}<Link href="/knowledge-bank/literature" onClick={() => setOpen(false)}>{t("文献库", "Literature library")}<ArrowUpRight size={19} /></Link></nav>}
  </header>;
}
