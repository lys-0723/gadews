import assert from "node:assert/strict";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
import { createPublicSurveillanceStore } from "@/lib/gadews/public-surveillance-loader";
import type { LayerStats } from "@/lib/gadews/public-surveillance";

installDom();

test("real public layer subscriptions stay idle while hidden and clear errors when disabled", async () => {
  const React = await import("react"); const { render, waitFor, cleanup } = await import("@testing-library/react");
  const { PublicSurveillanceContext } = await import("@/hooks/use-public-surveillance");
  const { WoahWahisLayer } = await import("./woah-wahis-layer"); const { QaadSurveillanceLayer } = await import("./qaad-surveillance-layer");
  for (const source of ["wahis", "qaad"] as const) {
    const calls: string[] = []; let stats: LayerStats | undefined;
    const store = createPublicSurveillanceStore(async (url) => { calls.push(String(url)); return new Response("failure", { status: 500 }); });
    const onStatsChange = (next: LayerStats) => { stats = next; };
    const view = (visible: boolean) => <PublicSurveillanceContext.Provider value={store}>{source === "wahis" ? <WoahWahisLayer visible={visible} diseaseFilter="all" onStatsChange={onStatsChange} /> : <QaadSurveillanceLayer visible={visible} diseaseFilter="all" statusFilter="all" onStatsChange={onStatsChange} />}</PublicSurveillanceContext.Provider>;
    try {
      const rendered = render(view(false));
      assert.equal(calls.length, 0); assert.equal(stats?.recordsDisplayed, 0); assert.equal(stats?.state, "idle");
      rendered.rerender(view(true));
      await waitFor(() => assert.equal(stats?.state, "error"));
      assert.equal(calls.length, 2); assert.ok(stats?.error);
      rendered.rerender(view(false));
      assert.equal(stats?.recordsDisplayed, 0); assert.deepEqual(stats?.countries, []); assert.equal(stats?.error, undefined);
      assert.equal(stats?.state, "idle");
    } finally { cleanup(); }
  }
});
