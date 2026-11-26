import assert from "node:assert/strict";
import test from "node:test";
import { createMonitoringFeedsHandler, createMonitoringLatestHandler } from "./monitoring-handlers";
import { readMonitoringPublication } from "./monitoring-publication";
import { parseMonitoringFeeds, parseMonitoringSnapshot } from "./monitoring-types";

const feed = { id: "synthetic", label: "Synthetic pond", deviceKey: "PRIVATE_DEVICE", siteId: "site-a", pondId: "pond-a", maxAgeHours: 2, unitVerificationRef: "Synthetic verification" };
const published = () => readMonitoringPublication({ GADEWS_MONITORING_PUBLIC_FEEDS_JSON: JSON.stringify({ publish: true, feeds: [feed] }) });
const fixedNow = () => new Date("2026-10-29T10:00:00Z");
const record = { deviceKey: "PRIVATE_DEVICE", siteId: "site-a", pondId: "pond-a", observedAt: "2026-10-29T09:00:00Z", ingestedAt: "2026-10-29T09:01:00Z", waterTemperatureC: 20, dissolvedOxygenMgL: 0, ph: 7, qualityFlags: [], rawPayload: { private: "RAW_PRIVATE" }, upstreamDeviceId: "UPSTREAM_PRIVATE", password: "SECRET_PRIVATE" };
const request = (query = "feedId=synthetic") => new Request(`http://localhost/api/monitoring/latest?${query}`);

test("closed or invalid publication gives no-store 503 before any database query", async () => {
  let queries = 0;
  for (const publication of [() => readMonitoringPublication({}), () => readMonitoringPublication({ GADEWS_MONITORING_PUBLIC_FEEDS_JSON: "private-invalid" }), () => { throw new Error("CONFIG_PRIVATE"); }]) {
    const handler = createMonitoringLatestHandler({ publication, query: async () => { queries++; return []; }, now: fixedNow });
    const response = await handler(request());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.ok(!(await response.text()).includes("PRIVATE"));
  }
  assert.equal(queries, 0);
});

test("catalog publishes only fixed public fields and never queries", async () => {
  const response = await createMonitoringFeedsHandler({ publication: published })(request(""));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body: unknown = await response.json();
  const feeds = parseMonitoringFeeds(body);
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].siteId, "site-a");
  assert.ok(!JSON.stringify(body).includes("PRIVATE"));
  const unavailable = await createMonitoringFeedsHandler({ publication: () => readMonitoringPublication({}) })(request(""));
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
});

test("missing, repeated, extra and malformed latest selectors reject with zero queries", async () => {
  let queries = 0;
  const handler = createMonitoringLatestHandler({ publication: published, now: fixedNow, query: async () => { queries++; return []; } });
  for (const query of ["", "feedId=", "feedId=synthetic&feedId=synthetic", "feedId=synthetic&siteId=site-a", "feedId=synthetic&unknown=1", "feedId=../private", "feedId=%20synthetic", "deviceKey=PRIVATE_DEVICE"]) {
    const response = await handler(request(query));
    assert.equal(response.status, 400, query);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const unknown = await handler(request("feedId=other"));
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("Cache-Control"), "no-store");
  assert.equal(queries, 0);
});

test("latest sends exact configured scope with limit one and returns only safe DTO", async () => {
  let queries = 0;
  const response = await createMonitoringLatestHandler({ publication: published, now: fixedNow, query: async (options) => {
    queries++;
    assert.deepEqual(options, { deviceKey: "PRIVATE_DEVICE", siteId: "site-a", pondId: "pond-a", limit: 1 });
    return [record];
  } })(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body: unknown = await response.json();
  const snapshot = parseMonitoringSnapshot(body);
  assert.equal(snapshot.observation?.metrics.dissolvedOxygenMgL.value, 0);
  assert.equal(snapshot.observation?.reference, "monitoring:synthetic:2026-10-29T09:00:00.000Z");
  assert.equal(queries, 1);
  assert.ok(!JSON.stringify(body).includes("PRIVATE"));
});

test("an empty published feed returns 200 with a null observation", async () => {
  const response = await createMonitoringLatestHandler({ publication: published, now: fixedNow, query: async () => [] })(request());
  assert.equal(response.status, 200);
  assert.equal(parseMonitoringSnapshot(await response.json()).observation, null);
});

test("identity mismatches, unexpected result counts and private failures are sanitized", async () => {
  const logs: unknown[] = [];
  for (const result of [[{ ...record, deviceKey: "other" }], [{ ...record, siteId: "other" }], [{ ...record, pondId: null }], [record, record], null, {}, [null]]) {
    const response = await createMonitoringLatestHandler({ publication: published, now: fixedNow, query: async () => result, logError: (entry) => logs.push(entry) })(request());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.ok(!(await response.text()).includes("PRIVATE"));
  }
  const failed = await createMonitoringLatestHandler({ publication: published, now: fixedNow, query: async () => { throw new Error("DATABASE_SECRET_PRIVATE"); }, logError: (entry) => logs.push(entry) })(request());
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("PRIVATE"));
  assert.ok(logs.length > 0);
  assert.ok(!JSON.stringify(logs).includes("PRIVATE"));
  assert.ok(logs.every((entry) => typeof entry === "object" && entry !== null && Object.keys(entry).sort().join() === "category,operation"));
});

test("an invalid fetch clock is sanitized and prevents database access", async () => {
  let queries = 0;
  const logs: unknown[] = [];
  const response = await createMonitoringLatestHandler({ publication: published, now: () => new Date(Number.NaN), query: async () => { queries++; return []; }, logError: (entry) => logs.push(entry) })(request());
  assert.equal(response.status, 503);
  assert.equal(queries, 0);
  assert.deepEqual(logs, [{ operation: "monitoring", category: "invalid_clock" }]);
});

test("real route bindings stay closed without DB or vendor configuration", async (t) => {
  const logs: unknown[] = [];
  t.mock.method(console, "error", (entry: unknown) => { logs.push(entry); });
  const before = process.env.GADEWS_MONITORING_PUBLIC_FEEDS_JSON;
  try {
    delete process.env.GADEWS_MONITORING_PUBLIC_FEEDS_JSON;
    const feeds = await import("@/app/api/monitoring/feeds/route");
    const latest = await import("@/app/api/monitoring/latest/route");
    for (const response of [await feeds.GET(request("")), await latest.GET(request())]) {
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), { error: "Monitoring is unavailable" });
    }
    assert.deepEqual(logs, [{ operation: "monitoring", category: "publication_unavailable" }, { operation: "monitoring", category: "publication_unavailable" }]);
  } finally {
    if (before === undefined) delete process.env.GADEWS_MONITORING_PUBLIC_FEEDS_JSON;
    else process.env.GADEWS_MONITORING_PUBLIC_FEEDS_JSON = before;
  }
});
