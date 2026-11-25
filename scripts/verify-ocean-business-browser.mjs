import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openBrowser } from "./surveillance-browser-tools.mjs";

const base = process.env.OCEAN_PREVIEW_BASE ?? "http://127.0.0.1:3219";
const output = resolve(process.env.OCEAN_BROWSER_OUTPUT ?? "/tmp/gadews-c09-business-browser");
await mkdir(output, { recursive: true });
const browser = await openBrowser();
const { call, evaluate, wait, click: rawClick } = browser;
let activeWidth = 1440;
async function click(target) {
  await evaluate(`(${target})?.scrollIntoView({block:"center",behavior:"instant"})`); await delay(100);
  if (activeWidth !== 390) return rawClick(target);
  const point = await evaluate(`(()=>{const e=(${target});if(!e)throw Error("Missing click target");const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return {x:x-visualViewport.offsetLeft,y:y-visualViewport.offsetTop,clear:e===h||e.contains(h),hit:h?.tagName}})()`);
  assert.ok(point.clear, `Touch target is obscured (${point.hit}): ${target}`);
  await call("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:point.x,y:point.y}]});
  await call("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
}
const runs = [], requests = [], errors = [];
browser.onEvent(event => {
  if (event.method === "Network.requestWillBeSent") requests.push(event.params.request.url);
  if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails.text);
});
await call("Runtime.enable");
const button = text => `[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&!e.closest('[hidden]')&&e.textContent.trim()===${JSON.stringify(text)})`;
const label = text => `document.querySelector('[aria-label=${JSON.stringify(text)}]')`;
const langButton = locale => `[...document.querySelectorAll('.gadews-header button')].find(e=>e.textContent===${JSON.stringify(locale === "en" ? "English" : "Chinese")})`;
async function locale(value) { await click(langButton(value)); await wait(`document.documentElement.lang===${JSON.stringify(value)}`); }
async function shot(name) { const file = join(output, name + ".png"); const s = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(file, Buffer.from(s.data, "base64")); return file; }
async function navigate(path) { await evaluate("window.__oceanQANavigation=true"); await call("Page.navigate", { url: base + path }); await wait("!window.__oceanQANavigation && document.readyState===\"complete\" && document.querySelector('.gadews-header .site-language button')"); await delay(350); }
async function closeMapPopup() {
  // Leaflet auto-pan moves the close button after the popup appears. Wait for
  // actual settled geometry before sampling a coordinate for a single real tap.
  const settled = await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now(); let previous; let stableFrames = 0;
    function sample() {
      const close = document.querySelector('.leaflet-popup-close-button');
      const popup = document.querySelector('.leaflet-popup');
      if (!close || !popup) { reject(new Error('Expected an open map popup before closing')); return; }
      const r = close.getBoundingClientRect();
      const rect = { x: r.x, y: r.y, width: r.width, height: r.height };
      const moving = Boolean(document.querySelector('.leaflet-pan-anim,.leaflet-zoom-anim'));
      const same = previous && Object.keys(rect).every(key => Math.abs(rect[key] - previous[key]) < 0.1);
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      stableFrames = !moving && same && getComputedStyle(popup).opacity === '1' && close.contains(hit) ? stableFrames + 1 : 0;
      previous = rect;
      if (stableFrames >= 4) { resolve({ rect, stableFrames, elapsedMs: performance.now() - started, moving }); return; }
      if (performance.now() - started > 5000) { reject(new Error('Map popup close button did not settle within 5 seconds')); return; }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  })`);
  await click("document.querySelector('.leaflet-popup-close-button')");
  await wait("!document.querySelector('.leaflet-popup')");
  return settled;
}
async function size(width) {
  const value = await evaluate(`({client:document.documentElement.clientWidth,inner:innerWidth,scroll:document.documentElement.scrollWidth,visual:visualViewport.width})`);
  assert.ok(value.client <= width && value.client >= width - (width === 390 ? 0 : 20), `Actual client width must fit emulated viewport, allowing desktop scrollbar: ${JSON.stringify(value)}`);
  assert.equal(value.inner, width, `Viewport expanded by horizontal overflow: ${JSON.stringify(value)}`);
  assert.ok(value.scroll <= width, `Horizontal overflow: ${JSON.stringify(value)}`); return value;
}
async function fill(target, value) {
  await click(target);
  await wait(`document.activeElement===(${target})`);
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 4, commands: ["selectAll"] });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 4 });
  await call("Input.insertText", { text: value });
  assert.equal(await evaluate(`(${target}).value`), value);
}
async function select(target, value) { await evaluate(`(()=>{const s=(${target});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await wait(`(${target}).value===${JSON.stringify(value)}`); }
async function escape() { await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); }
async function step(name, width, fn) {
  if (only && !name.includes(only)) return;
  try { const evidence = await fn(); runs.push({ name, width, status: "passed", evidence }); console.log(`PASS ${width} ${name}`); }
  catch(error) { const screenshot = await shot(`failure-${width}-${name.replace(/\W+/g,'-')}`).catch(()=>null); const state=await evaluate("({url:location.href,text:document.body.innerText.slice(-6000),active:document.activeElement?.outerHTML,viewport:{x:visualViewport.offsetLeft,y:visualViewport.offsetTop,pageTop:visualViewport.pageTop},search:document.querySelector('input[type=search]')?.getBoundingClientRect().toJSON()})").catch(()=>null); runs.push({ name, width, status: "failed", error: error.stack, screenshot, state }); console.log(`FAIL ${width} ${name}: ${error.message}`); }
  await writeFile(join(output,"results.json"), JSON.stringify({ base, runs, requests, errors, blockedExternal: ["OSM tiles", "cdnjs Leaflet marker images"], sourceInterception: false, runtime: process.env.OCEAN_RUNTIME ?? "dev" },null,2));
}
async function download(width, name, text="Download JSON") {
  const directory=await mkdtemp(join(output,`download-${width}-${name}-`)); await call("Browser.setDownloadBehavior",{behavior:"allow",downloadPath:directory}); await click(button(text));
  let file; for(let i=0;i<100;i++){ file=(await readdir(directory)).find(f=>f.endsWith('.json')); if(file)break;await delay(100); }
  assert.ok(file,"Actual JSON file must download");const path=join(directory,file), report=JSON.parse(await readFile(path,"utf8")); assert.equal(report.reportType,"gadews-assessment");assert.equal(report.result.prediction.probability,null);assert.ok(report.result.model.version && report.result.model.source && report.result.inputSnapshot && report.result.contextSnapshot && report.result.quality);return {path,report};
}
const routes=["/overview","/risk-map","/knowledge-bank","/knowledge-bank/literature","/warning-tools","/why-gadews-matters"];
const only = process.env.OCEAN_BROWSER_ONLY;
try {
 for(const width of (process.env.OCEAN_BROWSER_WIDTH ? [Number(process.env.OCEAN_BROWSER_WIDTH)] : [1440,390])) {
  activeWidth=width; await call("Emulation.setDeviceMetricsOverride",{width,height:1000,deviceScaleFactor:1,mobile:width===390});
  for(const route of routes) await step(`route ${route}`,width,async()=>{
   await navigate(route);const shots=[];for(const l of ["zh-CN","en"]){await locale(l);await size(width);await evaluate("scrollTo(0,0)");shots.push(await shot(`${route.replaceAll('/','_')}-${width}-${l}`));assert.equal(await evaluate("Boolean(document.querySelector('.gadews-header a[href=\"/\"]'))"),true);}
   if(width===390){const trigger="document.querySelector('.site-menu-trigger')";await click(trigger);await wait("document.querySelector('#site-mobile-nav')");assert.equal(await evaluate("document.querySelectorAll('#site-mobile-nav a').length"),7);await escape();assert.equal(await evaluate("document.activeElement===document.querySelector('.site-menu-trigger')"),true);await wait("!document.querySelector('#site-mobile-nav')");}
   return {view:await size(width),screenshots:shots};
  });
  await step("overview NASA selection tooltip units",width,async()=>{
   await navigate('/overview');await locale('en');const s=label('Select site');await wait(`${s}?.options.length===6`);
   const id=await evaluate(`${s}.options[2].value`);await select(s,id);await locale('zh-CN');assert.equal(await evaluate('document.querySelector("select").value'),id);await locale('en');
   await wait("document.querySelectorAll('.recharts-wrapper').length===2");await evaluate("document.querySelector('.recharts-wrapper').scrollIntoView({block:'center',behavior:'instant'})");await delay(150);
   const p=await evaluate("(()=>{const r=document.querySelector('.recharts-wrapper').getBoundingClientRect();return {x:r.x+r.width*.55,y:r.y+r.height*.45}})()");await call('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await wait("[...document.querySelectorAll('.recharts-tooltip-wrapper')].some(t=>getComputedStyle(t).visibility==='visible'&&t.textContent.includes('deg C')&&t.textContent.includes('mm'))");
   const tooltips=await evaluate("[...document.querySelectorAll('.recharts-tooltip-wrapper')].map(t=>t.textContent)");await size(width);return {site:id,tooltips,screenshot:await shot(`NASA-tooltip-${width}`)};
  });
  await step("knowledge collection search sort view drawer",width,async()=>{
   await navigate('/knowledge-bank/literature?collection=streptococcosis');await locale('en');await wait("document.querySelectorAll('article').length===111");
   await select(label('Sort by year'),'year_asc');await click(label('List view'));await fill("document.querySelector('input[aria-label=\"Search literature\"]')",'Streptococcus');await wait("document.querySelectorAll('article').length>0");const count=await evaluate("document.querySelectorAll('article').length");const title=await evaluate("document.querySelector('article h3 button').textContent");
   await locale('zh-CN');assert.equal(await evaluate('document.querySelector("input[type=search]").value'),'Streptococcus');assert.equal(await evaluate('document.querySelector("select").value'),'year_asc');assert.equal(await evaluate('document.querySelectorAll("article").length'),count);assert.equal(await evaluate("document.querySelector('button[aria-label=列表视图]').getAttribute('aria-pressed')"),'true');
   await click("document.querySelector('article h3 button')");await wait("document.querySelector('[role=dialog]')");const drawer="document.querySelector('[role=dialog]')";assert.ok(await evaluate(`${drawer}.textContent.includes(${JSON.stringify(title)})`));
   await click(`[...${drawer}.querySelectorAll('button')].find(e=>e.textContent==='English')`);await wait("document.documentElement.lang==='en'");assert.ok(await evaluate(`${drawer}.textContent.includes('Abstract · original text')`));assert.ok(await evaluate(`Boolean(${drawer}.querySelector('a[href="/"]'))`));
   const hit=await evaluate(`(()=>{const e=${drawer}.querySelector('nav a');const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);assert.ok(hit,'Drawer navigation must be above sticky header');const ss=await shot(`literature-drawer-${width}`);await size(width);await escape();await wait("!document.querySelector('[role=dialog]')");await wait(`document.activeElement.textContent===${JSON.stringify(title)}`);assert.equal(await evaluate("document.activeElement.textContent"),title);
   await click(button('Clear search'));await click(label('Grid view'));await click(`[...document.querySelectorAll('section button')].find(e=>e.textContent.startsWith('WSSV'))`);await wait("document.querySelectorAll('article').length===54");assert.ok(await evaluate("location.search.includes('collection=wssv')"));return {searched:count,title,screenshot:ss};
  });
  await step("value Rome photo",width,async()=>{
   await navigate('/why-gadews-matters');await locale('en');await click(`[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes('Rome workshop'))`);await wait("document.querySelector('[role=tabpanel][data-state=active] img')?.getAttribute('src').includes('fao-rome')");await wait("(()=>{const i=document.querySelector('[role=tabpanel][data-state=active] img');return i.complete&&i.naturalWidth>0})()");await locale('zh-CN');assert.ok(await evaluate("document.querySelector('[role=tabpanel][data-state=active]').textContent.includes('罗马')"));await size(width);return {image:await evaluate("document.querySelector('[role=tabpanel][data-state=active] img').getAttribute('src')"),screenshot:await shot(`rome-${width}`)};
  });
  await step("map filters public marker popup",width,async()=>{
   const start=requests.length;const closeReadiness=[];await navigate('/risk-map');await locale('en');await wait("document.querySelectorAll('.leaflet-interactive').length>0");await select("document.querySelector('[data-layer-panel] select')",'WSD');await select("document.querySelectorAll('[data-layer-panel] select')[1]",'all');await locale('zh-CN');assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-layer-panel] select')].map(e=>e.value)"),['WSD','all']);assert.equal(await evaluate("document.querySelector('.leaflet-control-zoom-in').getAttribute('title')"),'放大地图');assert.equal(await evaluate("document.querySelector('.leaflet-control-zoom-out').getAttribute('aria-label')"),'缩小地图');await locale('en');assert.equal(await evaluate("document.querySelector('.leaflet-control-zoom-in').getAttribute('title')"),'Zoom in');
   await click(label('Close layers panel'));await delay(400);const marker=`[...document.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive')].find(p=>{const r=p.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>10&&x<innerWidth-10&&y>160&&y<innerHeight-120&&document.elementFromPoint(x,y)===p})`;await wait(marker);await evaluate(`(${marker}).focus()`);await call("Input.dispatchKeyEvent",{type:"keyDown",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});await call("Input.dispatchKeyEvent",{type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});await wait("document.querySelector('.leaflet-popup-content')");await delay(400);assert.ok(await evaluate("/WOAH WAHIS|NACA QAAD/.test(document.querySelector('.leaflet-popup-content').textContent)"));const rect=await evaluate("(()=>{const r=document.querySelector('.leaflet-popup').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width}})()");assert.ok(rect.x>=0&&rect.right<=width&&rect.y>=0&&rect.bottom<=1000,JSON.stringify(rect));assert.ok(await evaluate("Boolean(document.querySelector('.leaflet-popup-content a[href^=\"https:\"]'))"));await locale('zh-CN');assert.ok(await evaluate("document.querySelector('.leaflet-popup-content').textContent.includes('来源')"));const ss=await shot(`map-popup-${width}`);assert.ok(rect.width >= Math.min(280,width-32), `Popup must have readable content width: ${rect.width}`);closeReadiness.push(await closeMapPopup());await click(label('打开图层面板'));await locale('en');await click("document.querySelectorAll('[data-layer-panel] input[type=checkbox]')[1]");await wait("!document.querySelectorAll('[data-layer-panel] input[type=checkbox]')[1].checked");await click(label('Close layers panel'));await delay(350);await wait(marker);await evaluate(`(${marker}).focus()`);await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait("document.querySelector('.leaflet-popup-content')?.textContent.includes('WOAH WAHIS')");await shot(`map-wahis-popup-${width}`);closeReadiness.push(await closeMapPopup());assert.equal(requests.slice(start).filter(u=>u.includes('/qaad-regional-surveillance-summary.json')).length,0);return {rect,screenshot:ss,distinctWahisPopup:true,closeReadiness};
  });
  await step("workbench manual raw language canonical downloads",width,async()=>{
   await navigate('/warning-tools');await locale('en');await wait(`${button('Evaluate WSD')}&&!${button('Evaluate WSD')}.disabled`);await fill('document.getElementById("wsd-ph")','7.02');await fill('document.getElementById("wsd-regionOrSite")','canonical-manual-site');await click(button('Evaluate WSD'));await wait("document.querySelector('[aria-label=\"Assessment result\"]')");const en=await download(width,'manual-en');assert.equal(en.report.result.diseaseId,'wsd');assert.equal(en.report.result.dataMode,'manual');await locale('zh-CN');assert.equal(await evaluate('document.getElementById("wsd-ph").value'),'7.02');const zh=await download(width,'manual-zh','下载 JSON');assert.deepEqual(zh.report,en.report,'Language must preserve all machine-readable JSON');await fill('document.getElementById("wsd-ph")','7.');await locale('en');assert.equal(await evaluate('document.getElementById("wsd-ph").value'),'7.');assert.ok(await evaluate(`${button('Download JSON')}.disabled`));assert.ok(await evaluate("document.body.textContent.includes('This result is outdated')"));return {english:en.path,chinese:zh.path,canonicalIdentical:true,rawDraft:'7.',screenshot:await shot(`wsd-raw-${width}`)};
  });
  await step("workbench tilapia disabled draft isolation",width,async()=>{
   await navigate('/warning-tools');await locale('en');await wait(button('Evaluate WSD'));await fill('document.getElementById("wsd-ph")','7.02');await click(button('Tilapia streptococcosis'));await wait(`${button('Evaluate tilapia')}&&!${button('Evaluate tilapia')}.disabled`);await click(button('Evaluate tilapia'));await wait("document.querySelector('[data-assessment-status=draft_disabled]')");await click(button('Load tilapia draft example'));await click(button('Evaluate tilapia'));await wait("document.querySelector('[data-assessment-status=draft_preview]')");const en=await download(width,'tilapia-en');assert.equal(en.report.result.diseaseId,'tilapia-streptococcosis');assert.equal(en.report.result.dataMode,'draft-preview');assert.equal(en.report.result.ruleTraces.length,22);await locale('zh-CN');const zh=await download(width,'tilapia-zh','下载 JSON');assert.deepEqual(en.report,zh.report);await locale('en');await click(button('WSD / white spot disease'));assert.equal(await evaluate('document.getElementById("wsd-ph").value'),'7.02');return {english:en.path,chinese:zh.path,canonicalIdentical:true,screenshot:await shot(`workbench-isolation-${width}`)};
  });
  await step("workbench explicit four scenario demo",width,async()=>{
   await navigate('/warning-tools');await locale('en');await wait(button('Evaluate WSD'));await fill('document.getElementById("wsd-ph")','7.02');const start=requests.length;await click(button('Run monitoring demo'));await wait("document.querySelector('[data-monitoring-source=demo][data-monitoring-state=success]')");assert.equal(await evaluate('document.getElementById("wsd-demo-waterTemperatureC").value'),'');const cases=[];
   for(const id of ['demo-usable','demo-partial','demo-stale','demo-unverified']){
    await select('document.getElementById("monitoring-feed")',id);await wait("document.querySelector('[data-monitoring-state=success]')");await click(button('Load demo observation into WSD'));const vals=await evaluate("['waterTemperatureC','ph'].map(k=>document.getElementById('wsd-demo-'+k).value)");assert.deepEqual(vals,id==='demo-usable'?['29','8.2']:id==='demo-partial'?['29','']:['','']);await click(button('Evaluate WSD'));const d=await download(width,id);assert.equal(d.report.result.dataMode,'example');assert.equal(d.report.result.contextSnapshot.inputProvenance.demoSession.scenarioId,id);cases.push({id,values:vals,path:d.path});
   }
   await locale('zh-CN');const z=await download(width,'demo-final-zh','下载 JSON');const e=JSON.parse(await readFile(cases.at(-1).path,'utf8'));assert.deepEqual(e,z.report);await locale('en');await click(button('Published observations'));assert.equal(await evaluate('document.getElementById("wsd-ph").value'),'7.02');assert.equal(requests.slice(start).filter(u=>u.includes('/api/monitoring/')).length,0);await size(width);return {cases,canonicalIdentical:true,noRealMonitoringRequest:true,screenshot:await shot(`demo-end-${width}`)};
  });
  await step("shared home navigation language persistence",width,async()=>{
   await navigate('/knowledge-bank');await locale('en');if(width===390){await click("document.querySelector('.site-menu-trigger')");await click("document.querySelector('#site-mobile-nav a[href=\"/\"]')");}else await click("document.querySelector('.site-desktop-nav a[href=\"/\"]')");await wait("location.pathname==='/'");assert.equal(await evaluate('document.documentElement.lang'),'en');await navigate('/overview');assert.equal(await evaluate('document.documentElement.lang'),'en');return {homeReached:true,persistedAfterReload:true};
  });
 }
 console.log(JSON.stringify({passed:runs.filter(r=>r.status==='passed').length,failed:runs.filter(r=>r.status==='failed').length,output},null,2));
 if(runs.some(r=>r.status==='failed')) process.exitCode=1;
} finally { await browser.close(); }
