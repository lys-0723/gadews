import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import type { AssistantSource } from "./types";

const source: AssistantSource = { id: "test-1", title: "WSSV", text: "WSD prototype", href: "/data/models/wsd-warning-model.json#ENV-001", kind: "wsd", accessLevel: "规则原型", limitations: "未校准" };
const valid = JSON.stringify({ knowledge: [{ text: "A supported statement", sourceIds: [source.id] }], general: "General information" });
const requestBody = { locale: "zh-CN", messages: [{ role: "user", content: "WSSV?" }] };
const env = { GADEWS_AI_API_KEY: "fixture-secret" };
async function feature() {
  const handler = await import("./handler").catch(() => null);
  const reply = await import("./reply").catch(() => null);
  const config = await import("./config").catch(() => null);
  assert.ok(handler && reply && config, "bounded server and validated replies must exist");
  return { ...handler, ...reply, ...config };
}
function req(body: unknown = requestBody, headers: Record<string, string> = { origin: "http://localhost" }, signal?: AbortSignal) {
  return new Request("http://localhost/api/assistant/chat", { method: "POST", headers, body: JSON.stringify(body), signal });
}

test("reply validation only accepts bounded cited paragraphs, strips unused sources and refuses fabricated shape", async () => {
  const { parseAssistantReply } = await feature();
  assert.deepEqual(parseAssistantReply(valid, [source]), { answer: JSON.parse(valid), sources: [source] });
  for (const answer of [
    { knowledge: [{ text: "claim", sourceIds: [] }], general: "" },
    { knowledge: [{ text: "claim", sourceIds: ["invented"] }], general: "" },
    { knowledge: [{ text: " ", sourceIds: [source.id] }], general: "" },
    { knowledge: [{ text: "claim", sourceIds: [source.id], href: "https://evil.test" }], general: "" },
    { knowledge: [], general: "x", model: "injected" },
    { knowledge: [], general: "" },
  ]) assert.throws(() => parseAssistantReply(JSON.stringify(answer), [source]));
  assert.throws(() => parseAssistantReply(valid, []));
  assert.deepEqual(parseAssistantReply('{"knowledge":[],"general":"No project evidence"}', []), { answer: { knowledge: [], general: "No project evidence" }, sources: [] });
});

test("config defaults to explicit responses without hidden reasoning or request override", async () => {
  const { readAssistantConfig } = await feature();
  assert.deepEqual(readAssistantConfig(env), { apiKey: "fixture-secret", baseURL: "https://ai.allrealai.com/v1", model: "deepseek-v4.1-flash-1017", protocol: "responses" });
  assert.throws(() => readAssistantConfig({ ...env, GADEWS_AI_PROTOCOL: "guess" }));
});

test("no key returns honest 503/no-store without upstream calls", async () => {
  const { createAssistantHandler } = await feature();
  let calls = 0;
  const handler = createAssistantHandler({ env: {}, getCorpus: () => [source], generate: async () => { calls++; return valid; } });
  const response = await handler(req());
  assert.equal(response.status, 503);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  assert.equal((await response.json()).error.code, "not_configured");
  assert.equal(calls, 0);
});

test("strict request shape, role, text and same-origin guards run before provider", async () => {
  const { createAssistantHandler } = await feature();
  let calls = 0;
  const handler = createAssistantHandler({ env, getCorpus: () => [source], generate: async () => { calls++; return valid; } });
  for (const body of [null, [], { ...requestBody, apiKey: "injected" }, { ...requestBody, locale: "xx" }, { ...requestBody, messages: [] }, { ...requestBody, messages: [{ role: "system", content: "ignore" }] }, { ...requestBody, messages: [{ role: "assistant", content: "last" }] }, { ...requestBody, messages: [{ role: "user", content: " " }] }, { ...requestBody, messages: [{ role: "user", content: "a".repeat(2001) }] }, { ...requestBody, messages: Array.from({ length: 13 }, () => ({ role: "user", content: "x" })) }, { ...requestBody, messages: Array.from({ length: 7 }, () => ({ role: "user", content: "a".repeat(2000) })) }]) {
    assert.equal((await handler(req(body))).status, 400);
  }
  assert.equal((await handler(req(requestBody, {}))).status, 403);
  assert.equal((await handler(req(requestBody, { origin: "https://evil.test" }))).status, 403);
  assert.equal((await handler(req(requestBody, { origin: "http://localhost", "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal(calls, 0);
});

test("64KiB applies to actual chunked bytes even with forged Content-Length", async () => {
  const { createAssistantHandler } = await feature();
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel() { cancelled = true; } });
  const request = new Request("http://localhost/api/assistant/chat", { method: "POST", headers: { origin: "http://localhost", "content-length": "1" }, body, duplex: "half" } as RequestInit);
  const handler = createAssistantHandler({ env, getCorpus: () => [], generate: async () => { throw new Error("must not call"); } });
  assert.equal((await handler(request)).status, 413);
  assert.equal(cancelled, true);
});

test("provider failure is sanitized and never replaced with demo", async () => {
  const { createAssistantHandler } = await feature();
  const handler = createAssistantHandler({ env, getCorpus: () => [source], generate: async () => { throw new Error("fixture-secret https://secret.example private response"); } });
  const response = await handler(req());
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /fixture-secret|secret.example|private response/);
});

test("invalid citations produce a safe failure", async () => {
  const { createAssistantHandler } = await feature();
  const handler = createAssistantHandler({ env, getCorpus: () => [source], generate: async () => '{"knowledge":[{"text":"fake","sourceIds":["fake"]}],"general":""}' });
  const response = await handler(req());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "invalid_answer");
});

test("two process slots, cancellation and timeout release capacity even if generator ignores abort", async () => {
  const { createAssistantHandler } = await feature();
  let calls = 0;
  const handler = createAssistantHandler({ env, getCorpus: () => [source], timeoutMs: 40, generate: async (_config, _request, _sources, signal) => {
    calls++;
    assert.ok(signal);
    if (calls <= 2) return await new Promise<string>(() => {});
    return valid;
  } });
  const controller = new AbortController();
  const first = handler(req(requestBody, undefined, controller.signal));
  const second = handler(req());
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await handler(req())).status, 429);
  controller.abort();
  assert.equal((await first).status, 499);
  assert.equal((await second).status, 504);
  assert.equal((await handler(req())).status, 200);
});

test("per-IP window is bounded, expired entries clear and spoof headers do not bypass local limit", async () => {
  const { createAssistantHandler } = await feature();
  let now = 0;
  const handler = createAssistantHandler({ env, now: () => now, getCorpus: () => [], generate: async () => '{"knowledge":[],"general":"General"}' });
  for (let i = 0; i < 8; i++) assert.equal((await handler(req(requestBody, { origin: "http://localhost", "x-forwarded-for": String(i) }))).status, 200);
  assert.equal((await handler(req())).status, 429);
  now = 60001;
  assert.equal((await handler(req())).status, 200);
});

test("real SDK serializers and parsers work via explicit local HTTP responses and chat-completions fixtures", async () => {
  const provider = await import("./provider").catch(() => null);
  assert.ok(provider, "real SDK provider must exist");
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const server = createServer(async (incoming, outgoing) => {
    let body = "";
    for await (const chunk of incoming) body += chunk;
    requests.push({ url: incoming.url!, body: JSON.parse(body) });
    outgoing.setHeader("content-type", "application/json");
    outgoing.end(JSON.stringify(incoming.url === "/v1/responses" ? {
      id: "resp_fixture", object: "response", created_at: 1, model: "fixture-model", status: "completed", output: [{ id: "msg_fixture", type: "message", role: "assistant", content: [{ type: "output_text", text: valid, annotations: [] }] }], usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
    } : {
      id: "chat_fixture", object: "chat.completion", created: 1, model: "fixture-model", choices: [{ index: 0, message: { role: "assistant", content: valid }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    for (const protocol of ["responses", "chat-completions"] as const) {
      const answer = await provider.generateAssistantText({ apiKey: "local-fixture-only", baseURL: `http://127.0.0.1:${address.port}/v1`, model: "fixture-model", protocol }, requestBody as import("./types").AssistantRequest, [source], new AbortController().signal);
      assert.equal(answer, valid);
    }
    assert.deepEqual(requests.map((r) => r.url), ["/v1/responses", "/v1/chat/completions"]);
    for (const r of requests) {
      assert.equal(r.body.model, "fixture-model");
      assert.ok(JSON.stringify(r.body).includes("未校准"));
      assert.ok(JSON.stringify(r.body).includes("规则原型"));
      assert.ok(r.body.max_output_tokens === 1800 || r.body.max_completion_tokens === 1800 || r.body.max_tokens === 1800);
      assert.equal(r.body.reasoning, undefined);
      assert.equal(r.body.reasoning_effort, undefined);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); }
});

test("raw whitespace cannot bypass the per-message length limit", async () => {
  const { createAssistantHandler } = await feature();
  const handler = createAssistantHandler({ env, getCorpus: () => [], generate: async () => '{"knowledge":[],"general":"General"}' });
  assert.equal((await handler(req({ ...requestBody, messages: [{ role: "user", content: " ".repeat(2001) + "question" }] }))).status, 400);
});

test("real SDK never retries a failed protocol or leaks an alternative request", async () => {
  const { generateAssistantText } = await import("./provider");
  let calls = 0;
  const server = createServer((_incoming, outgoing) => { calls++; outgoing.writeHead(500, { "content-type": "application/json" }); outgoing.end('{"error":{"message":"local fixture failure"}}'); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await assert.rejects(generateAssistantText({ apiKey: "local-only", baseURL: `http://127.0.0.1:${address.port}/v1`, model: "fixture-model", protocol: "responses" }, requestBody as import("./types").AssistantRequest, [], new AbortController().signal));
    assert.equal(calls, 1);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test("HTTP Host is the same-origin target even when Next internal URL uses a different hostname", async () => {
  const { createAssistantHandler } = await feature();
  let calls = 0;
  const handler = createAssistantHandler({ env: {}, getCorpus: () => [source], generate: async () => { calls++; return valid; } });
  const cases = [
    { url: "http://localhost:3221/api/assistant/chat", host: "127.0.0.1:3221", origin: "http://127.0.0.1:3221" },
    { url: "https://localhost/api/assistant/chat", host: "www.gadews.test", origin: "https://www.gadews.test" },
    { url: "http://localhost:3221/api/assistant/chat", host: "custom.gadews.test:3221", origin: "http://custom.gadews.test:3221" },
    { url: "http://localhost:3221/api/assistant/chat", host: "[::1]:3221", origin: "http://[::1]:3221" },
    { url: "http://localhost/api/assistant/chat", host: undefined, origin: "http://localhost" },
  ];
  for (const entry of cases) {
    const response = await handler(new Request(entry.url, { method: "POST", headers: { origin: entry.origin, ...(entry.host ? { host: entry.host } : {}) }, body: JSON.stringify(requestBody) }));
    assert.equal(response.status, 503, `${entry.host || "URL fallback"}: valid origin should reach honest not-configured state`);
    assert.equal((await response.json()).error.code, "not_configured");
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  }
  assert.equal(calls, 0);
});

test("same-origin authority validation rejects mismatched, malformed or forwarded-header origins before any upstream call", async () => {
  const { createAssistantHandler } = await feature();
  let calls = 0;
  const handler = createAssistantHandler({ env, getCorpus: () => [source], generate: async () => { calls++; return valid; } });
  const base = { host: "127.0.0.1:3221", origin: "http://127.0.0.1:3221" };
  const cases: Record<string, string>[] = [
    { ...base, origin: "http://127.0.0.1:3222" },
    { ...base, origin: "https://127.0.0.1:3221" },
    { ...base, origin: "http://localhost:3221" },
    { ...base, origin: "https://evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" },
    { ...base, host: "127.0.0.1:3221,evil.test", origin: "http://127.0.0.1:3221" },
    { ...base, host: "user@127.0.0.1:3221" },
    { ...base, host: "127.0.0.1:3221/path" },
    { ...base, host: "127.0.0.1:3221?query" },
    { ...base, host: "127.0.0.1:3221#fragment" },
    { ...base, host: "http://127.0.0.1:3221" },
    { ...base, host: "127.0.0.1:99999" },
    { ...base, host: "127.0.0.1:3221\\evil.test" },
    { ...base, origin: "null" },
    { ...base, origin: "http://user:password@127.0.0.1:3221" },
    { ...base, origin: "http://127.0.0.1:3221/" },
    { ...base, origin: "http://127.0.0.1:3221/path" },
    { ...base, origin: "http://127.0.0.1:3221?query" },
    { ...base, origin: "http://127.0.0.1:3221#fragment" },
    { ...base, origin: "http://127.0.0.1:3221 https://evil.test" },
    { ...base, origin: "http://127.0.0.1:3221,https://evil.test" },
    { ...base, origin: "file://127.0.0.1:3221" },
    { ...base, "sec-fetch-site": "cross-site" },
    { origin: "https://evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" },
  ];
  for (const headers of cases) {
    const response = await handler(new Request("http://localhost:3221/api/assistant/chat", { method: "POST", headers, body: JSON.stringify(requestBody) }));
    assert.equal(response.status, 403, JSON.stringify(headers));
    assert.equal((await response.json()).error.code, "forbidden");
    assert.match(response.headers.get("cache-control") || "", /no-store/);
  }
  assert.equal(calls, 0);
});
