import assert from "node:assert/strict";
import { mkdir,mkdtemp,readdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";
const base=process.env.AI_PREVIEW_BASE??"http://127.0.0.1:3224",fixture=process.env.AI_FIXTURE_BASE??"http://127.0.0.1:3225",output=process.env.AI_BROWSER_OUTPUT??"/tmp/gadews-c13-browser";
await mkdir(output,{recursive:true});const b=await openBrowser(),{call,evaluate,wait}=b;let width=1440;const runs=[],errors=[],requests=[];
b.onEvent(e=>{if(e.method==="Runtime.exceptionThrown")errors.push(e.params.exceptionDetails);if(e.method==="Network.requestWillBeSent"&&e.params.request.url.includes("/api/assessment/ai"))requests.push(JSON.parse(e.params.request.postData??"{}"));});await call("Runtime.enable");
const q=s=>"document.querySelector("+JSON.stringify(s)+")";
const button=text=>"[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&!e.closest('[hidden]')&&e.textContent.trim()==="+JSON.stringify(text)+")";
const panel="document.querySelector('[role=region]:not([hidden]) [data-ai-assessment-state]')";
async function click(expression){
 await evaluate("("+expression+").scrollIntoView({block:'center',behavior:'instant'})");await delay(100);
 const p=await evaluate("(()=>{const e=("+expression+"),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return {x,y,clear:h===e||e.contains(h),hit:h?.tagName};})()");assert.ok(p.clear,"Obscured "+expression+" by "+p.hit);
 if(width<600){await call("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:p.x,y:p.y}]});await call("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}
 else{await call("Input.dispatchMouseEvent",{type:"mousePressed",x:p.x,y:p.y,button:"left",clickCount:1});await call("Input.dispatchMouseEvent",{type:"mouseReleased",x:p.x,y:p.y,button:"left",clickCount:1});}
}
async function fill(id,value){
 await click(q("#"+id));for(const type of["keyDown","keyUp"])await call("Input.dispatchKeyEvent",{type,key:"a",code:"KeyA",windowsVirtualKeyCode:65,modifiers:4});
 await call("Input.insertText",{text:String(value)});await delay(20);
}
async function select(id,value){await evaluate("(()=>{const e=document.getElementById("+JSON.stringify(id)+");e.value="+JSON.stringify(value)+";e.dispatchEvent(new Event('change',{bubbles:true}));})()");await delay(25);}
async function control(value){await fetch(fixture+"/control",{method:"POST",body:JSON.stringify(value)});}
async function stats(){return(await fetch(fixture+"/stats")).json();}
async function shot(name){const s=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});const path=join(output,name+".png");await writeFile(path,Buffer.from(s.data,"base64"));return path;}
async function download(name,text="Download comparison JSON"){
 const dir=await mkdtemp(join(output,"download-"+name+"-"));await call("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:dir});await click(button(text));
 for(let i=0;i<100;i++){const files=(await readdir(dir)).filter(x=>x.endsWith(".json"));if(files.length){const path=join(dir,files[0]);return{path,text:await readFile(path,"utf8")};}await delay(50);}throw Error("Download did not complete");
}
async function save(){await writeFile(join(output,"results.json"),JSON.stringify({base,runs,errors,requests,modelFixtureCalls:await stats(),paidModelRequests:0,realHandset:false,nativeTouchEmulation:true},null,2));}
async function step(name,run){if(process.env.AI_BROWSER_ONLY&&!new RegExp(process.env.AI_BROWSER_ONLY).test(name))return;try{runs.push({name,width,status:"passed",evidence:await run()});console.log("PASS",width,name);}catch(error){runs.push({name,width,status:"failed",error:error.stack,screenshot:await shot("failure-"+runs.length),state:await evaluate("({url:location.href,lang:document.documentElement.lang,active:document.activeElement?.outerHTML,text:document.body.innerText.slice(-9000)})")});console.log("FAIL",width,name,error.message);}await save();}
async function navigate(){await call("Network.setCookie",{name:"gadews-language",value:"en",url:base});await evaluate("window.__aiNavigate=true");await call("Page.navigate",{url:base+"/warning-tools"});await wait("!window.__aiNavigate&&document.readyState==='complete'&&"+button("Evaluate WSD")+"&&!"+button("Evaluate WSD")+".disabled");}
async function completeTilapia(){
 const end=await evaluate(q("#tilapia-assessment-endAt")+".value"),start=await evaluate(q("#tilapia-assessment-startAt")+".value");
 for(const [key,value]of[["waterTemperature",31],["dissolvedOxygen",2]]){
  await fill("tilapia-"+key+"-value",value);await fill("tilapia-"+key+"-observedAt",end);await fill("tilapia-"+key+"-sourceRef","browser-fixture");await select("tilapia-"+key+"-quality","valid");
 }
 for(const [field,value]of[["deadCount",10],["stockStartCount",100],["startAt",start],["endAt",end],["observedAt",end],["sourceRef","browser-fixture"]])await fill("tilapia-mortality-"+field,value);
 for(const key of["abnormalityReported","abnormalityPersistent"])await select("tilapia-mortality-"+key,"yes");await select("tilapia-mortality-quality","valid");
 for(const key of["signsPresent","persistentAbnormality"])await select("tilapia-clinical-"+key,"yes");
 await click(button("Add laboratory finding"));
 const row=await evaluate("[...document.querySelectorAll('input[id^=\"tilapia-manual-lab-\"][id$=\"-sampleId\"]')].at(-1).id.replace(/^tilapia-/, '').replace(/-sampleId$/, '')");
 for(const [field,value]of[["sampleId","browser-environment"],["assayId","fixture-assay"],["observedAt",end],["sourceRef","browser-fixture"]])await fill("tilapia-"+row+"-"+field,value);
 for(const [field,value]of[["pathogen","SAG"],["matrix","environment"],["result","positive"],["controlsPassed","yes"],["matrixValidated","yes"],["quality","valid"]])await select("tilapia-"+row+"-"+field,value);
}
try{
 for(const w of[1440,390]){
  width=w;await call("Emulation.setDeviceMetricsOverride",{width:w,height:1000,deviceScaleFactor:1,mobile:w<600});await call("Emulation.setTouchEmulationEnabled",{enabled:w<600,maxTouchPoints:1});await navigate();
  await step("WSD complete criterion transport and original export",async()=>{
   await click(button("Load WSD example"));await click(button("Evaluate WSD"));const original=await download("original-before-"+w,"Download JSON");
   await click(button("AI-assisted assessment"));await wait(panel+"?.dataset.aiAssessmentState==='partial'");
   const same=await download("original-after-"+w,"Download JSON");assert.equal(same.text,original.text);const comparison=await download("comparison-wsd-"+w);const json=JSON.parse(comparison.text);assert.equal(json.diseaseId,"wsd");assert.equal(json.baseline.items.length,24);assert.equal(json.validation.completeScore,null);assert.equal(json.baseline.knownSubtotal,json.validation.knownSubtotal);
   await evaluate(panel+".scrollIntoView({block:'center',behavior:'instant'})");return{original:original.path,comparison:comparison.path,screenshot:await shot("wsd-"+w),criteria:24,allSourceBranches:77};
  });
  await step("A-B-A edit keeps the old comparison expired",async()=>{
   const original=await evaluate(q("#wsd-ph")+".value");await fill("wsd-ph","7.02");await fill("wsd-ph",original);await wait(panel+"?.dataset.aiAssessmentState==='outdated'");assert.ok(await evaluate(button("Download comparison JSON")+".disabled"));return{oldExportDisabled:true};
  });
  await step("wrong proposal remains visible as a review difference",async()=>{
   await control({mode:"mismatch"});await click(button("AI-assisted assessment"));await wait(panel+"?.dataset.aiAssessmentState==='needs_review'");
   const saved=await download("difference-"+w),r=JSON.parse(saved.text);assert.ok(r.differences.length);assert.equal(r.validation.completeScore,null);
   await evaluate(panel+".scrollIntoView({block:'center',behavior:'instant'})");return{differences:r.differences.length,screenshot:await shot("difference-"+w)};
  });
  await step("stop propagates through SDK and late result does not revive",async()=>{
   await control({mode:"match",delayMs:1500});await click(button("AI-assisted assessment"));await wait(button("Stop AI assessment"));await delay(100);await click(button("Stop AI assessment"));await wait(panel+"?.dataset.aiAssessmentState==='error'");
   await delay(1700);const list=await stats();assert.equal(list.at(-1).aborted,true);assert.equal(await evaluate("Boolean("+button("Download comparison JSON")+")"),false);return{upstreamAborted:true};
  });
  await step("tilapia complete 100-point score levels and bilingual export",async()=>{
   await click(button("Tilapia streptococcosis"));await wait(button("Load tilapia draft example"));await click(button("Load tilapia draft example"));await completeTilapia();
   await click("[...document.querySelectorAll('label')].find(e=>e.textContent.trim()==='Use Tilapia scoring standard v0.1')");
   await click(button("AI-assisted assessment"));await wait(panel+"?.dataset.aiAssessmentState==='consistent'");
   assert.equal(await evaluate(panel+".querySelector('[data-comparison-baseline]').textContent.trim()"),"100/ 100");
   assert.equal(await evaluate(panel+".textContent.includes('Very high attention')"),true);
   const en=await download("tilapia-en-"+w),before=(await stats()).length;await click("[...document.querySelectorAll('.site-language button')].find(e=>e.textContent==='Chinese')");await wait("document.documentElement.lang==='zh-CN'");const zh=await download("tilapia-zh-"+w,"下载对照 JSON");assert.equal(zh.text,en.text);assert.equal((await stats()).length,before);assert.equal(await evaluate(panel+".textContent.includes('未审核演示标准')"),false);assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
   await evaluate(panel+".scrollIntoView({block:'center',behavior:'instant'})");return{score:100,english:en.path,chinese:zh.path,screenshot:await shot("tilapia-"+w)};
  });
 }
 for(const w of[320,720]){width=w;await call("Emulation.setDeviceMetricsOverride",{width:w,height:w===720?500:900,deviceScaleFactor:1,mobile:w<600});await call("Emulation.setTouchEmulationEnabled",{enabled:w<600,maxTouchPoints:1});await step("reflow controls "+w,async()=>{await navigate();await evaluate(panel+".scrollIntoView({block:'center',behavior:'instant'})");assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));await evaluate("("+button("AI-assisted assessment")+").focus()");assert.ok(await evaluate("document.activeElement.textContent.includes('AI-assisted assessment')"));return{screenshot:await shot("reflow-"+w),nativeZoom:false};});}
 assert.equal(errors.length,0,"Uncaught runtime exceptions");
}finally{await save();await b.close();}
console.log(JSON.stringify({passed:runs.filter(r=>r.status==="passed").length,failed:runs.filter(r=>r.status==="failed").length,output}));if(runs.some(r=>r.status==="failed"))process.exitCode=1;
