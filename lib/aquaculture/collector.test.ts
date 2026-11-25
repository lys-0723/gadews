import assert from "node:assert/strict";
import test from "node:test";
import { formatDateInTimeZone, validateDate } from "./collector";

test("formats collection dates in the configured farm time zone", () => {
  assert.equal(
    formatDateInTimeZone(new Date("2026-08-27T16:01:00Z"), "Asia/Shanghai"),
    "2026-08-28"
  );
});

test("validates calendar dates", () => {
  assert.equal(validateDate("2026-08-28", "startDate"), "2026-08-28");
  assert.throws(() => validateDate("2026-02-30", "startDate"), /valid calendar/);
});
