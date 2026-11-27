import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";

installDom();
const knowledgePath = "public/data/knowledge/tilapia-streptococcosis.json";
async function resources() {
  const [knowledge, wsd] = await Promise.all([readFile(knowledgePath, "utf8"), readFile("public/data/models/wsd-warning-model.json", "utf8")]);
  return { knowledge: JSON.parse(knowledge), wsd: JSON.parse(wsd) };
}
test("switching keeps WSD and tilapia drafts, results and resets independent", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup, within } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { WarningWorkbench } = await import("./warning-workbench");
  const data = await resources(); const original = globalThis.fetch;
  globalThis.fetch = async (url) => Response.json(String(url).includes("tilapia") ? data.knowledge : data.wsd);
  try {
    render(<WarningWorkbench />); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    await user.click(screen.getByRole("button", { name: "Load WSD example" }));
    await user.click(screen.getByRole("button", { name: "Evaluate WSD" }));
    await user.click(screen.getByRole("button", { name: "Tilapia streptococcosis" }));
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate tilapia" }) as HTMLButtonElement).disabled, false));
    const tilapia = within(screen.getByRole("region", { name: "Tilapia assessment" }));
    assert.equal((tilapia.getByLabelText("Site ID") as HTMLInputElement).value, "");
    await user.type(tilapia.getByLabelText("Site ID"), "manual-site");
    await user.click(tilapia.getByRole("button", { name: "Evaluate tilapia" }));
    assert.ok(tilapia.getByText("Draft rules disabled"));
    assert.ok(tilapia.getByText(/Rules not evaluated/));
    assert.ok(tilapia.getAllByText(/Input check:/).length > 0);
    assert.equal(tilapia.queryByText(/0 \/ 0 core fields observed/), null);
    assert.equal(document.querySelectorAll('[data-rule-id]').length, 22);
    await user.click(screen.getByRole("button", { name: "WSD / white spot disease" }));
    assert.equal((screen.getByLabelText("Red body") as HTMLSelectElement).value, "yes");
    assert.ok(screen.getByRole("region", { name: "Assessment result" }));
    await user.click(screen.getByRole("button", { name: "Reset WSD" }));
    await user.click(screen.getByRole("button", { name: "Tilapia streptococcosis" }));
    assert.equal((tilapia.getByLabelText("Site ID") as HTMLInputElement).value, "manual-site");
    assert.ok(tilapia.getByText("Draft rules disabled"));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("editing an explicit draft example invalidates its result, retains simulation and removes fixture confirmation", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { TilapiaRiskModel } = await import("./tilapia-risk-model");
  const data = await resources(); const original = globalThis.fetch; globalThis.fetch = async () => Response.json(data.knowledge);
  try {
    render(<TilapiaRiskModel />); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate tilapia" }) as HTMLButtonElement).disabled, false));
    await user.click(screen.getByRole("button", { name: "Load tilapia draft example" }));
    await user.click(screen.getByRole("button", { name: "Evaluate tilapia" }));
    assert.ok(screen.getAllByText("Draft simulation").length > 0);
    assert.ok(document.querySelector('[data-event-type="confirmed_event"]'));
    await user.type(screen.getByLabelText("Water temperature (°C)"), "12abc");
    assert.ok(screen.getByText(/This result is outdated/));
    assert.equal((screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled, true);
    assert.ok(screen.getByText("Example derived"));
    await user.click(screen.getByRole("button", { name: "Evaluate tilapia" }));
    assert.equal(document.querySelector('[data-event-type="confirmed_event"]'), null);
    assert.ok(screen.getByText(/2026-10-28T12:00:00.000Z/));
    assert.ok(screen.getByText(/waterTemperature.value · invalid/));
    await user.click(screen.getByRole("button", { name: "Reset tilapia" }));
    assert.equal((screen.getByLabelText("Site ID") as HTMLInputElement).value, "");
    assert.equal(screen.queryByText("Draft simulation"), null);
    assert.equal(screen.queryByRole("region", { name: "Assessment result" }), null);
    await user.click(screen.getByRole("button", { name: "Evaluate tilapia" }));
    assert.ok(screen.getByText("Draft rules disabled"));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("knowledge load failure exposes Retry and a fresh successful request unlocks evaluation", async () => {
  const React = await import("react"); const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { TilapiaRiskModel } = await import("./tilapia-risk-model");
  const data = await resources(); const original = globalThis.fetch; let succeed = false;
  globalThis.fetch = async () => succeed ? Response.json(data.knowledge) : new Response("Unavailable", { status: 503 });
  try {
    render(<TilapiaRiskModel />); const user = userEvent.setup();
    await waitFor(() => assert.ok(screen.getByRole("alert")));
    assert.equal((screen.getByRole("button", { name: "Evaluate tilapia" }) as HTMLButtonElement).disabled, true);
    succeed = true; await user.click(screen.getByRole("button", { name: "Retry knowledge" }));
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate tilapia" }) as HTMLButtonElement).disabled, false));
    assert.ok(screen.getByRole("region", { name: "Tilapia knowledge" }));
    assert.ok(screen.getByText(/22 draft rules/));
    await user.click(screen.getByRole("button", { name: "Evaluate tilapia" }));
    assert.ok(screen.getByText("Draft rules disabled"));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("knowledge keeps complete original rows and allows only http or https source links", async () => {
  const React = await import("react"); const { render, screen, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { TilapiaKnowledgePanel } = await import("./tilapia-knowledge-panel");
  const data = await resources();
  data.knowledge.tables = [{ name: "Sources", headers: { A: "Reference", B: "Unsafe" }, rows: [{ row: 71, cells: { A: "Original source text", B: "Preserved unsafe URL text", C: 0 }, hyperlinks: { A: "https://example.org/paper", B: "javascript:alert(1)" } }] }];
  try {
    render(<TilapiaKnowledgePanel knowledge={data.knowledge} />); const user = userEvent.setup();
    assert.ok(!screen.queryByText("Original source text"));
    await user.click(screen.getByText("Original workbook rows, evidence and sources"));
    await user.click(screen.getByText("Sources (1 rows)"));
    assert.ok(screen.getByText("Original source text"));
    assert.equal((screen.getByRole("link", { name: /Original source text/ }) as HTMLAnchorElement).href, "https://example.org/paper");
    assert.equal(document.querySelector('a[href^="javascript:"]'), null);
    assert.ok(screen.getByText("Preserved unsafe URL text"));
    assert.ok(screen.getByText("0"));
  } finally { cleanup(); }
});

test("workbench requires explicit monitoring load and matching manual identity, then clears preview across diseases", async () => {
  const React = await import("react"); const { render, screen, within, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { WarningWorkbench } = await import("./warning-workbench"); const data = await resources(); const original = globalThis.fetch;
  const feed = { id: "synthetic-a", label: "Synthetic test feed", siteId: "synthetic-site", pondId: "synthetic-pond", maxAgeHours: 2, unitVerificationRef: "Synthetic test units" };
  const time = new Date(Date.now() - 60_000).toISOString(); let monitoringRequests = 0;
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.includes("/api/monitoring/")) {
      monitoringRequests += 1;
      return Response.json(path.endsWith("/feeds") ? { schemaVersion: "1.0", feeds: [feed] } : { schemaVersion: "1.0", feed, fetchedAt: new Date().toISOString(), observation: { observedAt: time, ingestedAt: time, reference: `monitoring:synthetic-a:${time}`, metrics: { waterTemperatureC: { value: 29, unit: "°C", state: "usable", issues: [] }, dissolvedOxygenMgL: { value: 5, unit: "mg/L", state: "usable", issues: [] }, ph: { value: 8.2, unit: "pH", state: "usable", issues: [] } } } });
    }
    return Response.json(path.includes("tilapia") ? data.knowledge : data.wsd);
  };
  try {
    render(<WarningWorkbench />); const user = userEvent.setup();
    await waitFor(() => assert.equal((screen.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    assert.equal(monitoringRequests, 0);
    await user.click(screen.getByRole("button", { name: "Load monitoring feeds" })); await user.selectOptions(await screen.findByLabelText("Monitoring feed"), "synthetic-a");
    await screen.findByText("29 °C");
    assert.equal((screen.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, "");
    assert.equal(screen.queryByRole("region", { name: "Assessment result" }), null);
    assert.equal((screen.getByRole("button", { name: "Apply monitoring to empty WSD fields" }) as HTMLButtonElement).disabled, true);
    await user.type(screen.getByLabelText("Region / site"), "synthetic-site"); await user.type(screen.getByLabelText("Farm / pond ID"), "synthetic-pond");
    await user.click(screen.getByRole("button", { name: "Apply monitoring to empty WSD fields" }));
    assert.equal((screen.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, "29");
    assert.equal(screen.queryByRole("region", { name: "Assessment result" }), null);
    await user.click(screen.getByRole("button", { name: "Tilapia streptococcosis" }));
    await waitFor(() => assert.equal((screen.getByLabelText("Monitoring feed") as HTMLSelectElement).value, ""));
    assert.equal(screen.queryByText("29 °C"), null); assert.equal(screen.queryByRole("button", { name: /Apply monitoring/ }), null);
    assert.ok(within(screen.getByRole("region", { name: "Monitoring observations" })).getByText(/Read-only for tilapia/));
    await user.click(screen.getByRole("button", { name: "WSD / white spot disease" }));
    assert.equal((screen.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, "29");
    assert.equal(screen.queryByRole("button", { name: /Apply monitoring/ }), null); assert.ok(screen.getByText("Monitoring evidence attached"));
  } finally { globalThis.fetch = original; cleanup(); }
});

test("explicit monitoring demo keeps complete manual and demo sessions separate and exports actual demo evidence", async () => {
  const React = await import("react"); const { render, screen, within, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { WarningWorkbench } = await import("./warning-workbench"); const data = await resources(); const original = globalThis.fetch; const monitoringCalls: string[] = [];
  globalThis.fetch = async (url) => { const path = String(url); if (path.includes("/api/monitoring/")) { monitoringCalls.push(path); return new Response("Unavailable", { status: 503 }); } return Response.json(path.includes("tilapia") ? data.knowledge : data.wsd); };
  const downloads: Blob[] = []; const createUrl = URL.createObjectURL; const revokeUrl = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloads.push(blob as Blob); return "blob:demo-test"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    render(<WarningWorkbench />); const user = userEvent.setup(); const manual = within(screen.getByRole("region", { name: "WSD workspace" }));
    await waitFor(() => assert.equal((manual.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    await user.click(manual.getByRole("button", { name: "Load WSD example" })); await user.click(manual.getByRole("button", { name: "Evaluate WSD" }));
    await user.clear(manual.getByLabelText("Region / site")); await user.type(manual.getByLabelText("Region / site"), "kept-manual-site");
    assert.ok(manual.getByText(/This result is outdated/));
    await user.click(screen.getByRole("button", { name: "Run monitoring demo" }));
    const demoElement = screen.getByRole("region", { name: "WSD demo workspace" }); const demo = within(demoElement);
    await screen.findByText("29 °C"); await waitFor(() => assert.equal((demo.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    assert.equal((screen.getByLabelText("Monitoring feed") as HTMLSelectElement).options.length, 5); assert.equal((demo.getByLabelText("Pond pH") as HTMLInputElement).value, "");
    assert.equal(demo.queryByRole("region", { name: "Assessment result" }), null); assert.equal(demo.queryByRole("button", { name: "Load WSD example" }), null);
    assert.ok(demo.getByText("Demo · synthetic observations"));
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id); assert.equal(new Set(ids).size, ids.length);
    const demoPh = demo.getByLabelText("Pond pH"); assert.equal(demoPh.id, "wsd-demo-ph"); await user.click(demoElement.querySelector('label[for="wsd-demo-ph"]')!); assert.equal(document.activeElement, demoPh);
    await user.click(demo.getByRole("button", { name: "Load demo observation into WSD" }));
    assert.equal((demo.getByLabelText("Region / site") as HTMLInputElement).value, "demo-site"); assert.equal((demo.getByLabelText("Farm / pond ID") as HTMLInputElement).value, "demo-pond");
    assert.equal((demo.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, "29"); assert.equal((demoPh as HTMLInputElement).value, "8.2"); assert.equal((demo.getByLabelText("Red body") as HTMLSelectElement).value, "");
    await user.click(demo.getByRole("button", { name: "Evaluate WSD" })); await user.click(demo.getByRole("button", { name: "Download JSON" }));
    const initialText = await downloads.at(-1)!.text(); const initial = JSON.parse(initialText).result;
    assert.equal(initial.dataMode, "example"); assert.equal(initial.contextSnapshot.inputProvenance.demoSession.kind, "demo"); assert.equal(initial.contextSnapshot.inputProvenance.demoSession.scenarioId, "demo-usable");
    assert.equal(initial.contextSnapshot.inputProvenance.monitoring.ph.origin.kind, "demo"); assert.equal(initial.contextSnapshot.inputProvenance.monitoring.ph.origin.scenarioId, "demo-usable");
    assert.equal(initial.contextSnapshot.inputProvenance.monitoring.ph.origin.generatedAt, initial.contextSnapshot.inputProvenance.monitoring.ph.snapshot.fetchedAt);
    await user.click(screen.getByRole("button", { name: "Refresh observation" })); await screen.findByText("29 °C");
    assert.equal(demo.queryByText(/This result is outdated/), null); assert.equal(await downloads[0].text(), initialText);
    await user.clear(demoPh); await user.type(demoPh, "7.2"); assert.ok(demo.getByText(/This result is outdated/));
    await user.click(screen.getByRole("button", { name: "Published observations" }));
    assert.equal((manual.getByLabelText("Region / site") as HTMLInputElement).value, "kept-manual-site"); assert.equal((manual.getByLabelText("Red body") as HTMLSelectElement).value, "yes");
    assert.ok(manual.getByText(/This result is outdated/)); assert.equal((manual.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement).disabled, true);
    await user.click(screen.getByRole("button", { name: "Run monitoring demo" })); await screen.findByText("29 °C");
    assert.equal((demo.getByLabelText("Pond pH") as HTMLInputElement).value, "7.2"); assert.ok(demo.getByText(/This result is outdated/));
    await user.click(demo.getByRole("button", { name: "Evaluate WSD" })); await user.click(demo.getByRole("button", { name: "Download JSON" }));
    const edited = JSON.parse(await downloads.at(-1)!.text()).result; assert.equal(edited.dataMode, "example"); assert.equal(edited.contextSnapshot.inputProvenance.monitoring.ph, undefined); assert.equal(edited.contextSnapshot.inputProvenance.demoSession.scenarioId, "demo-usable");
    await user.click(screen.getByRole("button", { name: "Tilapia streptococcosis" })); await waitFor(() => assert.equal((screen.getByLabelText("Monitoring feed") as HTMLSelectElement).value, ""));
    await user.click(screen.getByRole("button", { name: "WSD / white spot disease" })); assert.equal((demo.getByLabelText("Pond pH") as HTMLInputElement).value, "7.2"); assert.ok(demo.getByRole("region", { name: "Assessment result" }));
    await user.click(demo.getByRole("button", { name: "Reset WSD" })); assert.equal((demo.getByLabelText("Region / site") as HTMLInputElement).value, ""); assert.equal(demo.queryByRole("region", { name: "Assessment result" }), null); assert.ok(demo.getByText("Demo · synthetic observations"));
    await user.click(demo.getByRole("button", { name: "Evaluate WSD" })); await user.click(demo.getByRole("button", { name: "Download JSON" }));
    const reset = JSON.parse(await downloads.at(-1)!.text()).result; assert.equal(reset.dataMode, "example"); assert.deepEqual(reset.contextSnapshot.inputProvenance.demoSession, { kind: "demo" }); assert.equal(reset.contextSnapshot.inputProvenance.monitoring, undefined);
    await user.click(screen.getByRole("button", { name: "Published observations" })); assert.equal((manual.getByLabelText("Region / site") as HTMLInputElement).value, "kept-manual-site"); assert.ok(manual.getByText(/This result is outdated/));
    assert.deepEqual(monitoringCalls, []);
    await user.click(screen.getByRole("button", { name: "Load monitoring feeds" })); assert.ok(await screen.findByText(/not configured/)); assert.ok(screen.getByRole("button", { name: "Retry monitoring" })); assert.equal(screen.queryByText("29 °C"), null); assert.equal(monitoringCalls.length, 1);
  } finally { globalThis.fetch = original; URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
});

test("four demo scenarios keep missing and rejected values blank and tilapia remains read-only", async () => {
  const React = await import("react"); const { render, screen, within, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { WarningWorkbench } = await import("./warning-workbench"); const data = await resources(); const original = globalThis.fetch;
  globalThis.fetch = async (url) => { assert.equal(String(url).includes("/api/monitoring/"), false); return Response.json(String(url).includes("tilapia") ? data.knowledge : data.wsd); };
  let downloaded: Blob | undefined; const createUrl = URL.createObjectURL; const revokeUrl = URL.revokeObjectURL; const click = window.HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (blob) => { downloaded = blob as Blob; return "blob:scenario"; }; URL.revokeObjectURL = () => {}; window.HTMLAnchorElement.prototype.click = () => {};
  try {
    render(<WarningWorkbench />); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Run monitoring demo" })); await screen.findByText("29 °C");
    const demo = within(screen.getByRole("region", { name: "WSD demo workspace" })); await waitFor(() => assert.equal((demo.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    for (const [id, temperature, ph, reason] of [["demo-usable", "29", "8.2", null], ["demo-partial", "29", "", "missing_value"], ["demo-stale", "", "", "expired"], ["demo-unverified", "", "", "not been verified"]] as const) {
      await user.selectOptions(screen.getByLabelText("Monitoring feed"), id); await waitFor(() => assert.equal((screen.getByRole("button", { name: "Refresh observation" }) as HTMLButtonElement).disabled, false));
      await user.click(screen.getByRole("button", { name: "Refresh observation" })); await waitFor(() => assert.equal((screen.getByRole("button", { name: "Refresh observation" }) as HTMLButtonElement).disabled, false));
      await user.click(demo.getByRole("button", { name: "Load demo observation into WSD" }));
      assert.equal((demo.getByLabelText("Pond water temperature (°C)") as HTMLInputElement).value, temperature); assert.equal((demo.getByLabelText("Pond pH") as HTMLInputElement).value, ph);
      if (reason) assert.ok(screen.getAllByText(new RegExp(reason)).length > 0);
      await user.click(demo.getByRole("button", { name: "Evaluate WSD" })); await user.click(demo.getByRole("button", { name: "Download JSON" }));
      const report = JSON.parse(await downloaded!.text()).result; assert.equal(report.dataMode, "example"); assert.equal(report.contextSnapshot.inputProvenance.demoSession.scenarioId, id); assert.ok(report.contextSnapshot.inputProvenance.demoSession.loadedAt); assert.equal(report.contextSnapshot.inputProvenance.demoSession.snapshot.feed.id, id);
      if (!temperature) { assert.equal(report.contextSnapshot.inputProvenance.monitoring, undefined); assert.equal(report.knownScore, 0); }
      if (!ph) assert.equal(report.contextSnapshot.inputProvenance.monitoring?.ph, undefined);
    }
    await user.click(screen.getByRole("button", { name: "Tilapia streptococcosis" })); await user.click(screen.getByRole("button", { name: "Run monitoring demo" })); await screen.findByText("29 °C");
    assert.ok(screen.getByText(/Read-only for tilapia/)); assert.equal(screen.queryByRole("button", { name: "Load demo observation into WSD" }), null);
    const tilapia = within(screen.getByRole("region", { name: "Tilapia workspace" })); assert.equal((tilapia.getByLabelText("Batch ID") as HTMLInputElement).value, ""); assert.equal(tilapia.queryByRole("region", { name: "Assessment result" }), null);
  } finally { globalThis.fetch = original; URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; window.HTMLAnchorElement.prototype.click = click; cleanup(); }
});

test("manual evaluation errors and demo configuration errors survive source switching independently", async () => {
  const React = await import("react"); const { render, screen, within, waitFor, cleanup } = await import("@testing-library/react"); const { default: userEvent } = await import("@testing-library/user-event");
  const { WarningWorkbench } = await import("./warning-workbench"); const data = await resources(); const original = globalThis.fetch; let configRequests = 0;
  globalThis.fetch = async () => { configRequests += 1; return configRequests === 1 ? Response.json({ modules: { environment: { rules: "invalid source rules" } } }) : configRequests === 2 ? new Response("Unavailable", { status: 503 }) : Response.json(data.wsd); };
  try {
    render(<WarningWorkbench />); const user = userEvent.setup(); const manual = within(screen.getByRole("region", { name: "WSD workspace" })); await waitFor(() => assert.equal((manual.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    await user.type(manual.getByLabelText("Region / site"), "error-draft"); await user.type(manual.getByLabelText("Pond pH"), "8.2"); await user.click(manual.getByRole("button", { name: "Evaluate WSD" })); assert.ok(manual.getByText(/could not be evaluated/));
    await user.click(screen.getByRole("button", { name: "Run monitoring demo" })); const demo = within(screen.getByRole("region", { name: "WSD demo workspace" })); assert.ok(await demo.findByText(/configuration could not be loaded/));
    await user.click(screen.getByRole("button", { name: "Published observations" })); assert.ok(manual.getByText(/could not be evaluated/)); assert.equal((manual.getByLabelText("Region / site") as HTMLInputElement).value, "error-draft");
    await user.click(screen.getByRole("button", { name: "Run monitoring demo" })); assert.ok(demo.getByText(/configuration could not be loaded/)); await user.click(demo.getByRole("button", { name: "Retry configuration" })); await waitFor(() => assert.equal((demo.getByRole("button", { name: "Evaluate WSD" }) as HTMLButtonElement).disabled, false));
    await user.click(demo.getByRole("button", { name: "Evaluate WSD" })); assert.ok(demo.getByRole("region", { name: "Assessment result" })); assert.equal(demo.queryByText(/could not be evaluated/), null);
    await user.click(screen.getByRole("button", { name: "Published observations" })); assert.ok(manual.getByText(/could not be evaluated/)); assert.equal(manual.queryByRole("region", { name: "Assessment result" }), null);
  } finally { globalThis.fetch = original; cleanup(); }
});

test("farm deep link opens the producer guidance and initializes the requested disease", async () => {
  const React = await import("react");
  const { render, screen, cleanup, waitFor } = await import("@testing-library/react");
  const { WarningWorkbench } = await import("./warning-workbench");
  const data = await resources();
  const previous = globalThis.fetch;
  globalThis.fetch = async url => Response.json(String(url).includes("tilapia") ? data.knowledge : data.wsd);
  try {
    render(<WarningWorkbench initialDisease="tilapia" initialRole="producer" />);
    assert.equal(screen.getByRole("button", {name: "Farm / Local Producer"}).getAttribute("aria-pressed"), "true");
    assert.equal(screen.getByRole("button", {name: "Tilapia streptococcosis"}).getAttribute("aria-pressed"), "true");
    await waitFor(() => assert.ok(screen.getByRole("button", {name: "Evaluate tilapia"})));
  } finally {
    cleanup();
    globalThis.fetch = previous;
  }
});
