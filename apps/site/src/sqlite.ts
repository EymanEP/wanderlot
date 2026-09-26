// SiteStore on node:sqlite: tests, local development, and self-hosting on a
// plain Node server.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { SqlStore, type Row, type Value } from "./sql-store.ts";

// The same migrations Wrangler applies to D1, in order, each once: like
// Wrangler, a table records which ones have run.
const MIGRATIONS = new URL("../migrations/", import.meta.url);
const FILES = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, sql: readFileSync(new URL(name, MIGRATIONS), "utf8") }));

function migrate(db: DatabaseSync) {
  db.exec("create table if not exists wl_migrations (name text primary key, applied_at text not null)");
  const done = new Set((db.prepare("select name from wl_migrations").all() as { name: string }[]).map((r) => r.name));
  for (const { name, sql } of FILES) {
    if (done.has(name)) continue;
    db.exec("begin");
    try {
      db.exec(sql);
      db.prepare("insert into wl_migrations (name, applied_at) values (?, ?)").run(name, new Date().toISOString());
      db.exec("commit");
    } catch (e) {
      db.exec("rollback");
      throw e;
    }
  }
}

export class SqliteStore extends SqlStore {
  constructor(path = ":memory:") {
    const db = new DatabaseSync(path);
    db.exec("pragma foreign_keys = on;");
    migrate(db);
    super({
      get: async (sql: string, ...args: Value[]) => db.prepare(sql).get(...args) as Row | undefined,
      all: async (sql: string, ...args: Value[]) => db.prepare(sql).all(...args) as Row[],
      run: async (sql: string, ...args: Value[]) => Number(db.prepare(sql).run(...args).changes),
    });
  }
}
