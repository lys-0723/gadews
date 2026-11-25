"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Square, Download, ArrowRightLeft } from "lucide-react";
import { useLocale } from "../locale-provider";
import { aiFieldLabel } from "@/lib/gadews/i18n/ai-assessment-copy";
import { comparisonRequestJson, comparisonSourceHref, parseComparisonReport } from "@/lib/gadews/ai-assessment/client-report";
import { serializeComparisonReport } from "@/lib/gadews/ai-assessment/comparison-report";
import type { AiAssessmentRequest, ComparisonReport } from "@/lib/gadews/ai-assessment/types";

export function AiAssessmentPanel({request,active=true,revision=0}:{request:AiAssessmentRequest;active?:boolean;revision?:number}) {
 const {locale,t}=useLocale();
 const [selected,setSelected]=useState(false),[standardRevision,setStandardRevision]=useState(0);
 const enabled=request.diseaseId==="wsd"||selected;
 const fingerprint=comparisonRequestJson({diseaseId:request.diseaseId,standardId:request.standardId,input:request.input,context:request.context,revision,standardRevision});
 // A monotonic edit generation prevents A→B→A from reviving a cancelled request or report.
 const [identity,setIdentity]=useState({fingerprint,edit:0});
 const edit=identity.fingerprint===fingerprint?identity.edit:identity.edit+1;
 if(identity.fingerprint!==fingerprint)setIdentity({fingerprint,edit});
 const key=fingerprint+":"+edit;
 const [reportState,setReportState]=useState<{key:string;report:ComparisonReport}|null>(null);
 const [attempt,setAttempt]=useState<{key:string;phase:"requesting"|"error";code?:string}|null>(null);
 const generation=useRef(0),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>{generation.current++;controller.current?.abort();},[key,active,enabled]);
 const report=reportState?.report;
 const outdated=Boolean(reportState&&(reportState.key!==key||!active||!enabled));
 const busy=attempt?.key===key&&attempt.phase==="requesting"&&active&&enabled;
 const error=attempt?.key===key&&attempt.phase==="error"?attempt.code:undefined;
 function stop(){generation.current++;controller.current?.abort();setAttempt({key,phase:"error",code:"cancelled"});}
 async function evaluate(){
  if(busy||!active||!enabled)return;
  controller.current?.abort();const current=++generation.current,abort=new AbortController();controller.current=abort;
  setReportState(null);setAttempt({key,phase:"requesting"});
  try{
   const response=await fetch("/api/assessment/ai",{method:"POST",headers:{"content-type":"application/json"},body:comparisonRequestJson({...request,locale}),signal:abort.signal,cache:"no-store"});
   const value:unknown=await response.json();if(generation.current!==current)return;
   if(!response.ok){const code=value&&typeof value==="object"?(value as {error?:{code?:string}}).error?.code:undefined;setAttempt({key,phase:"error",code:code??"upstream_error"});return;}
   const next=parseComparisonReport(value);if(next.diseaseId!==request.diseaseId||next.standard.id!==request.standardId)throw new Error("Wrong comparison snapshot");
   setReportState({key,report:next});setAttempt(null);
  }catch{if(generation.current===current)setAttempt({key,phase:"error",code:abort.signal.aborted?"cancelled":"invalid_answer"});}
  finally{if(generation.current===current)controller.current=null;}
 }
 function errorText(code:string){
  if(code==="not_configured")return t("站点管理员尚未配置模型。","The site administrator has not configured the model.");
  if(code==="cancelled")return t("AI评估已停止，可重新发起。","AI assessment stopped. You can retry.");
  if(code==="timeout")return t("AI评估超时，请重试。","AI assessment timed out. Please retry.");
  if(code==="busy"||code==="rate_limited")return t("请求较多，请稍后重试。","Too many requests. Please retry shortly.");
  if(code==="invalid_request"||code==="body_too_large")return t("输入格式或数据量不合适，请先核对参数。","Review the input format and data size.");
  return t("暂未获得可用的AI评估，请重试。","No usable AI assessment was returned. Please retry.");
 }
 function download(){
  if(!report||outdated)return;
  const url=URL.createObjectURL(new Blob([serializeComparisonReport(report,false)],{type:"application/json"})),link=document.createElement("a");
  try{link.href=url;link.download="gadews-ai-"+report.diseaseId+"-"+report.assessedAt.replace(/[:.]/g,"-")+".json";document.body.appendChild(link);link.click();}
  finally{link.remove();URL.revokeObjectURL(url);}
 }
 function tone(rank:number|undefined,review=false){
  if(report?.baseline.minimumAttention==="urgent"||rank===3)return"border-red-200 bg-red-50 text-red-950";
  if(review||rank===1)return"border-amber-200 bg-amber-50 text-amber-950";
  if(rank===2)return"border-orange-200 bg-orange-50 text-orange-950";
  if(rank===0)return"border-emerald-200 bg-emerald-50 text-emerald-950";
  return"border-slate-200 bg-slate-50 text-slate-900";
 }
 function grade(level:ComparisonReport["baseline"]["level"]){
  if(level?.rank!==undefined){
   const labels=request.diseaseId==="wsd"?[["低风险","Low risk"],["中风险","Medium risk"],["高风险","High risk"],["很高风险","Very high risk"]]:[["低关注","Low attention"],["中关注","Medium attention"],["高关注","High attention"],["很高关注","Very high attention"]];
   return t(labels[level.rank][0],labels[level.rank][1]);
  }
  if(level)return level.label;
  return report?.baseline.minimumAttention==="urgent"?t("紧急关注","Urgent attention"):t("待完整评估","Awaiting complete assessment");
 }
 return <section aria-label={t("规则与AI对照","Rule and AI comparison")} className="min-w-0 rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-7" data-ai-assessment-state={busy?"requesting":outdated?"outdated":error?"error":report?.validation.state??"idle"}>
  <header className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="flex items-center gap-2 text-xl font-bold"><ArrowRightLeft className="h-5 w-5 text-teal-700" aria-hidden="true"/>{t("规则与AI对照","Rule and AI comparison")}</h3><p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">{t("按当前参数逐项核对分值与依据。点击后，必要参数会发送至已配置的模型服务。","Compare current inputs, points and reasons. Clicking sends the necessary parameters to the configured model service.")}</p></div></header>
  {request.diseaseId==="tilapia-streptococcosis"&&<label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-3 text-base font-semibold text-teal-900"><input type="checkbox" className="h-5 w-5 accent-teal-700" checked={selected} onChange={event=>{setSelected(event.target.checked);setStandardRevision(value=>value+1);}}/>{t("使用罗非鱼评分标准 v0.1","Use Tilapia scoring standard v0.1")}</label>}
  <div className="mt-5 flex flex-wrap gap-3">{busy?<button type="button" onClick={stop} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold"><Square className="h-4 w-4" aria-hidden="true"/>{t("停止AI评估","Stop AI assessment")}</button>:<button type="button" disabled={!active||!enabled} onClick={()=>void evaluate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-base font-semibold text-white hover:bg-teal-900 disabled:opacity-50"><Sparkles className="h-4 w-4" aria-hidden="true"/>{error?t("重试AI评估","Retry AI assessment"):t("AI辅助评估","AI-assisted assessment")}</button>}
   {report&&<button type="button" disabled={outdated} onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-200 px-4 py-2 font-semibold text-teal-800 disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true"/>{t("下载对照 JSON","Download comparison JSON")}</button>}
  </div>
  {busy&&<p role="status" className="mt-4 text-base text-teal-800">{t("正在按评分标准逐项评估…","Evaluating each criterion against the standard…")}</p>}
  {error&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 leading-7 text-amber-950">{errorText(error)}</p>}
  {outdated&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 font-semibold text-amber-950">{t("参数已变化，请重新评估。","Inputs changed. Evaluate again.")}</p>}
  {report&&<div className={outdated?"mt-5 opacity-65":"mt-5"}>
   <p className="mb-4 text-base font-semibold text-teal-900">{locale==="zh-CN"?report.standard.title:report.standard.titleEn}</p>
   {report.baseline.minimumAttention==="urgent"&&<p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-semibold leading-7 text-red-950">{t("已有证据提示需紧急关注，评分不抵消此提示。","Existing evidence requires urgent attention; the score does not cancel it.")}</p>}
   <div className="grid gap-4 md:grid-cols-2">
    <article className={"min-w-0 rounded-2xl border p-5 "+tone(report.baseline.level?.rank)}><h4 className="text-lg font-bold">{t("规则计算","Rule calculation")}</h4><p className="mt-3 text-3xl font-black" data-comparison-baseline>{report.baseline.completeScore??report.baseline.knownSubtotal}<span className="ml-2 text-base font-normal">/ {report.baseline.maxScore}</span></p><p className="mt-2 text-lg font-bold">{grade(report.baseline.level)}</p><p className="mt-2 text-base">{report.baseline.completeScore===null?t("已知分项小计","Known evidence subtotal"):t("完整规则分数","Complete rule score")}</p><p className="mt-2 text-sm">{report.baseline.evaluatedCount} / {report.baseline.totalCount} {t("项可评分","items evaluable")}</p></article>
    <article className={"min-w-0 rounded-2xl border p-5 "+tone(report.validation.level?.rank,report.validation.state==="needs_review")}><h4 className="text-lg font-bold">{t("AI辅助评估","AI-assisted assessment")}</h4><p className="mt-3 text-3xl font-black" data-comparison-ai>{report.validation.state==="needs_review"?t("需复核","Review needed"):report.validation.completeScore??report.validation.knownSubtotal}</p><p className="mt-2 text-lg font-bold">{grade(report.validation.level)}</p><p className="mt-2 text-base">{report.validation.state==="consistent"?t("分项与标准一致","Items match the standard"):report.validation.state==="partial"?t("资料待补全，保留已知分项","Incomplete evidence; known items retained"):t("存在分项差异，请核对依据","Item differences need review")}</p><p className="mt-2 text-sm">{t("辅助筛查，不代表确诊或发病概率。","Screening support, not diagnosis or disease probability.")}</p></article>
   </div>
   <details className="mt-5 rounded-2xl border border-slate-200 p-4"><summary className="min-h-7 cursor-pointer text-base font-semibold text-teal-900">{t("逐项对照","Item comparison")} ({report.baseline.items.length})</summary><div className="mt-4 space-y-3">{report.baseline.items.map(item=>{
    const proposed=report.proposal.items.find(row=>row.itemId===item.itemId),different=report.differences.some(row=>row.itemId===item.itemId);
    return <article key={item.itemId} data-ai-item={item.itemId} className={"min-w-0 rounded-xl border p-4 "+(different?"border-amber-300 bg-amber-50":"border-slate-100 bg-slate-50")}><h5 className="break-words font-semibold">{aiFieldLabel(item.inputFields[0],item.label,locale)}</h5><div className="mt-2 grid grid-cols-2 gap-3 text-base"><p>{t("规则","Rule")}: {item.score??t("未知","Unknown")}</p><p>{t("AI提议","AI proposal")}: {proposed?.score??t("未知","Unknown")}</p></div>{proposed?.reason&&<p className="mt-2 break-words text-base leading-7 text-slate-600">{proposed.reason}</p>}{different&&<p className="mt-2 font-semibold text-amber-900">{t("该项需复核","Review this item")}</p>}<p className="mt-2 break-words text-sm text-slate-500">{item.itemId}{proposed?.branchId?" · "+proposed.branchId:""}</p></article>;
   })}</div></details>
   {report.baseline.quality.issues.length>0&&<details className="mt-4 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-base font-semibold">{t("数据与规则问题","Data and rule issues")} ({report.baseline.quality.issues.length})</summary><ul className="mt-3 space-y-2 text-sm text-slate-600">{report.baseline.quality.issues.map((issue,i)=><li key={i} className="break-words">{aiFieldLabel(issue.field,issue.field,locale)} · {issue.code}</li>)}</ul></details>}
   {report.proposal.generalSupplement&&<details className="mt-4 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-base font-semibold">{t("补充说明 · 不计分","Supplement · not scored")}</summary><p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-slate-600">{report.proposal.generalSupplement}</p></details>}
   <details className="mt-4 rounded-2xl bg-slate-50 p-4"><summary className="cursor-pointer text-base font-semibold">{t("标准与来源","Standard and sources")}</summary><p className="mt-3 break-words text-sm text-slate-600">{report.standard.version} · {report.model.id} · {report.assessedAt}</p><ul className="mt-3 space-y-2 text-sm">{report.sources.map(source=>{const href=comparisonSourceHref(source.href);return <li key={source.id} className="break-words">{href?<a href={href} target="_blank" rel="noopener noreferrer" className="text-teal-800 underline underline-offset-4">{source.title} · {source.id}</a>:source.title}</li>;})}</ul></details>
  </div>}
 </section>;
}
