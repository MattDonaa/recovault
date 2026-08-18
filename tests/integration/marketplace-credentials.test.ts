// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, getEncryptionKey } from "@/core/security/crypto";

import { createTestDb, type TestDb } from "../db/harness";

let db: TestDb;
let owner: string;
let org: string;
let accountId: string;

const KEY = getEncryptionKey({ MARKETPLACE_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64") });
const PLAINTEXT = "takealot-secret-key-abcdef";

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.seedUser("owner@example.test");
  org = await db.createOrg(owner, "Org A", "org-a");

  // Owner creates a marketplace account (RLS: owner/admin).
  accountId = await db.asUser(owner, async (tx) =>
    (
      await tx.query<{ id: string }>(
        `insert into public.marketplace_accounts (organization_id, marketplace, display_name, mode)
         values ($1, 'takealot', 'Takealot LIVE', 'live') returning id`,
        [org],
      )
    ).rows[0]!.id,
  );

  // Server (service role) stores the ENCRYPTED credential.
  await db.asService(async (tx) => {
    await tx.query(
      `insert into public.marketplace_credentials (marketplace_account_id, organization_id, encrypted_secret)
       values ($1, $2, $3)`,
      [accountId, org, encryptSecret(PLAINTEXT, KEY)],
    );
  });
});

afterAll(async () => {
  await db?.close();
});

describe("marketplace credentials (secure storage)", () => {
  it("stores ciphertext, never the plaintext, and it decrypts server-side", async () => {
    const stored = await db.asService(async (tx) =>
      (
        await tx.query<{ encrypted_secret: string }>(
          `select encrypted_secret from public.marketplace_credentials where marketplace_account_id = $1`,
          [accountId],
        )
      ).rows[0]!.encrypted_secret,
    );
    expect(stored).not.toContain(PLAINTEXT);
    expect(decryptSecret(stored, KEY)).toBe(PLAINTEXT);
  });

  it("denies end-user (authenticated) access to credentials entirely", async () => {
    await expect(
      db.asUser(owner, (tx) =>
        tx.query(`select encrypted_secret from public.marketplace_credentials`),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("prevents another tenant from reading the credential", async () => {
    const intruder = await db.seedUser("intruder@example.test");
    await expect(
      db.asUser(intruder, (tx) =>
        tx.query(
          `select encrypted_secret from public.marketplace_credentials where organization_id = $1`,
          [org],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("enforces one credential per account", async () => {
    await expect(
      db.asService((tx) =>
        tx.query(
          `insert into public.marketplace_credentials (marketplace_account_id, organization_id, encrypted_secret)
           values ($1, $2, 'v1.x.y.z')`,
          [accountId, org],
        ),
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("enables RLS on the credentials table", async () => {
    const rls = await db.raw.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where relname = 'marketplace_credentials'`,
    );
    expect(rls.rows[0]?.relrowsecurity).toBe(true);
  });
});
