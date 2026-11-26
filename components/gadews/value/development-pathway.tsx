"use client";

import Image from "next/image";
import * as Tabs from "@radix-ui/react-tabs";
import { useLocale } from "@/components/gadews/locale-provider";

const milestones = [
  { id: "initiative", title: ["FAO 倡议", "FAO initiative"], detail: ["围绕水生动物疫病早期预警开展框架探索，连接养殖现场信号、区域疫病资料与协同响应需求。", "The initiative explores an aquatic disease early warning framework linking farm-level signals, regional disease information and coordinated response needs."] },
  { id: "qingdao", title: ["青岛技术研讨会", "Qingdao workshop"], detail: ["专家讨论预警概念、系统范围、技术模块、资料需求及隐私问题，为后续路线图提供技术意见。", "Experts discussed the early warning concept, system scope, technical modules, data needs and privacy considerations to inform the roadmap."], image: "/images/fao-qingdao.jpg", alt: ["青岛 EWS 技术研讨会合影", "Group photo from the Qingdao EWS technical workshop"] },
  { id: "rome", title: ["罗马研讨会", "Rome workshop"], detail: ["在前期讨论基础上复核技术路线图，继续讨论架构、治理、资料流程、分阶段实施与试点设计。", "Building on earlier discussions, the workshop reviewed the technical roadmap, architecture, governance, data flows, phased implementation and pilot design."], image: "/images/fao-rome.png", alt: ["罗马 EWS 研讨会合影", "Group photo from the Rome EWS workshop"] },
  { id: "twg", title: ["技术工作组", "Technical working group"], detail: ["持续细化知识结构、专家复核、资料治理和模型策略，并协调后续工作。", "The technical working group continues to refine knowledge structures, expert review, data governance and model strategy, and coordinate subsequent work."] },
  { id: "pilot", title: ["原型与试点规划", "Prototype and pilot planning"], detail: ["逐步完善报告、地图、知识与规则工作流。现场试点、验证结果与后续扩展仍属于待完成工作。", "The plan develops reporting, maps, knowledge and rule workflows in stages. Field pilots, validation results and later expansion remain future work."] },
] as const;

export function ValueDevelopmentPathway() {
  const { t } = useLocale();
  return <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20"><p className="text-sm font-semibold tracking-widest text-[#14556c]">{t("建设历程", "DEVELOPMENT PATHWAY")}</p><h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{t("从专家讨论，走向可核对的原型。", "From expert consultation to a reviewable prototype.")}</h2><p className="mt-5 max-w-3xl text-[17px] leading-8 text-slate-700">{t("保留研讨与工作组的建设路径。路线图和试点计划不代表已取得现场验证结果。", "Follow the workshops and working-group process. A roadmap and pilot plan do not establish field validation results.")}</p>
    <Tabs.Root defaultValue="qingdao" className="mt-9 rounded-3xl border border-slate-300 bg-white p-5 sm:p-8"><Tabs.List className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label={t("建设阶段", "Development stages")}>{milestones.map((milestone, index) => <Tabs.Trigger key={milestone.id} value={milestone.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700 data-[state=active]:border-[#103d50] data-[state=active]:bg-[#103d50] data-[state=active]:text-white"><span aria-hidden="true" className="font-mono">0{index + 1}</span>{t(milestone.title[0], milestone.title[1])}</Tabs.Trigger>)}</Tabs.List>
      {milestones.map(milestone => <Tabs.Content key={milestone.id} value={milestone.id} className="mt-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14556c]"><div className={`grid gap-8 ${"image" in milestone ? "lg:grid-cols-2 lg:items-center" : "max-w-3xl"}`}><div><h3 className="text-2xl font-semibold text-[#153d4c]">{t(milestone.title[0], milestone.title[1])}</h3><p className="mt-4 text-[17px] leading-8 text-slate-700">{t(milestone.detail[0], milestone.detail[1])}</p></div>{"image" in milestone && <figure><div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#eaf3f5]"><Image src={milestone.image} alt={t(milestone.alt[0], milestone.alt[1])} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-contain" /></div><figcaption className="mt-3 text-sm leading-6 text-slate-600">{t(milestone.alt[0], milestone.alt[1])}</figcaption></figure>}</div></Tabs.Content>)}
    </Tabs.Root>
  </section>;
}
