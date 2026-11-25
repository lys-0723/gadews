import assert from "node:assert/strict";
import test from "node:test";
import { readMonitoringPublication } from "./monitoring-publication";

const feed = { id: "synthetic", label: "Synthetic pond", deviceKey: "PRIVATE_DEVICE", siteId: "site-a", pondId: "pond-a", maxAgeHours: 2 };
const publication = (value: unknown) => readMonitoringPublication({ GADEWS_MONITORING_PUBLIC_FEEDS_JSON: JSON.stringify(value) });

test("publication remains closed unless publish is exactly true", () => {
  for (const value of [undefined, "", "   "]) assert.equal(readMonitoringPublication({ GADEWS_MONITORING_PUBLIC_FEEDS_JSON: value }).status, "closed");
  for (const value of [{}, { publish: false }, { publish: "true" }, { feeds: [feed] }]) assert.notEqual(publication(value).status, "published");
  assert.equal(readMonitoringPublication({ GADEWS_MONITORING_PUBLIC_FEEDS_JSON: "{secret-invalid" }).status, "invalid");
});

test("publication validates exact identities, explicit finite freshness and fixed limits", () => {
  const invalid = [
    { ...feed, id: "../other" }, { ...feed, siteId: " " }, { ...feed, pondId: null }, { ...feed, deviceKey: "" },
    { ...feed, label: "" }, { ...feed, maxAgeHours: undefined }, { ...feed, maxAgeHours: 0 }, { ...feed, maxAgeHours: -1 },
    { ...feed, maxAgeHours: "2" }, { ...feed, maxAgeHours: 168.1 }, { ...feed, extra: "private" }, { ...feed, unitVerificationRef: " " },
  ];
  for (const candidate of invalid) assert.equal(publication({ publish: true, feeds: [candidate] }).status, "invalid");
  for (const feeds of [[feed, feed], [], Array.from({ length: 33 }, (_, i) => ({ ...feed, id: `feed-${i}` }))]) assert.equal(publication({ publish: true, feeds }).status, "invalid");
  assert.equal(publication({ publish: true, feeds: [feed], extra: "private" }).status, "invalid");
});

test("published feed preserves private binding and defaults absent unit verification to null", () => {
  const parsed = publication({ publish: true, feeds: [{ ...feed, maxAgeHours: 168 }] });
  assert.equal(parsed.status, "published");
  if (parsed.status !== "published") throw new Error("Expected publication");
  assert.deepEqual(parsed.feeds, [{ ...feed, maxAgeHours: 168, unitVerificationRef: null }]);
});
