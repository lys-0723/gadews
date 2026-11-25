import assert from "node:assert/strict";
import test from "node:test";
import { createPublishedMonitoringSource } from "./monitoring-source";

const feed = { id: "published-a", label: "Published A", siteId: "site-a", pondId: "pond-a", maxAgeHours: 1, unitVerificationRef: "Test verification" };
const point = {
  schemaVersion: "1.0", feed, fetchedAt: "2026-10-29T12:00:00Z", observation: {
    observedAt: "2026-10-29T11:50:00Z", ingestedAt: "2026-10-29T11:51:00Z", reference: "test-point",
    metrics: {
      waterTemperatureC: { value: 29, unit: "°C", state: "usable", issues: [] },
      dissolvedOxygenMgL: { value: 5.2, unit: "mg/L", state: "usable", issues: [] },
      ph: { value: 8.2, unit: "pH", state: "usable", issues: [] },
    },
  },
};

test("published source keeps original URLs, no-store and cancellation while returning parsed DTOs", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const source = createPublishedMonitoringSource(async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json(requests.length === 1 ? { schemaVersion: "1.0", feeds: [feed] } : point);
  });
  const signal = new AbortController().signal;
  assert.equal(source.kind, "published");
  assert.equal((await source.listFeeds(signal))[0].id, "published-a");
  assert.equal((await source.readLatest("pond / ?&", signal)).observation?.metrics.ph.value, 8.2);
  assert.deepEqual(requests.map(({ url }) => url), ["/api/monitoring/feeds", "/api/monitoring/latest?feedId=pond%20%2F%20%3F%26"]);
  for (const request of requests) { assert.equal(request.init?.cache, "no-store"); assert.equal(request.init?.signal, signal); }
});

test("published source never exposes HTTP response bodies or transport errors", async () => {
  for (const status of [400, 401, 500, 503]) {
    const source = createPublishedMonitoringSource(async () => new Response("secret DB connection string", { status }));
    const expected = status === 503 ? "Monitoring is not configured or is temporarily unavailable." : "Monitoring could not be loaded. Retry the request.";
    await assert.rejects(source.listFeeds(), { message: expected });
    await assert.rejects(source.readLatest("a"), { message: expected });
  }
  const source = createPublishedMonitoringSource(async () => { throw new Error("secret transport details"); });
  await assert.rejects(source.listFeeds(), { message: "Monitoring returned invalid data. Retry the request." });
});

test("published source rejects malformed and private DTO fields without a fallback", async () => {
  const cases = [
    { schemaVersion: "1.0", feeds: [{ ...feed, deviceKey: "private" }] },
    { schemaVersion: "1.0", feeds: [feed, feed] },
    { schemaVersion: "1.0", feeds: [] , origin: "demo" },
  ];
  for (const value of cases) {
    const source = createPublishedMonitoringSource(async () => Response.json(value));
    await assert.rejects(source.listFeeds(), { message: "Monitoring returned invalid data. Retry the request." });
  }
  for (const value of [{ ...point, origin: "demo" }, { ...point, observation: { ...point.observation, metrics: { ...point.observation.metrics, ph: { value: 99, unit: "pH", state: "usable", issues: [] } } } }]) {
    const source = createPublishedMonitoringSource(async () => Response.json(value));
    await assert.rejects(source.readLatest("published-a"), { message: "Monitoring returned invalid data. Retry the request." });
  }
});

test("published cancellation rejects AbortError even when transport ignores the signal", async () => {
  const already = new AbortController(); already.abort(); let calls = 0;
  const source = createPublishedMonitoringSource(async () => { calls += 1; return Response.json({ schemaVersion: "1.0", feeds: [] }); });
  await assert.rejects(source.listFeeds(already.signal), { name: "AbortError" });
  assert.equal(calls, 0);
  let resolve!: (value: Response) => void;
  const pendingSource = createPublishedMonitoringSource(() => new Promise((done) => { resolve = done; }));
  const pending = new AbortController();
  const result = pendingSource.readLatest("published-a", pending.signal);
  pending.abort(); resolve(Response.json(point));
  await assert.rejects(result, { name: "AbortError" });
});

test("default published source resolves fetch at request time and returns caller-owned copies", async () => {
  const original = globalThis.fetch;
  const source = createPublishedMonitoringSource();
  try {
    globalThis.fetch = async () => Response.json({ schemaVersion: "1.0", feeds: [feed] });
    const first = await source.listFeeds(); first[0].label = "changed";
    assert.equal((await source.listFeeds())[0].label, "Published A");
    globalThis.fetch = async () => Response.json(point);
    assert.equal((await source.readLatest("published-a")).feed.id, "published-a");
  } finally { globalThis.fetch = original; }
});
