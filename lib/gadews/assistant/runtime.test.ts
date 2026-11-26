import assert from "node:assert/strict";
import test from "node:test";
async function feature() { const value = await import("./runtime").catch(() => null); assert.ok(value, "shared model runtime must exist"); return value; }
const env = {};
const request = (signal?: AbortSignal) => new Request("http://localhost/api", { method: "POST", headers: { origin: "http://localhost" }, body: "{}", signal });
test("two independent callers share two slots and every completion releases exactly once", async () => {
  const { createModelBudget, runModelCall } = await feature(); const budget = createModelBudget();
  let finish!: (value: string) => void;
  const first = runModelCall(request(), budget, env, 1000, () => new Promise<string>(resolve => { finish = resolve; }));
  const abort = new AbortController();
  const second = runModelCall(request(abort.signal), budget, env, 1000, async () => new Promise<string>(() => {}));
  await assert.rejects(runModelCall(request(), budget, env, 1000, async () => "third"), error => (error as {code:string}).code === "busy");
  abort.abort(); await assert.rejects(second, error => (error as {code:string}).code === "cancelled");
  assert.equal(await runModelCall(request(), budget, env, 1000, async () => "replacement"), "replacement");
  finish("first"); assert.equal(await first, "first");
});
test("shared IP window applies across callers, ignores spoofed forwarding and expires", async () => {
  const { createModelBudget, runModelCall } = await feature(); let now = 0; const budget = createModelBudget(() => now);
  for (let i=0;i<8;i++) assert.equal(await runModelCall(request(), budget, env, 100, async () => i), i);
  await assert.rejects(runModelCall(new Request("http://localhost", {headers:{"x-forwarded-for":"another"}}), budget, env, 100, async () => 9), error => (error as {code:string}).code === "rate_limited");
  now = 60001; assert.equal(await runModelCall(request(), budget, env, 100, async () => "new"), "new");
});
test("per-call deadlines differ while a timed-out generator cannot retain a shared slot", async () => {
  const { createModelBudget, runModelCall } = await feature(); const budget = createModelBudget();
  await assert.rejects(runModelCall(request(), budget, env, 10, async () => new Promise(() => {})), error => (error as {code:string}).code === "timeout");
  assert.equal(await runModelCall(request(), budget, env, 100, async () => "after timeout"), "after timeout");
});
test("shared origin guards normal Host and byte reader rejects forged length and aborts a pending body", async () => {
  const { hasSameOrigin, readBoundedJson } = await feature();
  assert.equal(hasSameOrigin(new Request("http://localhost/api",{headers:{host:"127.0.0.1:3221",origin:"http://127.0.0.1:3221"}})),true);
  assert.equal(hasSameOrigin(new Request("http://localhost/api",{headers:{origin:"https://evil.test","x-forwarded-host":"evil.test"}})),false);
  let cancelled=false;
  const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(65537));},cancel(){cancelled=true;}});
  await assert.rejects(readBoundedJson(new Request("http://localhost",{method:"POST",headers:{"content-length":"1"},body,duplex:"half"} as RequestInit)), error => (error as {code:string}).code==="body_too_large");
  assert.equal(cancelled,true);
  const controller=new AbortController();const waiting=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
  const read=readBoundedJson(new Request("http://localhost",{method:"POST",body:waiting,duplex:"half",signal:controller.signal} as RequestInit));controller.abort();
  await assert.rejects(read,error=>(error as {code:string}).code==="cancelled");
});
