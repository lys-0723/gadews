import assert from "node:assert/strict";
import test from "node:test";
import { filterGlobeReports, groupGlobeReports, placeGlobeLabel, officialReportUrl, globeLocation } from "./globe-reports";
import { parseWahis } from "./public-surveillance";

const rows = parseWahis([
  { event_id: "a", country: "China", disease_id: "WSD", disease_name: "White spot", latitude: 35.86, longitude: 104.19 },
  { event_id: "b", country: "China", disease_id: "AHPND", disease_name: "AHPND", latitude: 35.86, longitude: 104.19 },
  { event_id: "c", country: "Unknown location", disease_id: "WSD", disease_name: "White spot", latitude: null, longitude: null },
  { event_id: "d", country: "Invalid location", disease_id: "EUS", disease_name: "EUS", latitude: 95, longitude: 250 },
  { event_id: "e", country: "Zero", disease_id: "OTHER-ID", disease_name: "Other", latitude: 0, longitude: 0 },
]).records;

test("same centroid keeps each actual report and stable location identity independent of order", () => {
  const groups = groupGlobeReports(rows, "all");
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.find(g => g.latitude === 35.86)?.reports.map(r => r.event_id), ["a", "b"]);
  assert.deepEqual(groupGlobeReports([...rows].reverse(), "all").map(g => g.id), groups.map(g => g.id));
});
test("filters match canonical disease IDs while missing and invalid coordinates stay in the list", () => {
  assert.deepEqual(filterGlobeReports(rows, "WSD").map(r => r.event_id), ["a", "c"]);
  assert.deepEqual(groupGlobeReports(rows, "WSD")[0].reports.map(r => r.event_id), ["a"]);
  assert.equal(groupGlobeReports(rows, "EUS").length, 0);
  assert.deepEqual(filterGlobeReports(rows, "other").map(r => r.event_id), ["e"]);
});
test("long labels reject protected regions, outside bounds and an insufficient eight pixel gap", () => {
  const bounds = { left: 0, top: 0, right: 820, bottom: 820 };
  const title = { left: 0, top: 40, right: 420, bottom: 300 };
  assert.equal(placeGlobeLabel({ left: 400, top: 100, right: 780, bottom: 140 }, [title], bounds), null);
  assert.equal(placeGlobeLabel({ left: 427, top: 100, right: 780, bottom: 140 }, [title], bounds), null);
  assert.ok(placeGlobeLabel({ left: 428, top: 100, right: 780, bottom: 140 }, [title], bounds));
  assert.equal(placeGlobeLabel({ left: 600, top: 600, right: 830, bottom: 640 }, [], bounds), null);
  assert.equal(placeGlobeLabel({ left: NaN, top: 0, right: 50, bottom: 20 }, [], bounds), null);
});
test("geographic projection aligns equator and poles with equirectangular Earth texture", () => {
  assert.deepEqual(globeLocation(0, 0, 1), { x: 1, y: 0, z: -0 });
  assert.ok(Math.abs(globeLocation(90, 0, 1).y - 1) < 1e-9);
  assert.ok(Math.abs(globeLocation(0, 90, 1).z + 1) < 1e-9);
});
test("report links allow only official HTTPS WAHIS hosts", () => {
  assert.equal(officialReportUrl("https://wahis.woah.org/#/event/1"), "https://wahis.woah.org/#/event/1");
  for (const url of ["javascript:alert(1)", "https://wahis.woah.org.attacker.test/", "http://wahis.woah.org/", "https://user:secret@wahis.woah.org/"]) assert.equal(officialReportUrl(url), null);
});
