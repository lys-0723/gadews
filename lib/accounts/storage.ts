import { createClient, type Client, type Transaction } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AccountError, type Account } from "./policy";

const schema = [
  "CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL, role TEXT NOT NULL, requested TEXT NOT NULL, status TEXT NOT NULL, parent TEXT REFERENCES accounts(id), models TEXT NOT NULL DEFAULT '[]', records TEXT NOT NULL DEFAULT '[]')",
  "CREATE UNIQUE INDEX IF NOT EXISTS one_system_owner ON accounts(role) WHERE role='system'",
  "CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account)",
  "CREATE TABLE IF NOT EXISTS attempts(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)",
];
export async function initAccounts(db: Client) {
  await db.batch(schema, "write");
  return db;
}
let connection: Promise<Client> | undefined;
export function accountDb() {
  if (!connection) {
    let url = process.env.GADEWS_ACCOUNT_DB_URL;
    if (!url) {
      if (process.env.VERCEL || process.env.NODE_ENV === "production")
        throw new AccountError(503, "store_unavailable");
      const dir = resolve(".local-accounts");
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      url = "file:" + resolve(dir, "accounts.db");
    }
    if (process.env.VERCEL && !/^(libsql|https):\/\//.test(url))
      throw new AccountError(503, "store_unavailable");
    connection = initAccounts(createClient({ url, authToken: process.env.GADEWS_ACCOUNT_DB_TOKEN })).catch(
      (error) => {
        connection = undefined;
        throw error;
      },
    );
  }
  return connection;
}
export async function inWrite<T>(db: Client, fn: (tx: Transaction) => Promise<T>) {
  const tx = await db.transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } finally {
    tx.close();
  }
}
type Reader = Pick<Client, "execute">;
export async function accounts(db: Reader): Promise<Account[]> {
  const rows = await db.execute(
    "SELECT id,username,country,region,role,requested,status,parent,models,records FROM accounts ORDER BY username",
  );
  return rows.rows.map((row) => ({
    id: String(row.id),
    username: String(row.username),
    country: row.country as Account["country"],
    region: String(row.region),
    role: row.role as Account["role"],
    requested: row.requested as Account["role"],
    status: row.status as Account["status"],
    parent: row.parent as string | null,
    models: JSON.parse(String(row.models)),
    records: JSON.parse(String(row.records)),
  }));
}
