import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite, type Transaction } from "@electric-sql/pglite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, "..", "..", "supabase", "migrations");
const SHIM_PATH = path.resolve(HERE, "supabase-shim.sql");

export type Row = Record<string, unknown>;

/** Ordered list of migration files that form the schema source of truth. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function applySchema(db: PGlite): Promise<void> {
  await db.exec(readFileSync(SHIM_PATH, "utf8"));
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  // service_role bypasses RLS but still needs table privileges (granted after
  // the tables exist). Mirrors Supabase, where service_role owns broad grants.
  await db.exec(`
    grant usage on schema public to service_role;
    grant all on all tables in schema public to service_role;
    grant all on all functions in schema public to service_role;
  `);
}

type CtxRole = "authenticated" | "anon" | "service_role";

async function runAs<T>(
  db: PGlite,
  role: CtxRole,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      userId ? JSON.stringify({ sub: userId }) : "",
    ]);
    return fn(tx);
  });
}

export interface TestDb {
  raw: PGlite;
  /** Run a callback as an authenticated end user (RLS enforced). */
  asUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Run a callback as an unauthenticated visitor (RLS enforced). */
  asAnon<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Run a callback as the trusted service role (RLS bypassed). */
  asService<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  /** Seed an auth user (superuser context). Returns the new user id. */
  seedUser(email?: string): Promise<string>;
  /** Create an organization owned by userId (via RLS, as that user). */
  createOrg(userId: string, name: string, slug: string): Promise<string>;
  close(): Promise<void>;
}

/** Build an isolated, migrated test database with tenancy helpers. */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await applySchema(db);

  const api: TestDb = {
    raw: db,
    asUser: (userId, fn) => runAs(db, "authenticated", userId, fn),
    asAnon: (fn) => runAs(db, "anon", null, fn),
    asService: (fn) => runAs(db, "service_role", null, fn),
    async seedUser(email) {
      const res = await db.query<{ id: string }>(
        `insert into auth.users (email) values ($1) returning id`,
        [email ?? `user_${crypto.randomUUID()}@example.test`],
      );
      return res.rows[0]!.id;
    },
    async createOrg(userId, name, slug) {
      return runAs(db, "authenticated", userId, async (tx) => {
        const res = await tx.query<{ id: string }>(
          `insert into public.organizations (name, slug) values ($1, $2) returning id`,
          [name, slug],
        );
        return res.rows[0]!.id;
      });
    },
    async close() {
      await db.close();
    },
  };

  return api;
}
