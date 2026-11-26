import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { WSD_WORKBENCH_EXAMPLE } from "./warning-fields";
import { installDom } from "@/lib/gadews/test-support/dom";
import { createAiAssessmentHandler } from "@/lib/gadews/ai-assessment/handler";
import { buildWsdScoringRubric, evaluateWsdBaseline } from "@/lib/gadews/ai-assessment/wsd-rubric";
import { evaluateTilapiaDemo, tilapiaScoringRubric } from "@/lib/gadews/ai-assessment/tilapia-demo";
import type { AiAssessmentRequest } from "@/lib/gadews/ai-assessment/types";
import type { WsdWarningModelConfig } from "@/lib/gadews/wsd-warning-model";
installDom();
const wsd=JSON.parse(readFileSync("public/data/models/wsd-warning-model.json","utf8"))as WsdWarningModelConfig;
const knowledge=JSON.parse(readFileSync("public/data/knowledge/tilapia-streptococcosis.json","utf8"));
const CLOCK="2026-10-30T12:00:00Z";
function bridge(){
 const requests:AiAssessmentRequest[]=[];let current:AiAssessmentRequest;
 const handler=createAiAssessmentHandler({env:{GADEWS_AI_API_KEY:"local-fixture-only"},now:()=>new Date(CLOCK),generate:async()=>{
  const context={...current.context,now:current.context.dataMode&&current.context.dataMode!=="manual"&&current.context.now?current.context.now:CLOCK};
  const baseline=current.diseaseId==="wsd"?evaluateWsdBaseline(current.input,context,buildWsdScoringRubric(wsd),wsd):evaluateTilapiaDemo(current.input,context,tilapiaScoringRubric);
  return JSON.stringify({items:baseline.items.map(({itemId,branchId,status,score})=>({itemId,branchId,status,score,reason:"Local engineering fixture."})),generalSupplement:""});
 }});
 return {requests,fetch:async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
  if(String(url).includes("/api/assessment/ai")){current=JSON.parse(String(init!.body));requests.push(current);return handler(new Request("http://localhost/api/assessment/ai",{method:"POST",headers:{origin:"http://localhost"},body:String(init!.body),signal:init!.signal??undefined}));}
  return Response.json(String(url).includes("tilapia")?knowledge:wsd);
 }};
}
test("real form snapshots drive both comparisons while original JSON and disabled rules stay independent",async()=>{
 const React=await import("react"),{render,screen,within,waitFor,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event"),{WarningWorkbench}=await import("./warning-workbench");
 const io=bridge(),original=globalThis.fetch;globalThis.fetch=io.fetch;
 const blobs:Blob[]=[];const create=URL.createObjectURL,revoke=URL.revokeObjectURL,click=window.HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{blobs.push(b as Blob);return"blob:integration";};URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=()=>{};
 try{render(<WarningWorkbench/>);const user=userEvent.setup();await waitFor(()=>assert.equal((screen.getByRole("button",{name:"Evaluate WSD"})as HTMLButtonElement).disabled,false));
 await user.type(screen.getByLabelText("Pond pH"),"7.02");await user.click(screen.getByRole("button",{name:"Evaluate WSD"}));await user.click(screen.getByRole("button",{name:"Download JSON"}));const originalJson=await blobs[0].text();
 assert.ok((screen.getByRole("button",{name:"AI-assisted assessment"}) as HTMLButtonElement).disabled);
 assert.equal(io.requests.length,0);
 await user.click(screen.getByRole("button",{name:"Download JSON"}));assert.equal(await blobs[1].text(),originalJson);
 await user.click(screen.getByRole("button",{name:"Load WSD example"}));
 await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));
 await screen.findByRole("button",{name:"Download comparison JSON"});
 assert.equal(io.requests.length,1);
 await user.click(screen.getByRole("button",{name:"Download comparison JSON"}));assert.equal(JSON.parse(await blobs[2].text()).reportType,"gadews-ai-assessment-comparison");
 await user.type(screen.getByLabelText("Pond pH"),"1");assert.equal((screen.getByRole("button",{name:"Download comparison JSON"})as HTMLButtonElement).disabled,true);
 await user.click(screen.getByRole("button",{name:"Tilapia streptococcosis"}));const tilt=within(screen.getByRole("region",{name:"Tilapia workspace"}));await waitFor(()=>assert.equal((tilt.getByRole("button",{name:"Evaluate tilapia"})as HTMLButtonElement).disabled,false));
 await user.click(tilt.getByRole("button",{name:"Evaluate tilapia"}));assert.ok(tilt.getByText("Draft rules disabled"));
 await user.click(tilt.getByRole("button",{name:"Load tilapia draft example"}));await user.click(tilt.getByRole("checkbox",{name:"Use Tilapia scoring standard v0.1"}));await user.click(tilt.getByRole("button",{name:"AI-assisted assessment"}));await waitFor(()=>assert.equal(io.requests.length,2));await waitFor(()=>assert.ok(tilt.queryByRole("button",{name:"Download comparison JSON"})));
 const sent=io.requests[1];assert.ok(sent.diseaseId==="tilapia-streptococcosis");assert.equal(sent.context.dataMode,"draft-preview");assert.equal("professionalRecords"in sent.context,false);assert.equal("draftPreview"in sent.context,false);assert.equal("reviewRecordIds"in sent.input,false);
 assert.equal(document.body.textContent!.includes("未审核演示标准"),false);assert.equal(sent.input.laboratory.length>0,true);
 }finally{globalThis.fetch=original;URL.createObjectURL=create;URL.revokeObjectURL=revoke;window.HTMLAnchorElement.prototype.click=click;cleanup();}
});
test("switching disease cancels an actual pending AI request and prevents stale results when returning",async()=>{
 const React=await import("react"),{render,screen,waitFor,cleanup,act}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event"),{WarningWorkbench}=await import("./warning-workbench");const original=globalThis.fetch;
 let signal:AbortSignal|undefined,finish!:(r:Response)=>void;globalThis.fetch=async(url,init)=>{if(String(url).includes("/api/assessment/ai")){signal=init!.signal as AbortSignal;return new Promise(resolve=>{finish=resolve;});}return Response.json(String(url).includes("tilapia")?knowledge:wsd);};
 try{render(<WarningWorkbench/>);const user=userEvent.setup();await waitFor(()=>assert.equal((screen.getByRole("button",{name:"Evaluate WSD"})as HTMLButtonElement).disabled,false));await user.click(screen.getByRole("button",{name:"Load WSD example"}));await user.click(screen.getByRole("button",{name:"AI-assisted assessment"}));
 await user.click(screen.getByRole("button",{name:"Tilapia streptococcosis"}));assert.equal(signal?.aborted,true);await act(async()=>finish(Response.json({reportType:"late"})));await user.click(screen.getByRole("button",{name:"WSD / white spot disease"}));assert.equal((screen.getByLabelText("Pond pH")as HTMLInputElement).value,String(WSD_WORKBENCH_EXAMPLE.ph));assert.equal(screen.queryByRole("button",{name:"Download comparison JSON"}),null);
 }finally{globalThis.fetch=original;cleanup();}
});
test("monitoring demo stays local and leaves manual parameters intact",async()=>{
 const React=await import("react"),{render,screen,within,cleanup}=await import("@testing-library/react"),{default:userEvent}=await import("@testing-library/user-event"),{WarningWorkbench}=await import("./warning-workbench");const io=bridge(),original=globalThis.fetch;globalThis.fetch=io.fetch;
 try{render(<WarningWorkbench/>);const user=userEvent.setup();await user.type(screen.getByLabelText("Pond pH"),"7.02");await user.click(screen.getByRole("button",{name:"Run monitoring demo"}));await screen.findByText("29 °C");const demo=within(screen.getByRole("region",{name:"WSD demo workspace"}));
 await user.click(demo.getByRole("button",{name:"Load demo observation into WSD"}));assert.ok((demo.getByRole("button",{name:"AI-assisted assessment"}) as HTMLButtonElement).disabled);assert.equal(io.requests.length,0);
 await user.click(screen.getByRole("button",{name:"Published observations"}));assert.equal((within(screen.getByRole("region",{name:"WSD workspace"})).getByLabelText("Pond pH")as HTMLInputElement).value,"7.02");
 }finally{globalThis.fetch=original;cleanup();}
});
