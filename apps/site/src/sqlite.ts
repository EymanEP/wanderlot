// SiteStore on node:sqlite: tests, local development, and self-hosting on a
// plain Node server.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { SqlStore, type Row, type Value } from "./sql-store.ts";

// The same migrations Wrangler applies to D1, in order.
const MIGRATIONS = new URL("../migrations/", import.meta.url);
const SCHEMA = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, MIGRATIONS), "utf8"))
  .join("\n");

export class SqliteStore extends SqlStore {
  constructor(path = ":memory:") {
    const db = new DatabaseSync(path);
    db.exec("pragma foreign_keys = on;");
    db.exec(SCHEMA);
    super({
      get: async (sql: string, ...args: Value[]) => db.prepare(sql).get(...args) as Row | undefined,
      all: async (sql: string, ...args: Value[]) => db.prepare(sql).all(...args) as Row[],
      run: async (sql: string, ...args: Value[]) => Number(db.prepare(sql).run(...args).changes),
    });
  }
}
