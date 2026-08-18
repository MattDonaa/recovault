/**
 * Compile-time shape of the public schema for the Supabase client generic.
 * Hand-authored to match the SQL migrations; keep in sync with
 * `supabase/migrations/*` and `src/core/tenancy/schema.ts`.
 */
import type {
  MarketplaceAccountStatus,
  MarketplaceMode,
  OrgRole,
} from "@/core/tenancy/schema";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrgRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: OrgRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["organization_members"]["Insert"]
        >;
      };
      marketplace_accounts: {
        Row: {
          id: string;
          organization_id: string;
          marketplace: string;
          display_name: string;
          external_account_ref: string | null;
          mode: MarketplaceMode;
          status: MarketplaceAccountStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          marketplace: string;
          display_name: string;
          external_account_ref?: string | null;
          mode?: MarketplaceMode;
          status?: MarketplaceAccountStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["marketplace_accounts"]["Insert"]
        >;
      };
      audit_events: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["audit_events"]["Insert"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: {
        Args: { org: string };
        Returns: boolean;
      };
      has_org_role: {
        Args: { org: string; roles: OrgRole[] };
        Returns: boolean;
      };
    };
    Enums: {
      org_role: OrgRole;
      marketplace_mode: MarketplaceMode;
      marketplace_account_status: MarketplaceAccountStatus;
    };
  };
}
