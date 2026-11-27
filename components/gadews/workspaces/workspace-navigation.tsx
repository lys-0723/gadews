"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Building2, Map, Waves } from "lucide-react";
import { useLocale } from "../locale-provider";
import type { Role } from "@/lib/accounts/policy";
import { roleNames } from "@/lib/accounts/display";
import styles from "./workspaces.module.css";

// Public workspace routes today; these role keys also identify their future account destinations.
const workspaces = [
  { path: "/workspaces/farm", name: ["我的养殖场", "My farm"], role: "member",
    task: ["查看塘口观测、区域环境和病害筛查。", "Review pond observations, nearby conditions and disease screening."], icon: Waves },
  { path: "/workspaces/regional", name: ["区域监测站", "Regional monitoring station"], role: "region",
    task: ["按水域和日期查证据，安排片区复核。", "Inspect evidence by area and date to plan local checks."], icon: Map },
  { path: "/workspaces/national", name: ["国家监测总览", "National surveillance"], role: "country",
    task: ["汇总公开报告，对照本国各代表地区的监测覆盖。", "Review public reports and monitoring coverage across reference areas."], icon: Building2 },
] as const satisfies ReadonlyArray<{
  path: string; name: readonly [string,string]; role: Exclude<Role, "system">;
  task: readonly [string,string]; icon: typeof Waves;
}>;

export function WorkspaceDirectory() {
  const { t } = useLocale();
  return <section id="workspaces" aria-labelledby="workspace-directory-title" className={styles.directory}>
    <div className={styles.directoryInner}>
      <h2 id="workspace-directory-title">{t("选择工作区", "Choose a workspace")}</h2>
      <nav aria-label={t("公开角色工作区", "Public role workspaces")} className={styles.cards}>
        {workspaces.map(({path, name, role, task, icon: Icon}) => <Link href={path} key={path} className={styles.card}>
          <span className={styles.role}><Icon size={18} aria-hidden="true"/>{t(...roleNames[role])}</span>
          <span className={styles.cardName}>{t(name[0],name[1])}<ArrowUpRight size={21} aria-hidden="true"/></span>
          <span className={styles.task}>{t(task[0],task[1])}</span>
        </Link>)}
      </nav>
    </div>
  </section>;
}

export function WorkspaceNavigation() {
  const {t} = useLocale(), pathname = usePathname();
  return <nav className={styles.bar} aria-label={t("切换公开工作区", "Switch public workspace")}>
    <div className={styles.barInner}><span className={styles.barLabel}>{t("公开工作区", "Public workspaces")}</span>{workspaces.map(({path,role,icon: Icon}) =>
      <Link key={path} href={path} aria-current={pathname === path ? "page" : undefined}>
        <Icon size={16} aria-hidden="true"/>{t(...roleNames[role])}
      </Link>)}</div>
  </nav>;
}

export function PublicResources() {
  const {t}=useLocale();
  return <nav className={styles.resources} aria-label={t("公共模块", "Public resources")}>
    <Link href="/">{t("首页","Home")}</Link>
    <Link href="/risk-map">{t("全球地图","Global map")}</Link>
    <Link href="/warning-tools">{t("风险预警模型","Risk assessment tools")}</Link>
    <Link href="/knowledge-bank/literature">{t("公共文献库","Public literature library")}</Link>
  </nav>;
}
