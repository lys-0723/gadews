import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { initAccounts } from "./storage";
import { AccountError } from "./policy";
import { approve, assign, reviewApplication, systemGrant, authorize, bootstrap, dashboard, login, logout, register, sessionIdentity } from "./service";
import { previewScore, sampleRequest } from "./samples";
import { catalog } from "./policy";
import { evaluatePassword } from "./password-strength";
import { credentials as loginCredentials, registration } from "./service";

test("registered accounts, scoped delegation, independent grants and session revocation persist", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "gadews-account-test-"));
  const url = "file:" + join(dir, "test.db");
  const db = await initAccounts(createClient({ url }));
  t.after(async () => {
    db.close();
    await rm(dir, { recursive: true, force: true });
  });
  const password = "Q_" + randomBytes(16).toString("hex");
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
  assert.deepEqual(await sessionIdentity(db, nation.token), {
    username: "nation", role: "member", country: "A", region: "east", status: "pending", active: false,
  });
  await grant(owner, nation.id, true, false);
  assert.equal((await sessionIdentity(db, nation.token)).role, "country");
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
  await assert.rejects(sessionIdentity(db, nation.token), denied("login_required"));
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

test("registration strength rules preserve existing sign-in and accept seven-character passwords", () => {
  const signup = (password: string) => registration.safeParse({
    username: "reader", password, requested: "member", country: "A", region: "east",
  }).success;
  for (const value of ["Q_1234", "hello_7", "HELLO77", "HELLO 7", "Abcde🌊", "A_".padEnd(129, "x")]) {
    assert.equal(signup(value), false);
    assert.equal(evaluatePassword(value).strength, "weak");
  }
  for (const value of ["Q_12345", "ABCDEFG!", "Abcde🌊1", "A甲乙丙丁戊！"]) {
    assert.equal(signup(value), true);
    assert.equal(evaluatePassword(value).strength, "medium");
  }
  const strong = "A_1".padEnd(12, "x");
  assert.equal(evaluatePassword(strong).strength, "strong");
  assert.equal(signup("A_".padEnd(128, "x")), true);
  assert.equal(signup("legacy-password"), false);
  assert.equal(loginCredentials.safeParse({ username: "reader", password: "legacy-password" }).success, true);
});

test("system can approve all roles, delegate ownership or directly override account privileges", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "gadews-approval-test-"));
  const db = await initAccounts(createClient({ url: "file:" + join(dir, "test.db") }));
  t.after(async () => {
    db.close();
    await rm(dir, { recursive: true, force: true });
  });
  const password = "Q_" + randomBytes(16).toString("hex");
  await bootstrap(db, { username: "owner", password });
  const owner = await login(db, { username: "owner", password });
  async function signup(username: string, requested: string, country = "A", region = "east") {
    await register(db, { username, password, requested, country, region });
    const token = await login(db, { username, password });
    const { self } = await dashboard(db, token);
    return { token, id: self.id };
  }
  const rejected = (code: string) => (err: unknown) => err instanceof AccountError && err.code === code;
  const country = await signup("country", "country");
  const foreign = await signup("foreign", "country", "B", "north");
  const east = await signup("eastern", "region");
  const east2 = await signup("another", "region");
  const member = await signup("member", "member");
  const abroad = await signup("abroad", "member", "B", "north");
  const initial = await dashboard(db, owner);
  assert.equal(initial.approvals.length, 6);
  assert.equal(initial.approvalParents.length, 0);
  await approve(db, owner, { id: abroad.id });
  assert.equal((await dashboard(db, abroad.token)).self.parent, initial.self.id);
  assert.equal((await dashboard(db, abroad.token)).active, true);
  assert.equal(initial.systemAccounts.length, 6);
  assert.equal((await dashboard(db, abroad.token)).systemAccounts.length, 0);
  await assert.rejects(approve(db, country.token, { id: east.id }), rejected("out_of_scope"));

  await approve(db, owner, { id: country.id });
  await approve(db, owner, { id: foreign.id });
  const countryView = await dashboard(db, country.token);
  assert.deepEqual(countryView.approvals.map((a) => a.id).sort(), [east.id, east2.id].sort());
  assert.equal(countryView.approvalParents.length, 0);
  await assert.rejects(approve(db, foreign.token, { id: east.id }), rejected("out_of_scope"));
  await assert.rejects(approve(db, owner, { id: east.id, parentId: foreign.id }), rejected("out_of_scope"));
  await approve(db, owner, { id: east.id });
  assert.equal((await dashboard(db, east.token)).self.parent, country.id);
  await approve(db, country.token, { id: east2.id });
  assert.deepEqual((await dashboard(db, east.token)).approvals.map((a) => a.id), [member.id]);

  await assert.rejects(approve(db, owner, { id: member.id }), rejected("approval_parent_required"));
  await assert.rejects(approve(db, east.token, { id: member.id, parentId: east2.id }), rejected("out_of_scope"));
  await assert.rejects(approve(db, east.token, { id: abroad.id }), rejected("out_of_scope"));
  await approve(db, owner, { id: member.id, parentId: east2.id });
  const view = await dashboard(db, member.token);
  assert.equal(view.active, true);
  assert.equal(view.self.role, "member");
  assert.equal(view.self.parent, east2.id);
  assert.deepEqual(view.models, []);
  assert.deepEqual(view.records, []);
  assert.deepEqual(view.approvals, []);
  assert.deepEqual((await dashboard(db, owner)).records, []);
  await assert.rejects(approve(db, owner, { id: member.id, parentId: east.id }), rejected("approval_processed"));
  assert.equal((await dashboard(db, member.token)).self.parent, east2.id);
  const second = await signup("second", "member");
  await approve(db, east.token, { id: second.id });
  assert.equal((await dashboard(db, second.token)).self.parent, east.id);

  await assign(db, owner, { id: country.id, enabled: false, models: [], records: [] });
  const parents = (await dashboard(db, owner)).approvalParents;
  assert.deepEqual(parents.map((a) => a.id), [foreign.id]);
  const remaining = await signup("remaining", "member");
  await assert.rejects(approve(db, owner, { id: remaining.id, parentId: east.id }), rejected("out_of_scope"));
  assert.equal((await dashboard(db, remaining.token)).self.status, "pending");
  const override = {
    id: remaining.id, role: "member", country: "A", region: "east", enabled: true,
    models: ["wsd-v1.0"], records: ["E-01"],
  };
  await assert.rejects(systemGrant(db, foreign.token, override), rejected("out_of_scope"));
  await assert.rejects(systemGrant(db, owner, { ...override, id: initial.self.id }), rejected("out_of_scope"));
  await assert.rejects(systemGrant(db, owner, { ...override, records: ["N-01"] }), rejected("out_of_scope"));
  await systemGrant(db, owner, override);
  await authorize(db, remaining.token, "wsd-v1.0", "E-01");
  await assign(db, owner, { id: remaining.id, enabled: true, models: [], records: [] });
  assert.equal((await dashboard(db, remaining.token)).self.role, "member");
  await assert.rejects(authorize(db, remaining.token, "wsd-v1.0"), rejected("model_denied"));
  await systemGrant(db, owner, { ...override, enabled: false });
  await assert.rejects(dashboard(db, remaining.token), rejected("login_required"));
  await systemGrant(db, owner, { ...override, enabled: true });
  const restored = await login(db, { username: "remaining", password });
  await authorize(db, restored, "wsd-v1.0", "E-01");

  // Re-enable the former country hierarchy. A move must invalidate incompatible descendants.
  await assign(db, owner, { id: country.id, enabled: true, models: [], records: [] });
  const oldSession = await login(db, { username: "second", password });
  assert.equal((await dashboard(db, oldSession)).active, true);
  await systemGrant(db, owner, { ...override, id: country.id, role: "region", records: [], region: "west" });
  await assert.rejects(dashboard(db, oldSession), rejected("login_required"));
  assert.equal((await dashboard(db, owner)).systemAccounts.find((a) => a.id === east.id)?.status, "disabled");
  const movedSession = await login(db, { username: "country", password });
  const moved = await dashboard(db, movedSession);
  assert.equal(moved.active, true);
  assert.equal(moved.self.region, "west");
  assert.equal(moved.self.role, "region");
  await assert.rejects(assign(db, movedSession, { id: east.id, enabled: true, models: [], records: [] }),
    rejected("out_of_scope"));
});

test("only the system reviewer can reject and reopen pending registrations without granting access", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "gadews-review-test-"));
  const db = await initAccounts(createClient({ url: "file:" + join(dir, "review.db") }));
  t.after(async () => { db.close(); await rm(dir, { recursive: true, force: true }); });
  const password = "Q_" + randomBytes(16).toString("hex");
  const denied = (code: string) => (err: unknown) => err instanceof AccountError && err.code === code;
  await bootstrap(db, { username: "owner", password });
  const owner = await login(db, { username: "owner", password });
  await register(db, { username: "manager", password, requested: "country", country: "A", region: "east" });
  const manager = await login(db, { username: "manager", password });
  await approve(db, owner, { id: (await sessionAccount(manager)).id });

  async function sessionAccount(token: string) { return (await dashboard(db, token)).self; }
  await register(db, { username: "applicant", password, requested: "region", country: "A", region: "west" });
  const session = await login(db, { username: "applicant", password });
  const { id } = await sessionAccount(session);
  const staleGrant = { id, role: "region", country: "A", region: "west", enabled: true, models: [], records: [] };
  await assert.rejects(reviewApplication(db, manager, "reject", { id }), denied("out_of_scope"));
  await assert.rejects(reviewApplication(db, session, "reject", { id }), denied("out_of_scope"));
  await assert.rejects(reviewApplication(db, owner, "reopen", { id }), denied("approval_processed"));
  await reviewApplication(db, owner, "reject", { id });
  const review = await dashboard(db, owner);
  assert.equal(review.directory.find((a) => a.id === id)?.status, "rejected");
  assert.ok(!review.approvals.some((a) => a.id === id));
  assert.ok(!review.systemAccounts.some((a) => a.id === id));
  const applicant = await dashboard(db, session);
  assert.equal(applicant.self.status, "rejected");
  assert.equal(applicant.self.requested, "region");
  assert.equal(applicant.active, false);
  assert.deepEqual(applicant.models, []);
  assert.deepEqual(applicant.records, []);
  assert.equal((await sessionIdentity(db, await login(db, { username: "applicant", password }))).status, "rejected");
  await assert.rejects(authorize(db, session, "wsd-v1.0"), denied("model_denied"));
  await assert.rejects(reviewApplication(db, owner, "reject", { id }), denied("approval_processed"));
  await assert.rejects(approve(db, owner, { id }), denied("approval_processed"));
  await assert.rejects(systemGrant(db, owner, staleGrant), denied("approval_processed"));
  await assert.rejects(assign(db, manager, { id, enabled: true, models: [], records: [] }), denied("out_of_scope"));
  await assert.rejects(reviewApplication(db, manager, "reopen", { id }), denied("out_of_scope"));
  await reviewApplication(db, owner, "reopen", { id });
  assert.equal((await sessionIdentity(db, session)).active, false);
  assert.equal((await sessionAccount(session)).status, "pending");
  assert.ok((await dashboard(db, manager)).approvals.some((a) => a.id === id));
  await approve(db, manager, { id });
  await assert.rejects(reviewApplication(db, owner, "reject", { id }), denied("approval_processed"));
  assert.equal((await sessionAccount(session)).status, "active");

  await register(db, { username: "racecheck", password, requested: "member", country: "A", region: "east" });
  const race = (await dashboard(db, owner)).approvals.find((a) => a.username === "racecheck")!;
  const decisions = await Promise.allSettled([
    approve(db, owner, { id: race.id }),
    reviewApplication(db, owner, "reject", { id: race.id }),
  ]);
  assert.equal(decisions.filter((decision) => decision.status === "fulfilled").length, 1);
  const outcome = (await dashboard(db, owner)).directory.find((a) => a.id === race.id);
  assert.equal(outcome?.status, decisions[0].status === "fulfilled" ? "active" : "rejected");
});
