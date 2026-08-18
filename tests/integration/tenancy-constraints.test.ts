// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

describe("tenancy constraints", () => {
  it("rejects duplicate organization slugs", async () => {
    const u = await db.seedUser();
    await db.createOrg(u, "First", "dupe-slug");
    await expect(db.createOrg(u, "Second", "dupe-slug")).rejects.toThrow(
      /duplicate key|unique/i,
    );
  });

  it("rejects an invalid slug format", async () => {
    const u = await db.seedUser();
    await expect(db.createOrg(u, "Bad", "Not A Slug!")).rejects.toThrow(
      /check constraint|violates/i,
    );
  });

  it("rejects a duplicate membership (same user, same org)", async () => {
    const owner = await db.seedUser();
    const invitee = await db.seedUser();
    const org = await db.createOrg(owner, "Team", "team-dupe-member");

    await db.asUser(owner, (tx) =>
      tx.query(
        `insert into public.organization_members (organization_id, user_id, role)
         values ($1, $2, 'member')`,
        [org, invitee],
      ),
    );
    await expect(
      db.asUser(owner, (tx) =>
        tx.query(
          `insert into public.organization_members (organization_id, user_id, role)
           values ($1, $2, 'admin')`,
          [org, invitee],
        ),
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("rejects an invalid membership role value (enum)", async () => {
    const owner = await db.seedUser();
    const invitee = await db.seedUser();
    const org = await db.createOrg(owner, "Roles", "team-bad-role");
    await expect(
      db.asService((tx) =>
        tx.query(
          `insert into public.organization_members (organization_id, user_id, role)
           values ($1, $2, 'superuser')`,
          [org, invitee],
        ),
      ),
    ).rejects.toThrow(/invalid input value for enum|org_role/i);
  });

  it("enforces the marketplace account uniqueness key", async () => {
    const owner = await db.seedUser();
    const org = await db.createOrg(owner, "Store", "store-unique");
    await db.asUser(owner, (tx) =>
      tx.query(
        `insert into public.marketplace_accounts
           (organization_id, marketplace, display_name, external_account_ref)
         values ($1, 'mock', 'A', 'ref-1')`,
        [org],
      ),
    );
    await expect(
      db.asUser(owner, (tx) =>
        tx.query(
          `insert into public.marketplace_accounts
             (organization_id, marketplace, display_name, external_account_ref)
           values ($1, 'mock', 'B', 'ref-1')`,
          [org],
        ),
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("defaults a marketplace account to mock mode and pending status", async () => {
    const owner = await db.seedUser();
    const org = await db.createOrg(owner, "Defaults", "defaults-acct");
    const row = await db.asUser(owner, async (tx) =>
      (
        await tx.query<{ mode: string; status: string }>(
          `insert into public.marketplace_accounts (organization_id, marketplace, display_name)
           values ($1, 'mock', 'Default Acct')
           returning mode, status`,
          [org],
        )
      ).rows[0],
    );
    expect(row).toMatchObject({ mode: "mock", status: "pending" });
  });
});
