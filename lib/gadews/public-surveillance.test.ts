import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { allHistory, matchesWahisScope, matchesQaadScope } from "./history-reports";
import {
  parseWahis, parseQaad, hasCoordinates, latestWahisEvents,
  filterWahis, filterQaad, computeLayerStats, DISEASE_FILTERS, QAAD_FILTERS,
} from "./public-surveillance";

const event = { event_id: "2", country: "China", disease_id: "WSD", disease_name: "White spot disease", event_start_date: "2025-01-02", latitude: 0, longitude: 0 };
const summary = { summary_id: "same", country_or_territory: "China", disease_id: "WSD", disease_name: "White spot disease", status_summary: "no_information", year: 2025, quarter: 4, latitude: 0, longitude: 0 };

test("arrays and Point collections normalize to the same public event", () => {
  const properties = { event_id: "2", country: "China", disease_id: "WSD", disease_name: "White spot disease", event_start_date: "2025-01-02" };
  const point = { type: "FeatureCollection", features: [{ type: "Feature", properties, geometry: { type: "Point", coordinates: [0, 0] } }] };
  assert.deepEqual(parseWahis(point), parseWahis([event]));
  const shifted = parseWahis({ ...point, features: [{ ...point.features[0], geometry: { type: "Point", coordinates: [120, 30] } }] }).records[0];
  assert.equal(shifted.latitude, 30); assert.equal(shifted.longitude, 120);
});

test("bad roots fail, empty arrays succeed, mixed/all-invalid rows are distinct", () => {
  for (const input of [null, 3, {}, { features: [] }, { type: "FeatureCollection", features: 1 }]) assert.throws(() => parseWahis(input));
  assert.deepEqual(parseWahis([]).records, []);
  const mixed = parseWahis([null, event, { ...event, country: 123 }, { ...event, region: [] }]);
  assert.equal(mixed.records.length, 1); assert.equal(mixed.rejectedCount, 3);
  assert.throws(() => parseWahis([{}]));
  assert.throws(() => parseWahis({ type: "FeatureCollection", features: [{ type: "Feature", properties: event, geometry: { type: "Polygon", coordinates: [] } }] }));
});

test("missing/invalid positions retain list evidence, including explicit invalid point properties", () => {
  for (const value of [undefined, null, NaN, Infinity, 91, "30"]) {
    const result = parseWahis([{ ...event, latitude: value }]);
    assert.equal(result.records.length, 1); assert.equal(hasCoordinates(result.records[0]), false);
  }
  assert.equal(hasCoordinates(parseWahis([event]).records[0]), true);
  assert.equal(hasCoordinates(parseWahis([{ ...event, longitude: 181 }]).records[0]), false);
  const explicit = parseWahis({ type: "FeatureCollection", features: [{ type: "Feature", properties: { ...event, latitude: 500 }, geometry: { type: "Point", coordinates: [0, 30] } }] });
  assert.equal(hasCoordinates(explicit.records[0]), false);
});

test("invalid dates remain unavailable and sorting is stable, date-first and limited to eight", () => {
  const bad = parseWahis([{ ...event, event_start_date: "2025-02-30" }]).records[0];
  assert.equal(bad.event_start_date, null);
  const records = parseWahis([bad, { ...event, event_id: "b" }, { ...event, event_id: "a" }, ...Array.from({ length: 8 }, (_, i) => ({ ...event, event_id: String(i), event_start_date: "2024-01-01" }))]).records;
  assert.deepEqual(latestWahisEvents(records).map((r) => r.event_id), ["a", "b", "0", "1", "2", "3", "4", "5"]);
});

test("QAAD preserves duplicate IDs, unknown/missing evidence, and annual absence", () => {
  const records = parseQaad([summary, { ...summary, status_summary: "unknown" }, { ...summary, status_summary: "absent_in_report_year" }, { ...summary, status_summary: undefined }]).records;
  assert.equal(records.length, 4);
  assert.deepEqual(records.map((r) => r.status_summary), ["no_information", "unknown", "absent_in_report_year", undefined]);
  assert.equal(filterQaad(records, "all", "unknown").length, 2);
  assert.equal(filterQaad(records, "all", "absent_in_quarter").length, 0);
  assert.throws(() => parseQaad([null]));
  assert.throws(() => parseQaad([{ ...summary, positive_months: "yes" }]));
});

test("map filters retain disease/status meaning and count coordinates only", () => {
  const records = parseQaad([summary, { ...summary, disease_id: "new", status_summary: "present_in_quarter" }, { ...summary, latitude: null }]).records;
  assert.equal(filterQaad(records, "other", "priority").length, 1);
  const stats = computeLayerStats(filterQaad(records, "all", "all"), "qaad");
  assert.equal(stats.recordsDisplayed, 2); assert.deepEqual(stats.countries, ["China"]);
  assert.equal(filterWahis(parseWahis([event]).records, "WSD").length, 1);
});

test("real snapshots preserve every row and all existing disease/status filter counts", async () => {
  const wahis: Array<Record<string, unknown>> = JSON.parse(await readFile("public/data/woah-wahis-aquatic-disease-reports.geo.json", "utf8"));
  const qaad: Array<Record<string, unknown>> = JSON.parse(await readFile("public/data/qaad-regional-surveillance-summary.json", "utf8"));
  const w = parseWahis(wahis); const q = parseQaad(qaad);
  assert.equal(w.records.length, 371); assert.equal(w.rejectedCount, 0);
  assert.equal(q.records.length, 1789); assert.equal(q.rejectedCount, 0);
  assert.equal(new Set(q.records.map((r) => r.summary_id)).size, 1784);
  const highlighted = ["WSD", "AHPND", "KHV", "TILV", "EUS", "VHS", "IHN", "SVC"];
  for (const disease of DISEASE_FILTERS) for (const status of QAAD_FILTERS) {
    const expected = qaad.filter((r) => (disease === "all" || (disease === "other" ? !highlighted.includes(String(r.disease_id).toUpperCase()) : String(r.disease_id).toUpperCase() === disease)) && (status === "all" || (status === "priority" ? ["present_in_quarter", "historical_presence_in_report_year"].includes(String(r.status_summary)) : r.status_summary === status)));
    const actual = filterQaad(q.records, disease, status);
    assert.equal(actual.length, expected.length, `${disease}/${status}`);
    assert.deepEqual(actual.map((r) => r.summary_id), expected.map((r) => r.summary_id));
    const stats = computeLayerStats(actual, "qaad");
    assert.deepEqual(new Set(stats.countries), new Set(expected.map((r) => String(r.country_or_territory))));
    const counts = new Map<string, number>();
    expected.forEach((r) => { const id = String(r.disease_id).toUpperCase(); counts.set(id, (counts.get(id) ?? 0) + 1); });
    assert.equal(stats.topDisease, [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "--");
  }
  for (const disease of DISEASE_FILTERS) {
    const expected = wahis.filter((r) => disease === "all" || (disease === "other" ? !highlighted.includes(String(r.disease_id).toUpperCase()) : String(r.disease_id).toUpperCase() === disease));
    assert.deepEqual(filterWahis(w.records, disease).map((r) => r.event_id), expected.map((r) => r.event_id));
  }
});

test("historical scope keeps event dates, published quarters and annual-only reports distinct", () => {
  const scope = { ...allHistory, country: "China", year: "2025", quarter: "4" };
  const events = parseWahis(["2025-09-30", "2025-10-01", "2025-12-31", null].map(event_start_date => ({ ...event, event_start_date }))).records;
  assert.deepEqual(events.filter(row => matchesWahisScope(row, scope)).map(row => row.event_start_date), ["2025-10-01", "2025-12-31"]);
  assert.deepEqual(events.filter(row => matchesWahisScope(row, { ...scope, from: "2025-12-31", to: "2025-12-31" })).map(row => row.event_start_date), ["2025-12-31"]);
  assert.equal(events.filter(row => matchesWahisScope(row, { ...scope, country: "India" })).length, 0);
  assert.equal(events.filter(row => matchesWahisScope(row, allHistory)).length, 4);
  const records = parseQaad([
    { ...summary, year: 2025, quarter: null, report_period: "2025" },
    { ...summary, year: 2025, quarter: 4, report_period: "2025 Q4", status_summary: "absent_in_report_year" },
    { ...summary, year: 2025, quarter: 3, report_period: "2025 Q3" },
  ]).records;
  assert.deepEqual(records.filter(row => matchesQaadScope(row, scope)).map(row => row.status_summary), ["absent_in_report_year"]);
  assert.equal(records.filter(row => matchesQaadScope(row, { ...scope, quarter: "", from: "2023-01-01", to: "2023-06-15" })).length, 3);
  assert.equal(filterQaad(records, `source:${summary.disease_id}`, "all").length, 3);
});
