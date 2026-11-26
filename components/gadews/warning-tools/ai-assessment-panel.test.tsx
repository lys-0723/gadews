import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
import { completeTilapia, FIXTURE_NOW } from "@/lib/gadews/ai-assessment/test-fixtures";
import { evaluateTilapiaDemo, tilapiaScoringRubric } from "@/lib/gadews/ai-assessment/tilapia-demo";
import type { AiAssessmentRequest, ComparisonReport } from "@/lib/gadews/ai-assessment/types";
installDom();
const request=():Extract<AiAssessmentRequest,{diseaseId:"tilapia-streptococcosis"}>=>({diseaseId:"tilapia-streptococcosis",locale:"en",standardId:"tilapia-demo-score-v0.1",input:completeTilapia(),context:{dataMode:"manual",now:FIXTURE_NOW}});
function report():ComparisonReport{
 const b=evaluateTilapiaDemo(completeTilapia(),{now:FIXTURE_NOW});
 return {reportType:"gadews-ai-assessment-comparison",schemaVersion:"1.0",diseaseId:"tilapia-streptococcosis",inputSnapshot:{},contextSnapshot:{},inputHash:"fixture-hash",assessedAt:FIXTURE_NOW,standard:tilapiaScoringRubric,model:{id:"fixture",protocol:"responses"},baseline:b,proposal:{items:b.items.map(({itemId,branchId,status,score})=>({itemId,branchId,status,score,reason:"Fixture explanation <script>not executable</script>"})),generalSupplement:"General fixture text"},validation:{state:"consistent",knownSubtotal:0,completeScore:0,level:b.level},differences:[],sources:tilapiaScoringRubric.sources};
}
async function feature(){const m=await import("./ai-assessment-panel").catch(()=>null);assert.ok(m,"AI comparison panel must exist");return m;}
test("explicit version selection and click produce bilingual comparison without the removed label",async()=>{
 const React=await import("react"),{render,screen,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");
 const {AiAssessmentPanel}=await feature(),{LocaleProvider}=await import("../locale-provider");const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_url,init)=>{calls++;assert.equal(JSON.parse(String(init!.body)).locale,"zh-CN");return Response.json(report());};
 try{render(<LocaleProvider initialLocale="zh-CN"><AiAssessmentPanel request={request()} /></LocaleProvider>);const user=userEvent.setup();assert.equal(calls,0);
 assert.equal((screen.getByRole("button",{name:"AI辅助评估"})as HTMLButtonElement).disabled,true);
 await user.click(screen.getByRole("checkbox",{name:"使用罗非鱼评分标准 v0.1"}));await user.click(screen.getByRole("button",{name:"AI辅助评估"}));
 await screen.findByText("分项与标准一致");assert.equal(calls,1);assert.equal(document.body.textContent!.includes("未审核演示标准"),false);
 assert.ok(screen.getByText("规则计算"));assert.ok(screen.getByText("AI辅助评估",{selector:"h4"}));assert.equal(document.querySelector("script"),null);
 }finally{globalThis.fetch=original;cleanup();}
});
test("errors, retry, stop and late replies never create fake successful scores",async()=>{
 const React=await import("react"),{render,screen,cleanup,act}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");
 const {AiAssessmentPanel}=await feature();const original=globalThis.fetch;let finish!:(r:Response)=>void;let signal:AbortSignal|undefined;
 globalThis.fetch=async(_url,init)=>{signal=init?.signal as AbortSignal;return await new Promise<Response>(resolve=>{finish=resolve;});};
 try{render(<AiAssessmentPanel request={request()}/>);const user=userEvent.setup();await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));
 await screen.findByRole("button",{name:"Stop AI assessment"});await user.click(screen.getByRole("button",{name:"Stop AI assessment"}));assert.equal(signal?.aborted,true);
 await act(async()=>finish(Response.json(report())));assert.equal(screen.queryByText("Items match the standard"),null);
 globalThis.fetch=async()=>Response.json({error:{code:"not_configured"}},{status:503});await user.click(screen.getByRole("button",{name:"Retry AI assessment"}));await screen.findByText("The site administrator has not configured the model.");
 assert.equal(screen.queryByRole("button",{name:"Download comparison JSON"}),null);
 }finally{globalThis.fetch=original;cleanup();}
});
test("editing invalidates download; locale preserves report bytes and makes no hidden model call",async()=>{
 const React=await import("react"),{render,screen,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");
 const {AiAssessmentPanel}=await feature(),{LocaleProvider,useLocale}=await import("../locale-provider");const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(report());};
 const blobs:Blob[]=[];const create=URL.createObjectURL,revoke=URL.revokeObjectURL,click=window.HTMLAnchorElement.prototype.click;
 URL.createObjectURL=b=>{blobs.push(b as Blob);return"blob:comparison";};URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=()=>{};
 function Switch(){const {locale,setLocale}=useLocale();return <button onClick={()=>setLocale(locale==="en"?"zh-CN":"en")}>Switch</button>;}
 const input=request();function View({revision=0}:{revision?:number}){return <LocaleProvider initialLocale="en"><Switch/><AiAssessmentPanel request={input} revision={revision}/></LocaleProvider>;}
 try{const v=render(<View/>);const user=userEvent.setup();await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));await screen.findByText("Items match the standard");
 await user.click(screen.getByRole("button",{name:"Download comparison JSON"}));const en=await blobs[0].text();await user.click(screen.getByRole("button",{name:"Switch"}));await user.click(screen.getByRole("button",{name:"下载对照 JSON"}));assert.equal(await blobs[1].text(),en);assert.equal(calls,1);
 v.rerender(<View revision={1}/>);assert.equal((screen.getByRole("button",{name:"下载对照 JSON"})as HTMLButtonElement).disabled,true);assert.ok(screen.getByText("参数已变化，请重新评估。"));
 }finally{globalThis.fetch=original;URL.createObjectURL=create;URL.revokeObjectURL=revoke;window.HTMLAnchorElement.prototype.click=click;cleanup();}
});
test("invalid responses remain errors and unsafe source links are never interactive",async()=>{
 const React=await import("react"),{render,screen,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");const {AiAssessmentPanel}=await feature();const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({reportType:"gadews-ai-assessment-comparison"});render(<AiAssessmentPanel request={request()}/>);const user=userEvent.setup();await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));await screen.findByRole("alert");
 const r=report();r.sources=[{id:"bad",title:"Unsafe source",href:"javascript:alert(1)"}];globalThis.fetch=async()=>Response.json(r);await user.click(screen.getByRole("button",{name:"Retry AI assessment"}));await screen.findByText("Items match the standard");assert.equal(document.querySelector('a[href^="javascript:"]'),null);
 }finally{globalThis.fetch=original;cleanup();}
});
test("changing a pending snapshot aborts its request and a late result cannot attach to new inputs",async()=>{
 const React=await import("react"),{render,screen,cleanup,act}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");const {AiAssessmentPanel}=await feature();const original=globalThis.fetch;
 let finish!:(r:Response)=>void;let signal:AbortSignal|undefined;globalThis.fetch=async(_url,init)=>{signal=init?.signal as AbortSignal;return await new Promise<Response>(resolve=>{finish=resolve;});};
 try{const input=request(),v=render(<AiAssessmentPanel request={input}/>),user=userEvent.setup();await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));
 v.rerender(<AiAssessmentPanel request={input} revision={1}/>);assert.equal(signal?.aborted,true);await act(async()=>finish(Response.json(report())));assert.equal(screen.queryByText("Items match the standard"),null);
 assert.equal(screen.queryByRole("button",{name:"Download comparison JSON"}),null);
 }finally{globalThis.fetch=original;cleanup();}
});
test("A to B to A never revives a cancelled pending attempt",async()=>{
 const React=await import("react"),{render,screen,cleanup,act}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");const {AiAssessmentPanel}=await feature();const original=globalThis.fetch;
 let finish!:(r:Response)=>void;globalThis.fetch=async()=>new Promise(resolve=>{finish=resolve;});
 try{const a=request(),b=structuredClone(a);b.input.waterTemperature!.value=29;const v=render(<AiAssessmentPanel request={a}/>),user=userEvent.setup();
 await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));v.rerender(<AiAssessmentPanel request={b}/>);v.rerender(<AiAssessmentPanel request={a}/>);
 assert.equal(screen.getByRole("region",{name:"Rule and AI comparison"}).getAttribute("data-ai-assessment-state"),"idle");assert.ok(screen.getByRole("button",{name:"AI-assisted assessment"}));await act(async()=>finish(Response.json(report())));
 assert.equal(screen.queryByRole("button",{name:"Download comparison JSON"}),null);
 }finally{globalThis.fetch=original;cleanup();}
});
test("A to B to A keeps a completed comparison outdated and its download disabled",async()=>{
 const React=await import("react"),{render,screen,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");const {AiAssessmentPanel}=await feature();const original=globalThis.fetch;globalThis.fetch=async()=>Response.json(report());
 try{const a=request(),b=structuredClone(a);b.input.waterTemperature!.value=29;const v=render(<AiAssessmentPanel request={a}/>),user=userEvent.setup();await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));await screen.findByText("Items match the standard");
 v.rerender(<AiAssessmentPanel request={b}/>);v.rerender(<AiAssessmentPanel request={a}/>);assert.equal((screen.getByRole("button",{name:"Download comparison JSON"})as HTMLButtonElement).disabled,true);
 }finally{globalThis.fetch=original;cleanup();}
});
test("complete score levels are visible and localized while incomplete urgent evidence remains attention only",async()=>{
 const React=await import("react"),{render,screen,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event");const {AiAssessmentPanel}=await feature();const original=globalThis.fetch;
 const {classifyTilapiaScore}=await import("@/lib/gadews/ai-assessment/tilapia-demo");
 try{const r=report();r.baseline.completeScore=75;r.baseline.knownSubtotal=75;r.baseline.level=classifyTilapiaScore(75);r.validation.completeScore=75;r.validation.knownSubtotal=75;r.validation.level=r.baseline.level;globalThis.fetch=async()=>Response.json(r);
 render(<AiAssessmentPanel request={request()}/>);const user=userEvent.setup();await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));await screen.findByText("Items match the standard");assert.equal(screen.getAllByText("Very high attention").length,2);
 cleanup();r.baseline.completeScore=null;r.baseline.level=null;r.baseline.minimumAttention="urgent";r.validation.completeScore=null;r.validation.level=null;r.validation.state="partial";globalThis.fetch=async()=>Response.json(r);render(<AiAssessmentPanel request={request()}/>);await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));await screen.findByText("Incomplete evidence; known items retained");assert.equal(screen.queryByText("Very high attention"),null);assert.equal(screen.getAllByText("Urgent attention").length,2);
 cleanup();r.baseline.completeScore=0;r.baseline.knownSubtotal=0;r.baseline.level=classifyTilapiaScore(0);r.validation.completeScore=0;r.validation.knownSubtotal=0;r.validation.level=r.baseline.level;r.validation.state="consistent";globalThis.fetch=async()=>Response.json(r);render(<AiAssessmentPanel request={request()}/>);await user.click(screen.getByRole("checkbox"));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));await screen.findByText("Items match the standard");assert.ok(screen.getByText("Existing evidence requires urgent attention; the score does not cancel it."));
 }finally{globalThis.fetch=original;cleanup();}
});
