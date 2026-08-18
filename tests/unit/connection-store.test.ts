import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret } from "@/core/security/crypto";
import {
  createLiveConnection,
  createMockConnection,
  getConnection,
  getCredentialCiphertext,
  listConnections,
  markConnectionPending,
  mockAuditEvents,
  resetConnections,
  setVerification,
  storeCredential,
} from "@/lib/marketplace/mock-accounts";

const ORG = "org-1";
const SECRET = "takealot-live-api-key-SECRET";

beforeEach(() => resetConnections());

describe("connection store", () => {
  it("creates a live connection unverified with no credential", () => {
    const conn = createLiveConnection(ORG, "takealot", "Takealot (LIVE)");
    expect(conn.mode).toBe("live");
    expect(conn.status).toBe("pending");
    expect(conn.hasCredential).toBe(false);
    // The public shape never carries the secret field.
    expect(Object.keys(conn)).not.toContain("encryptedSecret");
  });

  it("stores credentials only as ciphertext, never plaintext", () => {
    const conn = createLiveConnection(ORG, "takealot", "T");
    storeCredential(ORG, conn.id, SECRET);

    const cipher = getCredentialCiphertext(ORG, conn.id);
    expect(cipher).toBeTruthy();
    expect(cipher).not.toContain(SECRET);
    expect(decryptSecret(cipher!)).toBe(SECRET); // decryptable server-side

    // Nothing returned to callers exposes the secret.
    const publicConn = getConnection(ORG, conn.id)!;
    expect(publicConn.hasCredential).toBe(true);
    expect(JSON.stringify(publicConn)).not.toContain(SECRET);
    expect(JSON.stringify(listConnections(ORG))).not.toContain(SECRET);
  });

  it("keeps the secret out of the audit trail", () => {
    const conn = createLiveConnection(ORG, "takealot", "T");
    storeCredential(ORG, conn.id, SECRET);
    expect(JSON.stringify(mockAuditEvents())).not.toContain(SECRET);
  });

  it("records verification outcomes", () => {
    const conn = createLiveConnection(ORG, "takealot", "T");
    setVerification(ORG, conn.id, { ok: true, message: null });
    expect(getConnection(ORG, conn.id)!.status).toBe("connected");
    setVerification(ORG, conn.id, { ok: false, message: "bad key" });
    expect(getConnection(ORG, conn.id)!.status).toBe("error");
    expect(getConnection(ORG, conn.id)!.lastVerificationError).toBe("bad key");
  });

  it("resets to pending on credential rotation", () => {
    const conn = createLiveConnection(ORG, "takealot", "T");
    storeCredential(ORG, conn.id, SECRET);
    setVerification(ORG, conn.id, { ok: true, message: null });
    storeCredential(ORG, conn.id, "rotated-key");
    markConnectionPending(ORG, conn.id);
    const updated = getConnection(ORG, conn.id)!;
    expect(updated.status).toBe("pending");
    expect(updated.verifiedAt).toBeNull();
    expect(decryptSecret(getCredentialCiphertext(ORG, conn.id)!)).toBe("rotated-key");
  });

  it("isolates connections by organization", () => {
    const a = createMockConnection(ORG, "healthy");
    createLiveConnection("org-2", "takealot", "Other");
    expect(listConnections(ORG).map((c) => c.id)).toEqual([a.id]);
    expect(getConnection("org-2", a.id)).toBeNull();
  });
});
