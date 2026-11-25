import * as THREE from "three";
import { createLifeFrameLoop, decodePhotoPointPack, nextLifeStage, sampleAnimalPoints, type LifeStage, type PhotoPointPack } from "@/lib/gadews/life-visuals";
import { readBoundedLifeResource } from "./life-particle-resources";

export interface LifeParticleScene {
  setActive: (active: boolean) => void;
  setStage: (stage: LifeStage, immediate?: boolean) => void;
  setAuto: (automatic: boolean) => void;
  setFocus: (focus: boolean) => void;
  redraw: () => void;
  dispose: () => void;
}
export interface LifeSceneOptions {
  count: number;
  initialStage: LifeStage;
  signal: AbortSignal;
  onStage: (stage: LifeStage) => void;
  onError: () => void;
}
interface Form { p: Float32Array; c: Float32Array }
function createForms(pack: PhotoPointPack, count: number) {
  const forms: Form[] = Array.from({ length: 4 }, () => ({ p: new Float32Array(count * 3), c: new Float32Array(count * 3) }));
  let seed = 67991;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296), TAU = Math.PI * 2;
  const mint = [.57, .91, .82], cyan = [.24, .65, .83], pale = [.77, .98, .89], blue = [.21, .47, .70];
  function put(f: Form, i: number, x: number, y: number, z: number, c: number[]) { f.p.set([x, y, z], i * 3); f.c.set(c, i * 3); }
  function sphere(r: number) { const z = rand() * 2 - 1, a = rand() * TAU, s = Math.sqrt(1 - z * z); return [r * s * Math.cos(a), r * z, r * s * Math.sin(a)]; }
  for (const [stage, source] of [pack.tilapia, pack.shrimp].entries()) {
    const sampled = sampleAnimalPoints(source, count);
    for (let i = 0; i < count; i++) {
      const j = i * 5, strength = sampled[j + 3], light = .20 + .80 * Math.pow(strength, .75), edge = sampled[j + 4] ? 1.07 : 1;
      const tone = light * edge;
      const color = stage === 0
        ? [(.25 + .42 * strength) * tone, (.70 + .27 * strength) * tone, (.78 + .16 * strength) * tone]
        : [(.77 + .22 * strength) * tone, (.48 + .37 * strength) * tone, (.32 + .38 * strength) * tone];
      put(forms[stage], i, sampled[j], sampled[j + 1], sampled[j + 2], color);
    }
  }
  const sizes = new Float32Array(count), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rand(), a = rand() * TAU;
    sizes[i] = .64 + rand() * .85; phases[i] = rand() * TAU;
    let x: number, y: number, z: number, c = mint;
 // 03 — membrane shell, eccentric nucleus, nucleolus, ER folds, organelles.
 if(u<.46){
  const p=sphere(1.08+(rand()-.5)*.045);[x,y,z]=p;
  const ripple=1+.035*Math.sin(y*6+a)*Math.cos(z*4);x*=ripple;y*=1.02;z*=.79;c=z>0?mint:blue;
 }else if(u<.65){
  const p=sphere(.39+(rand()-.5)*.035);x=p[0]-.13;y=p[1]+.1;z=p[2]+.17;c=pale;
  if(u>.61){const p2=sphere(.16*Math.cbrt(rand()));x=p2[0]-.17;y=p2[1]+.12;z=p2[2]+.2;c=cyan;}
 }else if(u<.79){
  const ribbon=Math.floor(rand()*9),t=rand()*TAU,r=.48+ribbon*.038;
  x=-.1+Math.cos(t)*r;y=.10+Math.sin(t)*r*.66;z=.09+Math.sin(t*3+ribbon*.7)*.13+(rand()-.5)*.018;c=cyan;
 }else if(u<.93){
  const organelle=Math.floor(rand()*8),angle=organelle/8*TAU+.2,t=rand()*TAU;
  const ox=Math.cos(angle)*.77,oy=Math.sin(angle)*.75;
  const r=.07+rand()*.025;const lx=Math.cos(t)*.18,ly=Math.sin(t)*r;
  x=ox+lx*Math.cos(angle)-ly*Math.sin(angle);y=oy+lx*Math.sin(angle)+ly*Math.cos(angle);
  z=.18+Math.sin(organelle*1.7)*.22+Math.sin(t*5)*.025;c=i%4===0?pale:mint;
 }else{
  const p=sphere(Math.cbrt(rand())*.95);[x,y,z]=p;z*=.72;c=blue;
 }
 put(forms[2],i,x,y,z,c);
 // 04 — chain-form cocci and a bacilliform virion: morphology schematics only.
 if(u<.52){
  const bead=Math.floor(rand()*8),t=bead/7;
  const centerX=-1.22+Math.sin(t*4.1)*.36,centerY=-.83+t*1.66;
  const p=sphere(.165+(rand()-.5)*.018);x=centerX+p[0];y=centerY+p[1];z=p[2];
  c=p[2]>0?mint:blue;
  if(i%7===0){const theta=rand()*TAU;x=centerX+Math.cos(theta)*.165;y=centerY+(rand()-.5)*.018;z=Math.sin(theta)*.165;c=pale;}
 }else if(u<.88){
  const axis=(rand()-.5)*1.75,theta=rand()*TAU;
  const cap=Math.max(0,Math.abs(axis)-.52)/.36,r=.29*Math.sqrt(Math.max(.002,1-cap*cap));
  x=.73+Math.cos(theta)*r;y=axis;z=Math.sin(theta)*r;
  if(i%5===0){const rings=Math.round(axis*30)/30;y=rings;c=pale;}else c=z>0?cyan:blue;
 }else if(u>.975){
  const t=rand();x=.73+Math.sin(t*4.4)*.045;y=.87+t*.34;z=Math.cos(t*3.2)*.025;c=cyan;
 }else{
  const t=rand(),theta=t*TAU*11;
  x=.73+Math.cos(theta)*.14;y=(t-.5)*1.36;z=Math.sin(theta)*.14;c=pale;
 }
 put(forms[3],i,x,y,z,c);
}
  return { forms, sizes, phases };
}

/** Imported only when the homepage visual is visible and motion is allowed. */
export async function createLifeParticleScene(canvas: HTMLCanvasElement, options: LifeSceneOptions): Promise<LifeParticleScene> {
  const bytes = await readBoundedLifeResource("/media/gadews/life/photo-points.bin", 800016, options.signal);
  if (options.signal.aborted) throw new DOMException("Aborted", "AbortError");
  const { forms, sizes, phases } = createForms(decodePhotoPointPack(bytes.buffer as ArrayBuffer), options.count);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x051724, 0);
  let stage = options.initialStage, progress = 1, elapsed = 0, hold = 0, previous = 0, running = false, automatic = true, focus = false, disposed = false, frames = 0;
  let width = 1, height = 1, heroHeight = 1;
  const from = new Float32Array(forms[stage].p), fromColor = new Float32Array(forms[stage].c);
  const target = new Float32Array(forms[stage].p), targetColor = new Float32Array(forms[stage].c);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(from, 3));
  geometry.setAttribute("target", new THREE.BufferAttribute(target, 3));
  geometry.setAttribute("colorFrom", new THREE.BufferAttribute(fromColor, 3));
  geometry.setAttribute("colorTo", new THREE.BufferAttribute(targetColor, 3));
  geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, morph: { value: 1 }, viewport: { value: new THREE.Vector2() }, fadeY: { value: new THREE.Vector2() }, scale: { value: 1 }, center: { value: new THREE.Vector2() }, pixelRatio: { value: renderer.getPixelRatio() }, animal: { value: stage < 2 ? 1 : 0 }, focus: { value: 0 }, textRects: { value: Array.from({ length: 4 }, () => new THREE.Vector4(-1000, -1000, -1000, -1000)) } },
    vertexShader: `attribute vec3 target;attribute vec3 colorFrom;attribute vec3 colorTo;attribute float pointSize;attribute float phase;
      uniform float time,morph,scale,pixelRatio,animal,focus;uniform vec2 viewport,center,fadeY;uniform vec4 textRects[4];varying vec3 tint;varying float opacity;
      void main(){float e=morph*morph*(3.0-2.0*morph);vec3 p=mix(position,target,e);
      vec2 travel = target.xy - position.xy;
      float arc = 0.17 * sin(phase) * (4.0 * e * (1.0 - e));
      p.xy += vec2(-travel.y, travel.x) * arc;
      float drift=sin(time*.45+phase)*.006;p+=mix(vec3(drift,cos(time*.36+phase)*.004,drift),vec3(sin(time*.35)*.002,cos(time*.3)*.002,drift*.25),animal);
      float angle=mix(.25+sin(time*.12)*.12,sin(time*.12)*.022,animal);mat2 r=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));p.xz=r*p.xz;
      float depth=mix(4.8/(4.8-p.z),1.0,animal);vec2 px=center+vec2(p.x,-p.y)*scale*depth;
      gl_Position=vec4(px.x/viewport.x*2.0-1.0,1.0-px.y/viewport.y*2.0,0.0,1.0);
      gl_PointSize=clamp(pointSize*pixelRatio*depth*1.48,.85,3.1);float gleam = 0.95 + 0.05 * sin(p.x * 4.0 - time * 0.75 + p.y);
      tint=mix(colorFrom,colorTo,e)*(.69+depth*.26)*gleam;opacity=mix(.12+.88*smoothstep(fadeY.x,fadeY.y,px.y),1.0,focus);
      for(int j=0;j<4;j++){vec4 b=textRects[j];vec2 d=max(max(b.xy-px,px-b.zw),vec2(0.0));opacity*=mix(1.0,1.0-(1.0-smoothstep(0.0,30.0,length(d)))*.9,1.0-focus);}}`,
    fragmentShader: `varying vec3 tint;varying float opacity;void main(){float r=length(gl_PointCoord-vec2(.5));if(r>.5)discard;gl_FragColor=vec4(tint,(1.0-smoothstep(.12,.5,r))*.70*opacity);}`,
  });
  const scene = new THREE.Scene(), camera = new THREE.Camera(), points = new THREE.Points(geometry, material);
  points.frustumCulled = false; scene.add(points);
  function choose(next: LifeStage, immediate = false) {
    if (disposed) return;
    const ease = progress * progress * (3 - 2 * progress);
    // Retarget from the displayed curve when another form is selected mid-transition.
    const envelope = .17 * 4 * ease * (1 - ease);
    for (let i = 0; i < from.length; i += 3) {
      const dx = target[i] - from[i], dy = target[i + 1] - from[i + 1];
      const arc = envelope ? envelope * Math.sin(phases[i / 3]) : 0;
      from[i] += dx * ease - dy * arc;
      from[i + 1] += dy * ease + dx * arc;
      from[i + 2] += (target[i + 2] - from[i + 2]) * ease;
      for (let c = i; c < i + 3; c++) fromColor[c] += (targetColor[c] - fromColor[c]) * ease;
    }
    stage = next; progress = immediate || !running ? 1 : 0; hold = 0;
    geometry.attributes.position.needsUpdate = true; geometry.attributes.colorFrom.needsUpdate = true;
    target.set(forms[stage].p); targetColor.set(forms[stage].c);
    geometry.attributes.target.needsUpdate = true; geometry.attributes.colorTo.needsUpdate = true;
    options.onStage(stage); loop.redraw();
  }
  function render(time: number) {
    if (disposed) return;
    const dt = previous ? Math.min(.06, (time - previous) / 1000) : 0; previous = time;
    if (running) { elapsed += dt; hold += dt; progress = Math.min(1, progress + dt / 3.5); if (automatic && hold >= 12) choose(nextLifeStage(stage)); }
    const animal = stage < 2;
    // Fit the complete measured XY bounds, including fins and antennae, inside its own canvas.
    const scale = focus ? (animal ? Math.min(width * .22, height * .28) : Math.min(width * .31, height * .29)) : Math.min(width * (animal ? .18 : .25), heroHeight * .18);
    material.uniforms.scale.value = scale;
    material.uniforms.center.value.set(width / 2, height * (focus ? .42 : .5));
    material.uniforms.focus.value = focus ? 1 : 0;
    material.uniforms.viewport.value.set(width, height); material.uniforms.time.value = elapsed; material.uniforms.morph.value = progress; material.uniforms.animal.value = animal ? 1 : 0;
    try { renderer.render(scene, camera); canvas.dataset.lifeFrames = String(++frames); canvas.dataset.lifeProgress = String(progress); canvas.dataset.lifeCount = String(options.count); }
    catch { fail(); }
  }
  const loop = createLifeFrameLoop({ request: callback => window.requestAnimationFrame(callback), cancel: id => window.cancelAnimationFrame(id) }, render);
  const stageElement = canvas.closest(".life-visual-stage");
  function fit() { if (disposed) return; const rect = canvas.getBoundingClientRect();
    const stageBox = stageElement?.getBoundingClientRect() ?? rect;
    heroHeight = Math.max(1, stageBox.height);
    const offsetY = rect.top - stageBox.top;
    material.uniforms.fadeY.value.set(heroHeight * .4 - offsetY, heroHeight * .64 - offsetY);
    [".hero-copy", ".globe-access-slot", ".life-description", ".life-controls"].forEach((selector, i) => { const element = canvas.closest(".hero")?.querySelector(selector); const r = element?.getBoundingClientRect(); material.uniforms.textRects.value[i].set(r ? r.left - rect.left - 3 : -1000, r ? r.top - rect.top - 3 : -1000, r ? r.right - rect.left + 3 : -1000, r ? r.bottom - rect.top + 3 : -1000); }); width = Math.max(1, rect.width); height = Math.max(1, rect.height); renderer.setSize(width, height, false); loop.redraw(); }
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
  resize?.observe(canvas); if (stageElement) resize?.observe(stageElement); window.addEventListener("resize", fit);
  function contextLost(event: Event) { event.preventDefault(); fail(); }
  canvas.addEventListener("webglcontextlost", contextLost);
  function dispose() {
    if (disposed) return; disposed = true; running = false; loop.dispose(); resize?.disconnect(); window.removeEventListener("resize", fit); canvas.removeEventListener("webglcontextlost", contextLost); options.signal.removeEventListener("abort", dispose);
    geometry.dispose(); material.dispose(); scene.clear(); renderer.dispose(); renderer.forceContextLoss();
  }
  function fail() { if (disposed) return; dispose(); options.onError(); }
  renderer.debug.onShaderError = fail;
  options.signal.addEventListener("abort", dispose, { once: true });
  if (options.signal.aborted) { dispose(); throw new DOMException("Aborted", "AbortError"); }
  fit();
  return { setActive(value) { if (disposed) return; running = value; previous = 0; loop.setActive(value); }, setStage: choose, setAuto(value) { automatic = value; hold = 0; }, setFocus(value) { focus = value; fit(); }, redraw: () => loop.redraw(), dispose };
}
