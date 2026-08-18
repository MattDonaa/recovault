# Milestone 06 — Secure Marketplace Connection

## Objective
Persist marketplace connections safely and support MOCK mode now and LIVE mode later.

## Preconditions
- Milestone 05 GREEN.

## In Scope
- Extend marketplace accounts with `MOCK | LIVE` connection mode.
- Separate credential storage from non-secret account metadata.
- Encrypt marketplace credentials before database persistence.
- Server-only encryption/decryption service.
- Environment-held encryption secret/key.
- Connection verification service.
- UI for creating/selecting mock connection.
- Live connection form may exist, but must never fake successful verification.
- Credential replacement/rotation path.
- Sanitized connection status/errors.

## Security Requirements
- Plaintext credential never stored.
- Credential never returned to client after submission.
- Credential never logged.
- Credential never included in audit payload.
- Cross-tenant credential access impossible.
- Encryption key is not stored in database.

## Required Tests
- Encrypted DB value differs from plaintext.
- Decryption is server-only.
- API/client response contains no secret.
- Logs contain no secret.
- Tenant B cannot access Tenant A connection.
- Mock account verifies without credential.
- Invalid live credential path cannot be marked verified without actual verification.

## Explicitly Out of Scope
- Historical sync.
- Money Finder.
- Recovery detection.

## Acceptance Criteria
- AC-01: Credential security tests GREEN.
- AC-02: Mock connection E2E GREEN.
- AC-03: LIVE status remains unverified without credentials.
- AC-04: Full security/quality gate GREEN.

## Completion
After GREEN:
- Last GREEN Milestone = 06.
- Current Allowed Milestone = 07.
- STOP.
