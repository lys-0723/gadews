import test from "node:test";
import assert from "node:assert/strict";
import { regionalDates, regionalEvidence, effectiveRegionalDay, regionalLayerTime } from "./regional-evidence";
import { type Feed, type Site, type Snapshot } from "./snapshot";

const today = "2026-11-26";
const asOf = Date.parse(today + "T14:00:00Z");
function makeFeed(id: Feed["id"], site: Site, times: string[], values: (number|null)[]): Feed {
  return {
    id, state: "ok", checkedAt: today + "T13:00:00Z", retrievedAt: today + "T12:00:00Z",
    series: [{site, requested: [20.5,111.5], lat: 20.5, lon: 111.5, depthM: 0.49, times,
      source: "https://example.org/model", fields: [{key: "value", unit: "m", values}]}],
  };
}
const snapshot = (...feeds: Feed[]): Snapshot => ({schemaVersion: 1, publishedAt: today, feeds});

test("regional date options are UTC station dates, without borrowing monthly outlook dates", () => {
  const d = snapshot(makeFeed("weather", "guangzhou", [today], [10]),
    makeFeed("salinity", "offshore", ["2026-11-25"], [34]),
    makeFeed("heatwave", "offshore", ["2027-05-01"], [73]));
  assert.deepEqual(regionalDates(d,"offshore",asOf), ["2026-11-25", today]);
  assert.deepEqual(regionalDates(d,"guangzhou",asOf), [today]);
  assert.equal(effectiveRegionalDay([today], "2027-05-01", asOf), today);
});

test("partial day keeps zero, counts only matching times and ignores other places and products", () => {
  const s = makeFeed("weather","guangzhou",[today+"T00:00",today+"T01:00",today+"T02:00","2026-11-27T00:00"],[0,null,3,99]);
  const result = regionalEvidence(snapshot(s),"guangzhou",today,asOf);
  assert.equal(result.state, "dated");
  assert.deepEqual([result.readings[0].low,result.readings[0].high,result.readings[0].count,result.readings[0].total], [0,3,2,3]);
  assert.equal(regionalEvidence(snapshot(s),"zhanjiang",today,asOf).state, "insufficient");
  assert.ok(!result.gaps.some(g => g.id === "salinity"));
});

test("earlier evidence, an empty value, and a retained same-day batch do not trigger current status", () => {
  const f = makeFeed("salinity","offshore",["2026-11-24",today],[2,null]);
  const previous = regionalEvidence(snapshot(f),"offshore",today,asOf);
  assert.equal(previous.state,"historical");
  assert.equal(previous.gaps.find(g=>g.id==="salinity")?.reason,"missing");
  const stale = {...makeFeed("salinity","offshore",[today],[32]), state:"retained" as const};
  const current = regionalEvidence(snapshot(stale),"offshore",today,asOf);
  assert.equal(current.state,"insufficient");
  assert.equal(current.readings[0].old,true);
  assert.equal(regionalEvidence(snapshot(),"offshore",today,asOf).state,"insufficient");
});

test("raster visibility follows the pinned day, and heatwave remains a calendar-month forecast", () => {
  const f = makeFeed("salinity","offshore",[today],[32]);
  f.raster = {time:today+"T00:00:00Z",layer:"salt",style:"default"};
  assert.equal(regionalLayerTime(f,today), f.raster.time);
  assert.equal(regionalLayerTime(f,"2026-11-25"), undefined);
  assert.equal(regionalLayerTime({...f,state:"unavailable"},today),undefined);
  const h = makeFeed("heatwave", "offshore", ["2026-11-01","2026-12-01"], [50,60]);
  assert.equal(regionalLayerTime(h,today),"2026-11-01");
  assert.equal(regionalLayerTime(h,"2027-01-01"),undefined);
});

test("satellite imagery supports only a readable centre and its actual time stamp", () => {
  const f = makeFeed("imerg","zhanjiang",[],[]);
  f.series=[];
  f.imageryTime=today+"T09:00:00Z";
  f.frames=[{site:"zhanjiang",url:"https://example.org/image",png:"iVBOR",rate:null}];
  assert.equal(regionalEvidence(snapshot(f),"zhanjiang",today,asOf).gaps.find(g=>g.id==="imerg")?.reason,"no-rate-class");
  f.frames[0].rate=["Rain Rate",0.1,0.2];
  assert.equal(regionalEvidence(snapshot(f),"zhanjiang",today,asOf).readings[0].interval,true);
  assert.equal(regionalEvidence(snapshot(f),"zhanjiang","2026-11-27",asOf).readings.length,0);
});

test("a missing selected metric does not hide other valid same-day variables", () => {
  const f = makeFeed("weather", "guangzhou", [today], [null]);
  f.series[0].fields = [
    {key: "precipitation", unit: "mm", values: [null]},
    {key: "temperature_2m", unit: "°C", values: [21]},
  ];
  const result = regionalEvidence(snapshot(f), "guangzhou", today, asOf);
  assert.equal(result.state,"dated");
  assert.equal(result.readings[0].variable,"temperature_2m");
});

test("same-day past evidence is distinguished from a future daily forecast or a missing future day", () => {
  const source = makeFeed("weather", "guangzhou", ["2026-11-25", today, "2026-11-27"], [1, 2, 3]);
  const data = snapshot(source);
  assert.equal(regionalEvidence(data,"guangzhou","2026-11-25",asOf).state,"archived");
  assert.equal(regionalEvidence(data,"guangzhou","2026-11-27",asOf).state,"forecast");
  assert.equal(regionalEvidence(data,"guangzhou","2026-11-29",asOf).state,"insufficient");
});

test("daily gap on a monthly forecast date retains the outlook's full period and value", () => {
  const daily = makeFeed("marine","offshore",[today],[25]);
  const monthly = makeFeed("heatwave","offshore",["2026-11-01","2026-12-01"],[20,75]);
  monthly.issueMonth = "2026-11-01";
  const data = snapshot(daily, monthly);
  const result = regionalEvidence(data,"offshore","2026-12-31",asOf);
  assert.equal(result.state,"outlook");
  assert.equal(result.readings.length,0);
  assert.deepEqual(result.outlooks.map(r => [r.first,r.last,r.low]), [["2026-12-01","2026-12-31",75]]);
  assert.equal(regionalEvidence(data,"offshore","2027-01-01",asOf).state,"insufficient");
  monthly.state = "retained";
  assert.equal(regionalEvidence(data,"offshore","2026-12-31",asOf).state,"insufficient");
});

test("weekly outlooks cover exactly seven days and cannot cross locations", () => {
  const weekly = makeFeed("ec46","guangzhou",["2026-11-30"],[0]);
  assert.equal(regionalEvidence(snapshot(weekly),"guangzhou","2026-12-06",asOf).outlooks[0].low,0);
  assert.equal(regionalEvidence(snapshot(weekly),"guangzhou","2026-12-07",asOf).outlooks.length,0);
  assert.equal(regionalEvidence(snapshot(weekly),"andhra","2026-12-06",asOf).outlooks.length,0);
});

test("time span for a value omits empty leading and trailing slots", () => {
  const times = ["00:00","01:00","02:00","03:00"].map(h => today + "T" + h);
  const s = makeFeed("weather","guangzhou",times,[null,0,2,null]);
  const [reading] = regionalEvidence(snapshot(s),"guangzhou",today,asOf).readings;
  assert.deepEqual([reading.first,reading.last,reading.count,reading.total],[times[1],times[2],2,4]);
});
