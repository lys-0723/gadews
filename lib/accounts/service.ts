import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from "node:crypto";
import type { SessionIdentity } from "./display";
import type { Client } from "@libsql/client";
import { z } from "zod";
import { readAssistantConfig } from "../gadews/assistant/config";
import { access, AccountError, areas, canManage, catalog, childRole, models, type Model } from "./policy";
import { accounts, inWrite } from "./storage";

export const nameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.-]{2,39}$/);
const passwordSchema = z.string().min(10).max(128);
export const credentials = z.object({ username: nameSchema, password: passwordSchema }).strict();
export const registration = credentials
  .extend({
    requested: z.enum(["country", "region", "member"]).default("member"),
    country: z.enum(["A", "B"]),
    region: z.enum(["east", "west", "north"]),
  })
  .refine((v) => (areas[v.country] as readonly string[]).includes(v.region));
export const assignment = z
  .object({
    id: z.string().uuid(),
    enabled: z.boolean(),
    models: z.array(z.enum(models)).max(3),
    records: z.array(z.string().max(20)).max(4),
  })
  .strict();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const lifetime = 60 * 60 * 24 * 7;
export const sessionCookie = "gadews_account";
export const sessionSeconds = lifetime;
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((ok, fail) =>
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 }, (e, v) => (e ? fail(e) : ok(v))),
  );
}
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await derive(password, salt)).toString("hex");
}
async function limit(db: Client, key: string, max: number) {
  const now = Date.now();
  await inWrite(db, async (tx) => {
    await tx.execute({ sql: "DELETE FROM attempts WHERE expires<=?", args: [now] });
    const r = await tx.execute({
      sql: "INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count",
      args: [key, now + 15 * 60_000],
    });
    if (Number(r.rows[0].count) > max) throw new AccountError(429, "rate_limited");
  });
}
export async function register(db: Client, input: unknown) {
  const v = registration.parse(input);
  await limit(db, "registration", 60);
  const hash = await hashPassword(v.password);
  const result = await db.execute({
    sql: "INSERT INTO accounts(id,username,password,country,region,role,requested,status) VALUES(?,?,?,?,?,'member',?,'pending') ON CONFLICT(username) DO NOTHING",
    args: [randomUUID(), v.username, hash, v.country, v.region, v.requested],
  });
  if (!result.rowsAffected) throw new AccountError(409, "name_taken");
}
// Operator-only creation; never promote a pre-existing self-registered account.
export async function bootstrap(db: Client, input: unknown) {
  const v = credentials.parse(input);
  const hash = await hashPassword(v.password);
  await db.execute({
    sql: "INSERT INTO accounts(id,username,password,country,region,role,requested,status) VALUES(?,?,?,'A','east','system','system','active')",
    args: [randomUUID(), v.username, hash],
  });
}
export async function login(db: Client, input: unknown) {
  const v = credentials.parse(input);
  await limit(db, "login-global", 240);
  await limit(db, "login:" + digest(v.username), 15);
  const row = (
    await db.execute({ sql: "SELECT id,password,status FROM accounts WHERE username=?", args: [v.username] })
  ).rows[0];
  const [salt, encoded] = String(row?.password ?? "missing:" + "00".repeat(64)).split(":");
  const candidate = await derive(v.password, salt);
  if (!timingSafeEqual(candidate, Buffer.from(encoded, "hex")) || !row || row.status === "disabled")
    throw new AccountError(401, "invalid_login");
  const token = randomBytes(32).toString("hex");
  await db.batch(
    [
      { sql: "DELETE FROM sessions WHERE expires<=?", args: [Date.now()] },
      {
        sql: "INSERT INTO sessions(hash,account,expires) VALUES(?,?,?)",
        args: [digest(token), row.id, Date.now() + lifetime * 1000],
      },
    ],
    "write",
  );
  return token;
}
export async function logout(db: Client, token: string) {
  await db.execute({ sql: "DELETE FROM sessions WHERE hash=?", args: [digest(token)] });
}
export async function identity(db: Pick<Client, "execute">, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AccountError(401, "login_required");
  const id = (
    await db.execute({
      sql: "SELECT account FROM sessions WHERE hash=? AND expires>?",
      args: [digest(token), Date.now()],
    })
  ).rows[0]?.account;
  if (!id) throw new AccountError(401, "login_required");
  const all = await accounts(db);
  const self = all.find((item) => item.id === id);
  if (!self || self.status === "disabled") throw new AccountError(401, "login_required");
  return { all, self, rights: access(self, all) };
}
export async function sessionIdentity(db: Client, token: string): Promise<SessionIdentity> {
  const { self, rights } = await identity(db, token);
  const { username, role, country, region, status } = self;
  return { username, role, country, region, status, active: rights.active };
}

export async function dashboard(db: Client, token: string) {
  const { all, self, rights } = await identity(db, token);
  const directory =
    self.role === "system" && rights.active
      ? all.map(({ username, role, status, country, region, requested }) => ({
          username,
          role,
          status,
          country,
          region,
          requested,
        }))
      : [];
  let engine: { model: string; configured: boolean } | null = null;
  if (rights.active && (self.role === "system" || rights.usable.length)) {
    try {
      const config = readAssistantConfig(process.env);
      engine = { model: config.model, configured: Boolean(config.apiKey) };
    } catch { engine = { model: "", configured: false }; }
  }
  return {
    engine,
    directory,
    self,
    active: rights.active,
    models: rights.usable,
    assignable: rights.assignable,
    records: rights.readable,
    children: rights.active ? all.filter((item) => canManage(self, item)) : [],
    summary:
      self.role === "country" && rights.active
        ? areas[self.country].map((region) => ({
            region,
            count: catalog.filter((r) => r.country === self.country && r.region === region).length,
          }))
        : [],
  };
}
export type Dashboard = Awaited<ReturnType<typeof dashboard>>;
export async function assign(db: Client, token: string, input: unknown) {
  const v = assignment.parse(input);
  await inWrite(db, async (tx) => {
    const { all, self, rights } = await identity(tx, token);
    const target = all.find((a) => a.id === v.id);
    if (!rights.active || !target || !canManage(self, target)) throw new AccountError(403, "out_of_scope");
    const role = childRole(self.role)!;
    if (
      v.models.some((m) => !rights.assignable.includes(m)) ||
      v.records.some(
        (id) =>
          role !== "member" ||
          !catalog.some((r) => r.id === id && r.country === target.country && r.region === target.region),
      )
    )
      throw new AccountError(403, "out_of_scope");
    await tx.execute({
      sql: "UPDATE accounts SET role=?,status=?,parent=?,models=?,records=? WHERE id=?",
      args: [
        role,
        v.enabled ? "active" : "disabled",
        self.id,
        JSON.stringify([...new Set(v.models)]),
        JSON.stringify([...new Set(v.records)]),
        target.id,
      ],
    });
    if (!v.enabled)
      await tx.execute({
        sql: "WITH RECURSIVE branch(id) AS (SELECT id FROM accounts WHERE id=? UNION ALL SELECT a.id FROM accounts a JOIN branch b ON a.parent=b.id) DELETE FROM sessions WHERE account IN (SELECT id FROM branch)",
        args: [target.id],
      });
  });
}
export async function authorize(db: Client, token: string, model: Model, recordId?: string) {
  const { rights } = await identity(db, token);
  if (!rights.active || !rights.usable.includes(model)) throw new AccountError(403, "model_denied");
  if (recordId && !rights.readable.some((r) => r.id === recordId && r.model === model))
    throw new AccountError(403, "record_denied");
}
