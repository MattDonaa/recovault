import { z } from "zod";

/**
 * Runtime schemas + types for the tenancy domain. These mirror the SQL
 * migrations (the schema source of truth) and provide the typed, validated
 * boundary the application uses when reading rows out of the database.
 *
 * Marketplace-agnostic: no brand or marketplace name appears in any table,
 * type, or field identifier here.
 */

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export const orgRoleSchema = z.enum(ORG_ROLES);
export type OrgRole = z.infer<typeof orgRoleSchema>;

export const MARKETPLACE_MODES = ["mock", "live"] as const;
export const marketplaceModeSchema = z.enum(MARKETPLACE_MODES);
export type MarketplaceMode = z.infer<typeof marketplaceModeSchema>;

export const MARKETPLACE_ACCOUNT_STATUSES = [
  "pending",
  "connected",
  "disconnected",
  "error",
] as const;
export const marketplaceAccountStatusSchema = z.enum(
  MARKETPLACE_ACCOUNT_STATUSES,
);
export type MarketplaceAccountStatus = z.infer<
  typeof marketplaceAccountStatusSchema
>;

const uuid = z.string().uuid();
const timestamp = z.string(); // ISO-8601 UTC as returned by the DB driver

export const organizationSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "invalid slug"),
  created_by: uuid,
  created_at: timestamp,
  updated_at: timestamp,
});
export type Organization = z.infer<typeof organizationSchema>;

export const organizationMemberSchema = z.object({
  id: uuid,
  organization_id: uuid,
  user_id: uuid,
  role: orgRoleSchema,
  created_at: timestamp,
  updated_at: timestamp,
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const marketplaceAccountSchema = z.object({
  id: uuid,
  organization_id: uuid,
  marketplace: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
  display_name: z.string().min(1).max(200),
  external_account_ref: z.string().nullable(),
  mode: marketplaceModeSchema,
  status: marketplaceAccountStatusSchema,
  created_at: timestamp,
  updated_at: timestamp,
});
export type MarketplaceAccount = z.infer<typeof marketplaceAccountSchema>;

export const auditEventSchema = z.object({
  id: uuid,
  organization_id: uuid,
  actor_user_id: uuid.nullable(),
  action: z.string().min(1).max(100),
  entity_type: z.string().min(1).max(100),
  entity_id: uuid.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: timestamp,
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
