import { invalidBodies, invalidLimits, invalidQueries } from "./test-support/request-cases";
import assert from "node:assert/strict";
import test from "node:test";
import { createCollectHandler, createObservationsHandler } from "./request-handlers";
import { CollectionRangeError, UnknownAquacultureDeviceError } from "./errors";
import { authorizeCollectorRequest, authorizeReadRequest } from "./auth";
import { collectConfiguredDevices } from "./collector";
import type { RichLinkSettings } from "./types";

const fixedNow = () => new Date("2026-10-28T00:00:00Z");
const request = (body: string) => new Request("http://localhost/api/aquaculture/collect", { method: "POST", body });

test("authorization precedes parsing and service calls", async () => {
  let calls = 0;
  const handler = createCollectHandler({ authorize: () => Response.json({ error: "Unauthorized" }, { status: 401 }), collect: async () => { calls++; return []; }, now: fixedNow, logError: () => {} });
  assert.equal((await handler(request("{"))).status, 401);
  assert.equal(calls, 0);
});

test("invalid collection requests make zero service calls", async () => {
  let calls = 0;
  const handler = createCollectHandler({ authorize: () => null, collect: async () => { calls++; return []; }, now: fixedNow, logError: () => {} });
  for (const body of invalidBodies) {
    assert.equal((await handler(request(body))).status, 400, body);
    assert.equal(calls, 0, body);
  }
});

test("valid collection preserves envelope and sends normalized options once", async () => {
  let calls = 0;
  const handler = createCollectHandler({ authorize: () => null, collect: async (options) => { calls++; assert.deepEqual(options, { deviceKey: "pond-a" }); return []; }, now: fixedNow, logError: () => {} });
  const result = await handler(request('{"deviceKey":"pond-a"}'));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { collectedAt: fixedNow().toISOString(), data: [], count: 0 });
  assert.equal(calls, 1);
});

test("typed selection/range failures are 400 but arbitrary service text is 500", async () => {
  for (const [error, expected] of [[new UnknownAquacultureDeviceError(), 400], [new CollectionRangeError(), 400], [new Error("startDate must be database-password-secret"), 500]] as const) {
    const handler = createCollectHandler({ authorize: () => null, collect: async () => { throw error; }, now: fixedNow, logError: () => {} });
    const response = await handler(request("{}"));
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes("password-secret"));
  }
});

test("history query validates before service but permits inactive device identifiers", async () => {
  let calls = 0;
  const handler = createObservationsHandler({ authorize: () => null, query: async (options) => { calls++; assert.equal(options.deviceKey, "old-disabled-device"); return []; }, logError: () => {} });
  for (const q of [...invalidQueries, ...invalidLimits.map((limit) => new URLSearchParams({ limit }).toString())]) {
    assert.equal((await handler(new Request(`http://localhost/?${q}`))).status, 400, q);
    assert.equal(calls, 0, q);
  }
  const response = await handler(new Request("http://localhost/?deviceKey=old-disabled-device"));
  assert.deepEqual(await response.json(), { data: [], count: 0 });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(calls, 1);
});

test("unknown collection device is rejected before database default evaluation", async () => {
  const settings = { devices: [{ key: "known", enabled: true }] } as RichLinkSettings;
  await assert.rejects(collectConfiguredDevices({ deviceKey: "unknown" }, settings), UnknownAquacultureDeviceError);
});

test("read and collector authorization preserve missing-key and bad-key behavior", () => {
  const names = ["NODE_ENV", "COLLECTOR_SECRET", "AQUACULTURE_API_KEY"] as const;
  const before = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.COLLECTOR_SECRET; delete process.env.AQUACULTURE_API_KEY;
    assert.equal(authorizeReadRequest(new Request("http://localhost"))?.status, 503);
    assert.equal(authorizeCollectorRequest(new Request("http://localhost"))?.status, 503);
    process.env.AQUACULTURE_API_KEY = "local-test"; process.env.COLLECTOR_SECRET = "local-test";
    assert.equal(authorizeReadRequest(new Request("http://localhost"))?.status, 401);
    assert.equal(authorizeCollectorRequest(new Request("http://localhost", { headers: { Authorization: "Bearer local-test" } })), null);
    Reflect.set(process.env, "NODE_ENV", "development"); delete process.env.AQUACULTURE_API_KEY;
    assert.equal(authorizeReadRequest(new Request("http://localhost")), null);
  } finally { for (const n of names) { if (before[n] === undefined) delete process.env[n]; else Reflect.set(process.env, n, before[n]); } }
});

test("real route bindings reject invalid input without vendor/database configuration", async () => {
  const names = ["COLLECTOR_SECRET", "AQUACULTURE_API_KEY", "DATABASE_URL", "RICH_LINK_APP_ID"] as const;
  const before = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    process.env.COLLECTOR_SECRET = "route-test"; process.env.AQUACULTURE_API_KEY = "route-test";
    delete process.env.DATABASE_URL; delete process.env.RICH_LINK_APP_ID;
    const { POST } = await import("@/app/api/aquaculture/collect/route");
    const { GET } = await import("@/app/api/aquaculture/observations/route");
    assert.equal((await POST(new Request("http://localhost", { method: "POST", headers: { Authorization: "Bearer route-test" }, body: "null" }))).status, 400);
    assert.equal((await GET(new Request("http://localhost/?limit=20abc", { headers: { Authorization: "Bearer route-test" } }))).status, 400);
  } finally { for (const n of names) { if (before[n] === undefined) delete process.env[n]; else Reflect.set(process.env, n, before[n]); } }
});

test("observation service errors return sanitized 500 and category-only logs", async () => {
  const logs: unknown[] = [];
  const handler = createObservationsHandler({ authorize: () => null, query: async () => { throw new Error("startDate must be database-password-secret"); }, logError: (entry) => logs.push(entry) });
  const response = await handler(new Request("http://localhost/"));
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Failed to query aquaculture observations" });
  assert.deepEqual(logs, [{ operation: "observations", category: "service_error" }]);
});
