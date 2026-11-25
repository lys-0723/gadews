import assert from "node:assert/strict";
import test from "node:test";
import { parseMonitoringFeeds, parseMonitoringSnapshot } from "./monitoring-types";

const feed = { id: "synthetic", label: "Synthetic pond", siteId: "site-a", pondId: "pond-a", maxAgeHours: 2, unitVerificationRef: "Synthetic units record" };
function snapshot() {
  return {
    schemaVersion: "1.0", feed: { ...feed }, fetchedAt: "2026-10-29T10:00:00Z",
    observation: {
      observedAt: "2026-10-29T09:00:00Z", ingestedAt: "2026-10-29T09:01:00Z", reference: "monitoring:synthetic:2026-10-29T09:00:00Z",
      metrics: {
        waterTemperatureC: { value: 0, unit: "°C", state: "usable", issues: [] },
        dissolvedOxygenMgL: { value: null, unit: "mg/L", state: "missing", issues: ["missing_value"] },
        ph: { value: 7, unit: "pH", state: "usable", issues: [] },
      },
    },
  };
}

test("wire decoders preserve zero and return a detached fixed-field DTO", () => {
  const raw = snapshot();
  const parsed = parseMonitoringSnapshot(raw);
  assert.equal(parsed.observation?.metrics.waterTemperatureC.value, 0);
  raw.feed.label = "changed";
  assert.equal(parsed.feed.label, "Synthetic pond");
  assert.deepEqual(parseMonitoringFeeds({ schemaVersion: "1.0", feeds: [feed] }), [feed]);
  assert.equal(parseMonitoringSnapshot({ ...snapshot(), observation: null }).observation, null);
});

test("wire decoders reject malformed roots, units, enums, private extras and numeric strings", () => {
  for (const raw of [null, [], {}, { schemaVersion: "2.0", feeds: [] }, { schemaVersion: "1.0", feeds: [{ ...feed, deviceKey: "private" }] }]) {
    assert.throws(() => parseMonitoringFeeds(raw), /Invalid monitoring/);
  }
  for (const [key, value] of [["unit", "F"], ["state", "online"], ["value", "12"], ["value", Number.NaN], ["value", Number.POSITIVE_INFINITY]] as const) {
    const raw = snapshot();
    Reflect.set(raw.observation.metrics.waterTemperatureC, key, value);
    assert.throws(() => parseMonitoringSnapshot(raw), /Invalid monitoring/);
  }
  const extra = snapshot();
  Reflect.set(extra.observation, "deviceKey", "private");
  assert.throws(() => parseMonitoringSnapshot(extra), /Invalid monitoring/);
});

test("wire decoders prevent usable claims with missing or invalid observation times", () => {
  for (const time of [null, "", "2026-02-30T09:00:00Z", "2026-10-29T09:00:00", "not-a-date"]) {
    const raw = snapshot();
    Reflect.set(raw.observation, "observedAt", time);
    assert.throws(() => parseMonitoringSnapshot(raw), /Invalid monitoring/);
  }
  const invalid = snapshot();
  Reflect.set(invalid.observation, "observedAt", null);
  Reflect.set(invalid.observation, "ingestedAt", null);
  for (const metric of Object.values(invalid.observation.metrics)) { metric.state = metric.value === null ? "missing" : "invalid"; Reflect.set(metric, "issues", ["invalid_time"]); }
  assert.equal(parseMonitoringSnapshot(invalid).observation?.observedAt, null);
});

test("wire decoders reject contradictory usable unit, missing value, quality and chronology", () => {
  const changes = [
    (raw: ReturnType<typeof snapshot>) => { Reflect.set(raw.feed, "unitVerificationRef", null); },
    (raw: ReturnType<typeof snapshot>) => { Reflect.set(raw.observation.metrics.ph, "value", null); },
    (raw: ReturnType<typeof snapshot>) => { raw.observation.metrics.ph.value = 15; },
    (raw: ReturnType<typeof snapshot>) => { Reflect.set(raw.observation.metrics.ph, "issues", ["invalid_time"]); },
    (raw: ReturnType<typeof snapshot>) => { Reflect.set(raw.observation, "ingestedAt", null); },
    (raw: ReturnType<typeof snapshot>) => { raw.observation.ingestedAt = "2026-10-29T08:00:00Z"; },
    (raw: ReturnType<typeof snapshot>) => { raw.observation.observedAt = "2026-10-29T10:00:01Z"; },
    (raw: ReturnType<typeof snapshot>) => { raw.fetchedAt = "not-a-date"; },
  ];
  for (const change of changes) { const raw = snapshot(); change(raw); assert.throws(() => parseMonitoringSnapshot(raw), /Invalid monitoring/); }
});
