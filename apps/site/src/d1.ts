// SiteStore on Cloudflare D1. Wrangler applies migrations/ to the database.
import { SqlStore, type Row, type Value } from "./sql-store.ts";

// The slice of D1's API the store uses, so this file needs no Workers types.
export interface D1Like {
  prepare(sql: string): D1StatementLike;
}
interface D1StatementLike {
  bind(...values: Value[]): D1StatementLike;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export class D1Store extends SqlStore {
  constructor(db: D1Like) {
    super({
      get: async (sql, ...args) => (await db.prepare(sql).bind(...args).first<Row>()) ?? undefined,
      all: async (sql, ...args) => (await db.prepare(sql).bind(...args).all<Row>()).results,
      run: async (sql, ...args) => (await db.prepare(sql).bind(...args).run()).meta.changes,
    });
  }
}
