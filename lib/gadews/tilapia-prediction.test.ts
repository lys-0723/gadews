import assert from "node:assert/strict";
import test from "node:test";
import { predictTilapia } from "./tilapia-prediction";
import { createExampleTilapiaInput } from "./tilapia-assessment";

test("prediction remains unconfigured, with null probability/horizon and zero HTTP requests", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Prediction must remain offline"); };
  try {
    const result = await predictTilapia(createExampleTilapiaInput());
    assert.equal(result.state, "not_configured");
    assert.equal(result.probability, null);
    assert.equal(result.horizonHours, null);
    assert.ok(result.reason.length > 0);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = original;
  }
});
