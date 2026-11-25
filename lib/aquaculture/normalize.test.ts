import assert from "node:assert/strict";
import test from "node:test";
import { discoverMetricMapping, normalizeRichLinkHistoryRow } from "./normalize";

const device = {
  key: "pond-a-sensor",
  upstreamDeviceId: "external-id",
  siteId: "site-a",
  pondId: "pond-a",
  name: "Pond A sensor",
  enabled: true,
};

test("discovers temperature, dissolved oxygen, and pH item codes", () => {
  assert.deepEqual(
    discoverMetricMapping([
      { typeCode: "item_aa", typeName: "温度", unit: "℃" },
      { typeCode: "item_ab", typeName: "溶解氧", unit: "mg/L" },
      { typeCode: "item_ac", typeName: "PH" },
    ]),
    {
      waterTemperatureCode: "item_aa",
      dissolvedOxygenCode: "item_ab",
      phCode: "item_ac",
    }
  );
});

test("normalizes Rich-Link values and millisecond timestamps", () => {
  const observation = normalizeRichLinkHistoryRow(
    {
      ts: 1_772_988_128_612,
      item_aa: "13",
      item_ab: "5.11",
      item_ac: "7.38",
    },
    device,
    {
      waterTemperatureCode: "item_aa",
      dissolvedOxygenCode: "item_ab",
      phCode: "item_ac",
    }
  );

  assert.equal(observation.waterTemperatureC, 13);
  assert.equal(observation.dissolvedOxygenMgL, 5.11);
  assert.equal(observation.ph, 7.38);
  assert.equal(observation.observedAt.toISOString(), "2026-03-08T16:42:08.612Z");
  assert.deepEqual(observation.qualityFlags, []);
});

test("marks missing or physically invalid values without dropping the record", () => {
  const observation = normalizeRichLinkHistoryRow(
    { ts: 1_772_988_128_612, item_aa: "80", item_ac: "15" },
    device,
    {
      waterTemperatureCode: "item_aa",
      dissolvedOxygenCode: "item_ab",
      phCode: "item_ac",
    }
  );

  assert.deepEqual(observation.qualityFlags, [
    "water_temperature_out_of_range",
    "missing_dissolved_oxygen",
    "ph_out_of_range",
  ]);
});
