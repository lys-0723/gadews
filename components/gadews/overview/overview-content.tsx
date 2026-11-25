"use client";

import Link from "next/link";
import { useLocale } from "@/components/gadews/locale-provider";
import { EnvironmentalDataPanel } from "./environmental-data-panel";
import { PublicSnapshotStatus } from "@/components/gadews/risk-map/public-source-status";
import { Waves, Fish, Users, ArrowUpRight } from "lucide-react";

export function OverviewContent() {
  const { t } = useLocale();
  return <>
    <header className="mx-auto max-w-7xl px-4 pb-10 pt-28 lg:px-8">
      <nav aria-label={t("面包屑", "Breadcrumb")} className="mb-8 flex flex-wrap gap-2 text-sm"><Link href="/" className="underline">{t("首页", "Home")}</Link><span aria-hidden="true">/</span><span>{t("全球总览", "Global overview")}</span></nav>
      <h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">{t("水生动物健康的共同背景", "A shared view of aquatic animal health")}</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">{t("把区域气象与公开疾病报告放在一起阅读。这里提供已有快照和工具入口，不代表实时设备监测或实验室确诊。", "Read regional weather alongside public disease reports. This page provides existing snapshots and tool entry points; it does not represent live device monitoring or laboratory confirmation.")}</p>
    </header>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 lg:grid-cols-3 lg:px-8" aria-label={t("同一健康联系", "One Health connections")}>
      {[
        { icon: Waves, title:t("环境", "Environment"), text:t("NASA POWER 提供区域大气背景。气温与塘口水温需分开理解。", "NASA POWER describes the regional atmosphere. Air temperature and pond water temperature must be interpreted separately.") },
        { icon: Fish, title:t("水生动物", "Aquatic animals"), text:t("WAHIS 事件与 QAAD 监测状态保留各自含义，不能直接当作养殖场病例。", "WAHIS events and QAAD surveillance statuses retain their distinct meanings and cannot be treated as farm-level cases.") },
        { icon: Users, title:t("人的决策", "People and decisions"), text:t("风险筛查原型帮助整理输入与证据；实际处置需要专业人员结合现场核实。", "The risk screening prototype organizes inputs and evidence. Practical decisions require professional review and field verification.") },
      ].map(item => <article key={item.title} className="rounded-2xl border border-slate-300 bg-white p-6"><item.icon className="mb-5 h-8 w-8 text-sky-800" aria-hidden="true" /><h2 className="mb-3 text-2xl font-bold text-slate-950">{item.title}</h2><p className="text-lg leading-8 text-slate-700">{item.text}</p></article>)}
    </section>
    <EnvironmentalDataPanel />
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><h2 className="text-3xl font-bold text-slate-950">{t("公开报告与来源状态", "Public reports and source status")}</h2><Link href="/risk-map" className="inline-flex items-center gap-2 rounded-xl bg-sky-900 px-5 py-3 text-base font-bold text-white">{t("打开完整地图", "Open full map")}<ArrowUpRight className="h-5 w-5" /></Link></div>
      <p className="mb-5 text-lg leading-8 text-slate-700">{t("以下为本地公开快照。WAHIS 记录事件；QAAD 记录区域季度或月度状态。覆盖期与获取时间分别显示，无信息不等于阴性。", "These are local public snapshots. WAHIS records events; QAAD records regional quarterly/monthly status. Coverage and retrieval dates are shown separately. No information does not mean negative.")}</p>
      <div className="grid gap-5 md:grid-cols-2">{(["wahis", "qaad"] as const).map(source => <div className="rounded-2xl border border-slate-300 bg-white p-6 text-slate-800" key={source}><PublicSnapshotStatus source={source} enabled /></div>)}</div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8"><h2 className="text-3xl font-bold text-slate-950">{t("接着核对证据与输入", "Review evidence and inputs")}</h2><p className="my-5 text-lg leading-8 text-slate-700">{t("真实设备服务默认关闭。当前可使用独立演示场景或手工输入；未连接训练预测服务，不提供 AI 置信度或暴发概率。", "Live device services are off by default. Independent demonstration scenarios and manual inputs are available. No trained prediction service is connected; AI confidence and outbreak probabilities are not provided.")}</p><div className="flex flex-wrap gap-4"><Link href="/warning-tools" className="rounded-xl bg-sky-900 px-5 py-3 text-base font-bold text-white">{t("进入风险筛查工作台", "Open risk screening workbench")}</Link><Link href="/knowledge-bank" className="rounded-xl border border-sky-900 bg-white px-5 py-3 text-base font-bold text-sky-900">{t("查看知识与文献", "Explore knowledge and literature")}</Link></div></section>
  </>;
}
