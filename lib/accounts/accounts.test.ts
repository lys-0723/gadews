import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { initAccounts } from "./storage";
import { AccountError } from "./policy";
import { assign, authorize, bootstrap, dashboard, login, logout, register } from "./service";
import { previewScore, sampleRequest } from "./samples";
import { catalog } from "./policy";

test("registered accounts, scoped delegation, independent grants and session revocation persist", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "gadews-account-test-"));
  const url = "file:" + join(dir, "test.db");
  const db = await initAccounts(createClient({ url }));
  t.after(async () => {
    db.close();
    await rm(dir, { recursive: true, force: true });
  });
  const password = randomBytes(16).toString("hex");
  const credentials = (username: string) => ({ username, password });
  await bootstrap(db, credentials("owner"));
  await assert.rejects(bootstrap(db, credentials("next-owner")));
  const owner = await login(db, credentials("owner"));
  const enroll = async (username: string, country = "A", region = "east", requested = "member") => {
    await register(db, { ...credentials(username), country, region, requested });
    const token = await login(db, credentials(username));
    const view = await dashboard(db, token);
    assert.equal(view.active, false);
    return { id: view.self.id, token };
  };
  const nation = await enroll("nation", "A", "east", "country"),
    east = await enroll("eastern", "A", "east", "region"),
    member = await enroll("member");
  const west = await enroll("western", "A", "west"),
    abroad = await enroll("foreign", "B", "north");
  const grant = async (token: string, id: string, model: boolean, record: boolean, enabled = true) =>
    assign(db, token, { id, models: model ? ["wsd-v1.0"] : [], records: record ? ["E-01"] : [], enabled });
  const denied = (code: string) => (error: unknown) => error instanceof AccountError && error.code === code;
  await assert.rejects(
    register(db, { ...credentials("MEMBER"), country: "A", region: "east" }),
    denied("name_taken"),
  );
  await assert.rejects(login(db, { username: "member", password: password + "x" }), denied("invalid_login"));
  await assert.rejects(
    register(db, { ...credentials("stranger"), country: "A", region: "east", role: "system" }),
  );
  await grant(owner, nation.id, true, false);
  await grant(nation.token, east.id, true, false);
  await assert.rejects(grant(nation.token, abroad.id, true, false), denied("out_of_scope"));
  await assert.rejects(grant(east.token, west.id, true, false), denied("out_of_scope"));
  await assert.rejects(grant(east.token, east.id, true, false), denied("out_of_scope"));
  await assert.rejects(
    assign(db, east.token, { id: member.id, enabled: true, models: ["knowledge-chat-v1"], records: [] }),
    denied("out_of_scope"),
  );
  await assert.rejects(
    assign(db, east.token, { id: member.id, enabled: true, models: [], records: ["W-01"] }),
    denied("out_of_scope"),
  );
  for (const model of [false, true])
    for (const record of [false, true]) {
      await grant(east.token, member.id, model, record);
      const view = await dashboard(db, member.token);
      assert.equal(view.models.includes("wsd-v1.0"), model);
      assert.equal(
        view.records.some((r) => r.id === "E-01"),
        record,
      );
      const run = authorize(db, member.token, "wsd-v1.0", "E-01");
      if (model && record) await run;
      else await assert.rejects(run, denied(model ? "record_denied" : "model_denied"));
    }
  const countryView = await dashboard(db, nation.token);
  assert.equal(countryView.records.length, 0);
  assert.ok(countryView.summary.length);
  assert.equal((await dashboard(db, owner)).records.length, 0);
  await grant(owner, nation.id, false, false);
  await assert.rejects(authorize(db, member.token, "wsd-v1.0", "E-01"), denied("model_denied"));
  assert.equal((await dashboard(db, member.token)).records.length, 1);
  const reopened = await initAccounts(createClient({ url }));
  try {
    assert.equal((await dashboard(reopened, member.token)).self.username, "member");
  } finally {
    reopened.close();
  }
  await grant(owner, nation.id, false, false, false);
  await assert.rejects(dashboard(db, member.token), denied("login_required"));
  await assert.rejects(dashboard(db, nation.token), denied("login_required"));
  await logout(db, member.token);
  await assert.rejects(dashboard(db, member.token), denied("login_required"));
});

test("all four scoped fixtures can run a versioned offline preview without credentials", () => {
  for (const record of catalog) {
    const result = previewScore(sampleRequest(record, "zh-CN"));
    assert.equal(result.standard, record.model);
    assert.ok(Number.isFinite(result.subtotal));
    assert.ok(result.total > 0);
  }
});
