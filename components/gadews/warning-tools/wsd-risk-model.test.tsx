import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { MonitoringSnapshot } from "@/lib/aquaculture/monitoring-types";
import { installDom } from "@/lib/gadews/test-support/dom";

installDom();
test("WSD starts blank, evaluates insufficient data, labels examples and invalidates edited results", async () => {
  const React = await import("react");
  const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { WsdRiskModel } = await import("./wsd-risk-model");
  const config = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8"));
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(config);
  try {
    render(<WsdRiskModel />); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "");
    assert.equal(screen.queryByRole("region", { name: "Assessment result" }), null);
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" }));
    assert.ok(screen.getByText("Insufficient data"));
    assert.equal(screen.queryByText("Low risk"), null);
    await user.click(screen.getByRole("button", { name: "Load WSD example" }));
    assert.equal((screen.getByLabelText("Red body") as HTMLSelectElement).value, "yes");
    assert.equal((screen.getByLabelText("Soft / easily peeled shell") as HTMLSelectElement).value, "no");
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" }));
    assert.ok(screen.getAllByText("Example data").length > 0);
    assert.ok(screen.getByText("Partial assessment"));
    assert.ok(screen.getAllByText(/rule_conflict/).length > 0);
    await user.clear(screen.getByLabelText("Pond pH"));
    assert.ok(screen.getByText(/This result is outdated/));
    await user.click(screen.getByRole("button", { name: "Reset WSD" }));
    assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "");
    assert.equal(screen.queryByRole("region", { name: "Assessment result" }), null);
  } finally { globalThis.fetch = original; cleanup(); }
});

test("monitoring preview never fills inputs; explicit application invalidates results and exports actual field evidence", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { WsdRiskModel } = await import("./wsd-risk-model");
  const config = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8")); const original = globalThis.fetch;
  const timestamp = new Date(Date.now() - 60_000).toISOString();
  const monitoring = (id: string): MonitoringSnapshot => ({ schemaVersion: "1.0" as const, feed: { id, label: `Synthetic ${id}`, siteId: "site-a", pondId: "pond-a", maxAgeHours: 2, unitVerificationRef: "Synthetic verified" }, fetchedAt: new Date().toISOString(), observation: { observedAt: timestamp, ingestedAt: timestamp, reference: `monitoring:${id}:${timestamp}`, metrics: { waterTemperatureC: { value: 29, unit: "°C" as const, state: "usable" as const, issues: [] as string[] }, dissolvedOxygenMgL: { value: 5, unit: "mg/L" as const, state: "usable" as const, issues: [] as string[] }, ph: { value: 8.2, unit: "pH" as const, state: "usable" as const, issues: [] as string[] } } } });
  const a = monitoring("synthetic-a"); a.observation!.metrics.ph = { value: null, unit: "pH", state: "missing", issues: ["missing_value"] };
  const b = monitoring("synthetic-b"); b.observation!.metrics.waterTemperatureC = { value: null, unit: "°C", state: "missing", issues: ["missing_value"] };
  globalThis.fetch = async () => Response.json(config);
  let downloaded: Blob | undefined; const createUrl = URL.createObjectURL; const revokeUrl = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloaded = blob as Blob; return "blob:test"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    const view = render(<WsdRiskModel monitoringSnapshot={a} />); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    assert.equal((screen.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, "");
    const apply = () => screen.getByRole("button", { name: "Apply monitoring to empty WSD fields" }) as HTMLButtonElement;
    assert.equal(apply().disabled, true);
    await user.type(screen.getByLabelText("Region / site"), "site-a"); await user.type(screen.getByLabelText("Farm / pond ID"), "pond-a");
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" }));
    await user.click(apply());
    assert.equal((screen.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, "29"); assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "");
    assert.ok(screen.getByText(/This result is outdated/)); assert.equal((screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled, true);
    view.rerender(<WsdRiskModel monitoringSnapshot={b} />); await user.click(apply());
    assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "8.2");
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" })); await user.click(screen.getByRole("button", { name: "Download JSON" }));
    const report = JSON.parse(await downloaded!.text()).result;
    assert.equal(report.contextSnapshot.inputProvenance.monitoring.waterTemperatureC.snapshot.feed.id, "synthetic-a"); assert.equal(report.contextSnapshot.inputProvenance.monitoring.ph.snapshot.feed.id, "synthetic-b");
    assert.equal(report.contextSnapshot.observations.ph.scope, "pond"); assert.equal(report.dataMode, "manual");
    await user.clear(screen.getByLabelText("Pond pH")); await user.type(screen.getByLabelText("Pond pH"), "7.2");
    assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "7.2");
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" })); await user.click(screen.getByRole("button", { name: "Download JSON" }));
    const edited = JSON.parse(await downloaded!.text()).result;
    assert.equal(edited.inputSnapshot.ph, "7.2"); assert.equal(edited.contextSnapshot.inputProvenance.monitoring.ph, undefined);
    assert.equal(edited.contextSnapshot.inputProvenance.monitoring.waterTemperatureC.snapshot.feed.id, "synthetic-a");
    assert.equal(edited.contextSnapshot.observations.ph, undefined);
    await user.clear(screen.getByLabelText("Farm / pond ID"));
    assert.equal((screen.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, ""); assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "7.2");
    assert.equal(screen.queryByText("Monitoring evidence attached"), null);
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" })); await user.click(screen.getByRole("button", { name: "Download JSON" }));
    const manual = JSON.parse(await downloaded!.text()).result; assert.equal(manual.contextSnapshot.inputProvenance?.monitoring, undefined); assert.equal(manual.contextSnapshot.observations?.waterTemperatureC, undefined);
    await user.click(screen.getByRole("button", { name: "Reset WSD" }));
    await user.type(screen.getByLabelText("Region / site"), "site-a"); await user.type(screen.getByLabelText("Farm / pond ID"), "pond-a"); await user.click(apply());
    assert.ok(screen.getByText("Monitoring evidence attached"));
    await user.click(screen.getByRole("button", { name: "Reset WSD" }));
    assert.equal(screen.queryByText("Monitoring evidence attached"), null); assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "");
    await user.type(screen.getByLabelText("Region / site"), "site-a"); await user.type(screen.getByLabelText("Farm / pond ID"), "pond-a"); await user.click(apply());
    assert.ok(screen.getByText("Monitoring evidence attached"));
    await user.click(screen.getByRole("button", { name: "Load WSD example" })); assert.equal(screen.queryByText("Monitoring evidence attached"), null); assert.equal(apply().disabled, true); assert.ok(screen.getByText(/Reset WSD before applying monitoring/));
    await user.click(screen.getByRole("button", { name: "Reset WSD" })); assert.equal(screen.queryByText("Monitoring evidence attached"), null); assert.equal((screen.getByLabelText("Pond pH") as HTMLInputElement).value, "");
  } finally { globalThis.fetch = original; URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
});

test("typed decimal zeroes and sign reach the real WSD assessment without numeric rewriting", async (t) => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { WsdRiskModel } = await import("./wsd-risk-model");
  const config = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8"));
  const cases = [
    { label: "Pond pH", field: "ph", text: "7.02", number: 7.02, rule: "ENV-002" },
    { label: "Pond pH", field: "ph", text: "0.05", number: 0.05, rule: "ENV-002" },
    { label: "Pond water temperature (°C)", field: "waterTemperatureC", text: "-0.05", number: -0.05, rule: "ENV-001" },
    { label: "Pond pH", field: "ph", text: "10.04", number: 10.04, rule: "ENV-002" },
  ];
  for (const example of cases) await t.test(example.text, async () => {
    const originalFetch = globalThis.fetch; const createUrl = URL.createObjectURL; const revokeUrl = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
    let downloaded: Blob | undefined;
    globalThis.fetch = async () => Response.json(config);
    URL.createObjectURL = (blob) => { downloaded = blob as Blob; return "blob:decimal-input"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
    try {
      render(<WsdRiskModel />); const user = userEvent.setup();
      await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
      await user.type(screen.getByLabelText(example.label), example.text);
      assert.equal((screen.getByLabelText(example.label) as HTMLInputElement).value, example.text);
      await user.click(screen.getByRole("button", { name: "Evaluate WSD" })); await user.click(screen.getByRole("button", { name: "Download JSON" }));
      const report = JSON.parse(await downloaded!.text()).result;
      assert.equal(report.inputSnapshot[example.field], example.text);
      assert.equal(Number(report.inputSnapshot[example.field]), example.number);
      assert.ok(report.quality.observedFields.includes(example.field));
      assert.equal(report.quality.issues.some((issue: { field: string; code: string }) => issue.field === example.field && issue.code === "invalid"), false);
      assert.equal(report.drivers.find((driver: { ruleId: string }) => driver.ruleId === example.rule)?.score, 30);
      assert.equal(report.knownScore, 30);
    } finally { globalThis.fetch = originalFetch; URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
  });
});

test("WSD reevaluation excludes monitoring that expires after application and retains its original provenance", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { WsdRiskModel } = await import("./wsd-risk-model");
  const config = JSON.parse(await readFile("public/data/models/wsd-warning-model.json", "utf8"));
  const realDate = globalThis.Date; let currentTime = realDate.parse("2026-10-29T12:00:00.000Z");
  class AssessmentClock extends realDate {
    constructor(value?: string | number | Date) { super(value === undefined ? currentTime : value instanceof realDate ? value.getTime() : value); }
    static now() { return currentTime; }
  }
  const observationTime = "2026-10-29T11:00:00.000Z";
  const monitoring: MonitoringSnapshot = { schemaVersion: "1.0", feed: { id: "synthetic-expiring", label: "Synthetic expiring observation", siteId: "site-a", pondId: "pond-a", maxAgeHours: 2, unitVerificationRef: "Synthetic verified units" }, fetchedAt: "2026-10-29T12:00:00.000Z", observation: { observedAt: observationTime, ingestedAt: observationTime, reference: `monitoring:synthetic-expiring:${observationTime}`, metrics: { waterTemperatureC: { value: 29, unit: "°C", state: "usable", issues: [] }, dissolvedOxygenMgL: { value: null, unit: "mg/L", state: "missing", issues: ["missing_value"] }, ph: { value: null, unit: "pH", state: "missing", issues: ["missing_value"] } } } };
  const originalFetch = globalThis.fetch; const createUrl = URL.createObjectURL; const revokeUrl = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
  let downloaded: Blob | undefined;
  globalThis.Date = AssessmentClock as DateConstructor; globalThis.fetch = async () => Response.json(config);
  URL.createObjectURL = (blob) => { downloaded = blob as Blob; return "blob:expiring-monitoring"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    render(<WsdRiskModel monitoringSnapshot={monitoring} />); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    await user.type(screen.getByLabelText("Region / site"), "site-a"); await user.type(screen.getByLabelText("Farm / pond ID"), "pond-a");
    await user.click(screen.getByRole("button", { name: "Apply monitoring to empty WSD fields" }));
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" })); await user.click(screen.getByRole("button", { name: "Download JSON" }));
    const fresh = JSON.parse(await downloaded!.text()).result;
    assert.ok(fresh.quality.observedFields.includes("waterTemperatureC")); assert.equal(fresh.knownScore, 15);
    currentTime = realDate.parse("2026-10-29T13:00:00.001Z");
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" })); await user.click(screen.getByRole("button", { name: "Download JSON" }));
    const expired = JSON.parse(await downloaded!.text()).result;
    assert.equal(expired.assessedAt, "2026-10-29T13:00:00.001Z");
    assert.ok(expired.quality.issues.some((issue: { field: string; code: string }) => issue.field === "waterTemperatureC" && issue.code === "stale"));
    assert.equal(expired.quality.observedFields.includes("waterTemperatureC"), false); assert.equal(expired.knownScore, 0);
    assert.equal(expired.drivers.some((driver: { ruleId: string }) => driver.ruleId === "ENV-001"), false);
    assert.equal(expired.inputSnapshot.waterTemperatureC, 29);
    assert.deepEqual(expired.contextSnapshot.observations.waterTemperatureC, { observedAt: observationTime, maxAgeHours: 2, scope: "pond" });
    assert.equal(expired.contextSnapshot.inputProvenance.monitoring.waterTemperatureC.appliedAt, "2026-10-29T12:00:00.000Z");
    assert.equal(expired.contextSnapshot.inputProvenance.monitoring.waterTemperatureC.snapshot.observation.reference, `monitoring:synthetic-expiring:${observationTime}`);
  } finally { globalThis.Date = realDate; globalThis.fetch = originalFetch; URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
});
