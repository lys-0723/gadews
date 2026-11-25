import { invalidBodies, invalidLimits, invalidQueries } from "./test-support/request-cases";
import assert from "node:assert/strict";
import test from "node:test";
import { parseCollectBody, parseObservationQuery } from "./request-validation";
import { RequestValidationError, CollectionRangeError } from "./errors";
import { resolveCollectionDateRange, validateDate } from "./dates";

test("collection accepts empty objects and compatible optional omissions", () => {
  for (const body of ["", "{}", '{"deviceKey":null,"startDate":"","endDate":null}']) assert.deepEqual(parseCollectBody(body), {});
  assert.deepEqual(parseCollectBody('{"deviceKey":"pond-a","startDate":"2026-10-28"}'), { deviceKey: "pond-a", startDate: "2026-10-28" });
});

for (const body of invalidBodies) test(`collection rejects ${body}`, () => { assert.throws(() => parseCollectBody(body), RequestValidationError); });

test("query defaults and integer boundaries remain exact", () => {
  for (const text of ["", "limit="]) assert.equal(parseObservationQuery(new URLSearchParams(text)).limit, 500);
  for (const n of [1, 1000]) assert.equal(parseObservationQuery(new URLSearchParams({ limit: String(n) })).limit, n);
});

for (const limit of invalidLimits) test(`query rejects limit ${JSON.stringify(limit)}`, () => {
  assert.throws(() => parseObservationQuery(new URLSearchParams({ limit })), RequestValidationError);
});

for (const query of invalidQueries) test(`query rejects ${query}`, () => {
  assert.throws(() => parseObservationQuery(new URLSearchParams(query)), RequestValidationError);
});

test("dates accept leap days, zoned timestamps, equal and single-ended ranges", () => {
  assert.equal(validateDate("2024-02-29", "date"), "2024-02-29");
  assert.throws(() => validateDate("2026-02-29", "date"), RequestValidationError);
  const r = parseObservationQuery(new URLSearchParams({ from: "2026-10-28T08:00:00+08:00", to: "2026-10-28T00:00:00Z" }));
  assert.equal(r.from?.toISOString(), r.to?.toISOString());
  assert.equal(parseObservationQuery(new URLSearchParams("from=2026-10-28")).to, undefined);
  assert.equal(parseObservationQuery(new URLSearchParams("to=2026-10-28")).from, undefined);
  assert.deepEqual(parseCollectBody('{"endDate":"2026-10-28"}'), { endDate: "2026-10-28" });
  assert.deepEqual(parseCollectBody('{"startDate":"2026-10-28","endDate":"2026-10-28"}'), { startDate: "2026-10-28", endDate: "2026-10-28" });
});

test("default collection dates use farm time and reject resolved reversed ranges", () => {
  const context = { latestObservation: new Date("2026-10-27T16:00:00Z"), now: new Date("2026-10-28T18:00:00Z"), timeZone: "Asia/Shanghai", initialLookbackDays: 1 };
  assert.deepEqual(resolveCollectionDateRange(context), { startDate: "2026-10-28", endDate: "2026-10-29" });
  assert.throws(() => resolveCollectionDateRange({ ...context, startDate: "2026-10-30" }), CollectionRangeError);
  assert.throws(() => resolveCollectionDateRange({ ...context, endDate: "2026-10-27" }), CollectionRangeError);
});
