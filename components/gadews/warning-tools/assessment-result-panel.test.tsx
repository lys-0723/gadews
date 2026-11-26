import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { installDom } from "@/lib/gadews/test-support/dom";
import { assessWsd, type WsdWarningModelConfig } from "@/lib/gadews/wsd-warning-model";
import { assessTilapia, createTilapiaDraftExamplePacket } from "@/lib/gadews/tilapia-assessment";
import { serializeAssessmentReport } from "@/lib/gadews/assessment-report";
import type { KnowledgeResource } from "@/lib/gadews/tilapia-types";

installDom();
const config = JSON.parse(readFileSync("public/data/models/wsd-warning-model.json", "utf8")) as WsdWarningModelConfig;
const knowledge = JSON.parse(readFileSync("public/data/knowledge/tilapia-streptococcosis.json", "utf8")) as KnowledgeResource;

test("Download JSON saves the current assessed Blob and releases its local URL", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { AssessmentResultPanel } = await import("./assessment-result-panel");
  const result = assessWsd({ ph: Infinity }, config, { now: "2026-10-28T12:00:00Z", dataMode: "example" });
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = window.HTMLAnchorElement.prototype.click;
  const blobs: Blob[] = [];
  const downloads: { href: string; name: string; connected: boolean }[] = [];
  const released: string[] = [];
  URL.createObjectURL = (blob) => { blobs.push(blob as Blob); return "blob:assessment-current"; };
  URL.revokeObjectURL = (url) => { released.push(url); };
  window.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.href, name: this.download, connected: this.isConnected }); };
  try {
    render(<AssessmentResultPanel result={result} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Download JSON" }));
    assert.equal(blobs.length, 1);
    assert.equal(blobs[0].type, "application/json");
    const report = JSON.parse(await blobs[0].text());
    assert.equal(await blobs[0].text(), serializeAssessmentReport(result, false));
    assert.equal(report.result.inputSnapshot.ph.$number, "Infinity");
    assert.equal(report.result.dataMode, "example");
    assert.equal(report.result.contextSnapshot.now, "2026-10-28T12:00:00.000Z");
    assert.deepEqual(downloads, [{ href: "blob:assessment-current", name: "gadews-wsd-2026-10-28T12-00-00-000Z.json", connected: true }]);
    assert.deepEqual(released, ["blob:assessment-current"]);
    assert.equal(document.querySelector("a[download]"), null);
  } finally {
    cleanup(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; window.HTMLAnchorElement.prototype.click = originalClick;
  }
});

test("outdated result visibly requires reevaluation and cannot create a download", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { AssessmentResultPanel } = await import("./assessment-result-panel");
  const result = assessWsd({}, config);
  const originalCreate = URL.createObjectURL;
  let created = 0;
  URL.createObjectURL = () => { created++; return "blob:unexpected"; };
  try {
    render(<AssessmentResultPanel result={result} outdated />);
    const button = screen.getByRole("button", { name: "Download JSON" }) as HTMLButtonElement;
    assert.equal(button.disabled, true);
    assert.ok(screen.getByText(/result is outdated; evaluate again/i));
    await userEvent.setup().click(button);
    assert.equal(created, 0);
  } finally { cleanup(); URL.createObjectURL = originalCreate; }
});

test("disabled tilapia rules show input checks separately without claiming zero rule coverage", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { AssessmentResultPanel } = await import("./assessment-result-panel");
  const packet = createTilapiaDraftExamplePacket();
  const result = assessTilapia(packet.input, knowledge);
  result.quality.issues.push({ field: "scope", code: "missing", message: "Enter a site, unit and batch." });
  try {
    render(<AssessmentResultPanel result={result} />);
    assert.ok(screen.getByText(/rules not evaluated/i));
    assert.equal(screen.queryByText(/0 \/ 0 core fields observed/), null);
    assert.ok(screen.getByText("Input checks (1)"));
    assert.ok(screen.getByText("Enter a site, unit and batch."));
    assert.equal(screen.queryByText(/No supported positive driver/) === null, true);
    assert.ok(screen.getAllByText(/Draft rules were not evaluated/).length >= 1);
  } finally { cleanup(); }
});

test("tilapia emergency and confirmation events are not described as absent positive evidence", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { AssessmentResultPanel } = await import("./assessment-result-panel");
  const packet = createTilapiaDraftExamplePacket();
  const result = assessTilapia(packet.input, knowledge, packet.context);
  assert.ok(result.events.some((event) => event.type === "water_quality_emergency"));
  assert.ok(result.events.some((event) => event.type === "confirmed_event"));
  assert.equal(result.minimumAttention, "urgent");
  try {
    render(<AssessmentResultPanel result={result} />);
    assert.equal(screen.queryByText(/No supported positive driver/) === null, true);
    assert.ok(screen.getByText("Review the independent events and rule traces below."));
    assert.ok(screen.getByText("Urgent attention"));
  } finally { cleanup(); }
});

test("a partial assessment keeps a red urgent signal and reports unchanged evidence and grade uncertainty", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { AssessmentResultPanel } = await import("./assessment-result-panel");
  const result = assessWsd({ pcrQpcrResult: "positive", whiteSpots: true }, config);
  const before = JSON.stringify(result);
  assert.equal(result.level, null);
  assert.equal(result.minimumAttention, "urgent");
  try {
    render(<AssessmentResultPanel result={result} />);
    assert.ok(screen.getByText("Urgent attention"));
    assert.equal(document.querySelector("[data-alert-tone]")?.getAttribute("data-alert-tone"), "urgent");
    assert.ok(screen.getByText("Partial assessment"));
    assert.ok(screen.getByText("Awaiting complete assessment"));
    assert.equal(document.querySelector("[data-known-score]")?.textContent, String(result.knownScore));
    assert.equal(JSON.stringify(result), before);
  } finally { cleanup(); }
});

test("an empty result displays neutral uncertainty and source information stays accessible", async () => {
  const React = await import("react");
  const { render, screen, cleanup } = await import("@testing-library/react");
  const { AssessmentResultPanel } = await import("./assessment-result-panel");
  try {
    render(<AssessmentResultPanel result={assessWsd({}, config)} />);
    assert.equal(document.querySelector("[data-alert-tone]")?.getAttribute("data-alert-tone"), "neutral");
    assert.ok(screen.getByText("Evidence is insufficient to determine low risk; complete or review the records."));
    assert.ok(screen.getByText("Model and source"));
  } finally { cleanup(); }
});
