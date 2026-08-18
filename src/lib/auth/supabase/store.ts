import { slugify } from "@/core/auth/validation";
import {
  AuthError,
  type MembershipStore,
  type OrganizationSummary,
} from "@/core/auth/types";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Live membership store backed by the Supabase database (M02 schema). Uses the
 * service-role client and scopes every query explicitly by userId; the
 * application-layer authorization (`resolveOrgAccess`) is the enforcement point,
 * with database RLS as defense in depth for any direct access.
 *
 * NOTE: verified in the live milestone; offline gates use the in-memory store.
 */
export class SupabaseMembershipStore implements MembershipStore {
  async createOrganization(
    userId: string,
    input: { name: string; slug: string },
  ): Promise<OrganizationSummary> {
    const supabase = createServiceRoleClient();
    const slug = input.slug || slugify(input.name);
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: input.name, slug, created_by: userId })
      .select("id, name, slug")
      .single();
    if (error || !data) {
      if (/duplicate|unique/i.test(error?.message ?? "")) {
        throw new AuthError("slug_taken", "That organization name is taken");
      }
      throw new AuthError("provider_error", error?.message ?? "Create failed");
    }
    // The DB trigger seeds the creator as owner.
    return { id: data.id, name: data.name, slug: data.slug, role: "owner" };
  }

  async listOrganizationsForUser(
    userId: string,
  ): Promise<OrganizationSummary[]> {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("role, organizations ( id, name, slug )")
      .eq("user_id", userId);
    if (error || !data) return [];
    return data.flatMap((row) => {
      const org = row.organizations as unknown as {
        id: string;
        name: string;
        slug: string;
      } | null;
      if (!org) return [];
      return [{ id: org.id, name: org.name, slug: org.slug, role: row.role }];
    });
  }

  async getMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationSummary | null> {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("role, organizations ( id, name, slug )")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error || !data) return null;
    const org = data.organizations as unknown as {
      id: string;
      name: string;
      slug: string;
    } | null;
    if (!org) return null;
    return { id: org.id, name: org.name, slug: org.slug, role: data.role };
  }
}
