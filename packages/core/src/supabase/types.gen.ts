export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_membership_id: string | null;
          created_at: string;
          diff: Json | null;
          id: string;
          ip: unknown;
          target_id: string | null;
          target_type: string;
          tenant_id: string;
        };
        Insert: {
          action: string;
          actor_membership_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          id?: string;
          ip?: unknown;
          target_id?: string | null;
          target_type: string;
          tenant_id: string;
        };
        Update: {
          action?: string;
          actor_membership_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          id?: string;
          ip?: unknown;
          target_id?: string | null;
          target_type?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      consents: {
        Row: {
          created_at: string;
          granted: boolean;
          granted_at: string;
          id: string;
          ip: unknown;
          policy_version: string;
          purpose: Database['public']['Enums']['consent_purpose'];
          tenant_id: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          granted: boolean;
          granted_at?: string;
          id?: string;
          ip?: unknown;
          policy_version: string;
          purpose: Database['public']['Enums']['consent_purpose'];
          tenant_id?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          granted_at?: string;
          id?: string;
          ip?: unknown;
          policy_version?: string;
          purpose?: Database['public']['Enums']['consent_purpose'];
          tenant_id?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'consents_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      devices: {
        Row: {
          app_version: string | null;
          created_at: string;
          id: string;
          last_seen_at: string;
          platform: string;
          push_token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform: string;
          push_token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform?: string;
          push_token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'devices_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string | null;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: Database['public']['Enums']['membership_role'];
          status: Database['public']['Enums']['invitation_status'];
          tenant_id: string;
          token: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at: string;
          id?: string;
          invited_by?: string | null;
          role?: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['invitation_status'];
          tenant_id: string;
          token: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['invitation_status'];
          tenant_id?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_inviter_same_tenant';
            columns: ['invited_by', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'invitations_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          direction: Database['public']['Enums']['ledger_direction'];
          id: string;
          occurred_at: string;
          ref_id: string | null;
          ref_type: string | null;
          stripe_object_id: string | null;
          tenant_id: string;
          type: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          direction: Database['public']['Enums']['ledger_direction'];
          id?: string;
          occurred_at?: string;
          ref_id?: string | null;
          ref_type?: string | null;
          stripe_object_id?: string | null;
          tenant_id: string;
          type: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          direction?: Database['public']['Enums']['ledger_direction'];
          id?: string;
          occurred_at?: string;
          ref_id?: string | null;
          ref_type?: string | null;
          stripe_object_id?: string | null;
          tenant_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_entries_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      locations: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          postal_code: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          postal_code?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          postal_code?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'locations_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          joined_at: string;
          left_at: string | null;
          role: Database['public']['Enums']['membership_role'];
          status: Database['public']['Enums']['membership_status'];
          tenant_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          joined_at?: string;
          left_at?: string | null;
          role?: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['membership_status'];
          tenant_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          joined_at?: string;
          left_at?: string | null;
          role?: Database['public']['Enums']['membership_role'];
          status?: Database['public']['Enums']['membership_status'];
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'memberships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      processed_webhook_events: {
        Row: {
          event_id: string;
          processed_at: string;
          source: string;
        };
        Insert: {
          event_id: string;
          processed_at?: string;
          source?: string;
        };
        Update: {
          event_id?: string;
          processed_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          capacity: number;
          created_at: string;
          deleted_at: string | null;
          id: string;
          location_id: string;
          name: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          capacity: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          location_id: string;
          name: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          location_id?: string;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rooms_location_same_tenant';
            columns: ['location_id', 'tenant_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id', 'tenant_id'];
          },
          {
            foreignKeyName: 'rooms_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_settings: {
        Row: {
          cancel_window_minutes: number;
          close_minutes_before: number;
          created_at: string;
          default_visitor_capacity: number;
          max_upcoming_bookings: number;
          open_days_before: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          cancel_window_minutes?: number;
          close_minutes_before?: number;
          created_at?: string;
          default_visitor_capacity?: number;
          max_upcoming_bookings?: number;
          open_days_before?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          cancel_window_minutes?: number;
          close_minutes_before?: number;
          created_at?: string;
          default_visitor_capacity?: number;
          max_upcoming_bookings?: number;
          open_days_before?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_settings_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenants: {
        Row: {
          country: string;
          created_at: string;
          currency: string;
          deleted_at: string | null;
          id: string;
          name: string;
          slug: string;
          status: Database['public']['Enums']['tenant_status'];
          timezone: string;
          updated_at: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          slug: string;
          status?: Database['public']['Enums']['tenant_status'];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          status?: Database['public']['Enums']['tenant_status'];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      themes: {
        Row: {
          app_name: string;
          created_at: string;
          font: string;
          logo_url: string | null;
          primary_color: string;
          radius: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          app_name: string;
          created_at?: string;
          font?: string;
          logo_url?: string | null;
          primary_color?: string;
          radius?: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          app_name?: string;
          created_at?: string;
          font?: string;
          logo_url?: string | null;
          primary_color?: string;
          radius?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'themes_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          birthdate: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          first_name: string | null;
          gender: string | null;
          id: string;
          last_name: string | null;
          locale: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          birthdate?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          first_name?: string | null;
          gender?: string | null;
          id: string;
          last_name?: string | null;
          locale?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          birthdate?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          first_name?: string | null;
          gender?: string | null;
          id?: string;
          last_name?: string | null;
          locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      app_error: {
        Args: { p_code: string; p_message: string; p_sqlstate?: string };
        Returns: undefined;
      };
      create_tenant: {
        Args: { p_name: string; p_slug: string };
        Returns: string;
      };
      current_policy_version: { Args: never; Returns: string };
      current_tenant_ids: { Args: never; Returns: string[] };
      current_tenant_role: {
        Args: { p_tenant_id: string };
        Returns: Database['public']['Enums']['membership_role'];
      };
      leave_tenant: { Args: { p_tenant_id: string }; Returns: undefined };
      log_audit: {
        Args: {
          p_action: string;
          p_diff?: Json;
          p_ip?: unknown;
          p_target_id?: string;
          p_target_type: string;
          p_tenant_id: string;
        };
        Returns: string;
      };
      me: { Args: { p_tenant_id?: string }; Returns: Json };
      remove_member: { Args: { p_membership_id: string }; Returns: undefined };
      set_member_role: {
        Args: {
          p_membership_id: string;
          p_role: Database['public']['Enums']['membership_role'];
        };
        Returns: undefined;
      };
      tenant_public_profile: {
        Args: { p_slug: string };
        Returns: {
          app_name: string;
          font: string;
          logo_url: string;
          name: string;
          primary_color: string;
          radius: number;
          slug: string;
        }[];
      };
      uuid_generate_v7: { Args: never; Returns: string };
    };
    Enums: {
      consent_purpose:
        | 'TERMS'
        | 'PRIVACY'
        | 'BOX_TERMS'
        | 'PUSH'
        | 'LEADERBOARD'
        | 'NETWORK_SHARING'
        | 'MARKETING';
      invitation_status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
      ledger_direction: 'CREDIT' | 'DEBIT';
      membership_role: 'OWNER' | 'MANAGER' | 'COACH' | 'MEMBER';
      membership_status: 'ACTIVE' | 'SUSPENDED' | 'LEFT' | 'REMOVED';
      tenant_status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      consent_purpose: [
        'TERMS',
        'PRIVACY',
        'BOX_TERMS',
        'PUSH',
        'LEADERBOARD',
        'NETWORK_SHARING',
        'MARKETING',
      ],
      invitation_status: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
      ledger_direction: ['CREDIT', 'DEBIT'],
      membership_role: ['OWNER', 'MANAGER', 'COACH', 'MEMBER'],
      membership_status: ['ACTIVE', 'SUSPENDED', 'LEFT', 'REMOVED'],
      tenant_status: ['ACTIVE', 'SUSPENDED', 'CLOSED'],
    },
  },
} as const;
