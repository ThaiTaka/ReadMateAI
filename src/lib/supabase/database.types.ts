export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_kind: string;
          class_id: string | null;
          id: number;
          metadata: NonNullable<Json>;
          occurred_at: string;
          target_id: string | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_kind: string;
          class_id?: string | null;
          id?: never;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_kind?: string;
          class_id?: string | null;
          id?: never;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      class_staff: {
        Row: {
          added_at: string;
          added_by: string | null;
          can_honor: boolean;
          class_id: string;
          removed_at: string | null;
          role: string;
          staff_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          added_by?: string | null;
          can_honor?: boolean;
          class_id: string;
          removed_at?: string | null;
          role: string;
          staff_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          can_honor?: boolean;
          class_id?: string;
          removed_at?: string | null;
          role?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_staff_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_staff_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_staff_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          current_lesson_id: string | null;
          curriculum_confirmed_at: string | null;
          curriculum_confirmed_by: string | null;
          curriculum_series_id: string | null;
          curriculum_status: string;
          honors_enabled: boolean;
          id: string;
          language_conventions: NonNullable<Json>;
          leaderboard_enabled: boolean;
          leaderboard_student_view: string;
          name: string;
          school_id: string;
          school_year: string;
          status: string;
          student_term: string;
          teacher_term: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_lesson_id?: string | null;
          curriculum_confirmed_at?: string | null;
          curriculum_confirmed_by?: string | null;
          curriculum_series_id?: string | null;
          curriculum_status?: string;
          honors_enabled?: boolean;
          id?: string;
          language_conventions?: NonNullable<Json>;
          leaderboard_enabled?: boolean;
          leaderboard_student_view?: string;
          name: string;
          school_id: string;
          school_year: string;
          status?: string;
          student_term?: string;
          teacher_term?: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_lesson_id?: string | null;
          curriculum_confirmed_at?: string | null;
          curriculum_confirmed_by?: string | null;
          curriculum_series_id?: string | null;
          curriculum_status?: string;
          honors_enabled?: boolean;
          id?: string;
          language_conventions?: NonNullable<Json>;
          leaderboard_enabled?: boolean;
          leaderboard_student_view?: string;
          name?: string;
          school_id?: string;
          school_year?: string;
          status?: string;
          student_term?: string;
          teacher_term?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_current_lesson_id_fkey";
            columns: ["current_lesson_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_curriculum_confirmed_by_fkey";
            columns: ["curriculum_confirmed_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_curriculum_series_id_fkey";
            columns: ["curriculum_series_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_series";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      content_releases: {
        Row: {
          content_hash: string;
          dataset_version: string;
          id: string;
          stats: NonNullable<Json>;
          synced_at: string;
        };
        ComputedFields: never;
        Insert: {
          content_hash: string;
          dataset_version: string;
          id?: string;
          stats?: NonNullable<Json>;
          synced_at?: string;
        };
        Update: {
          content_hash?: string;
          dataset_version?: string;
          id?: string;
          stats?: NonNullable<Json>;
          synced_at?: string;
        };
        Relationships: [];
      };
      curriculum_lessons: {
        Row: {
          code: string;
          id: string;
          introduces: string[];
          lesson_type: string;
          ordinal: number;
          reviews: string[];
          series_id: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          id?: string;
          introduces?: string[];
          lesson_type: string;
          ordinal: number;
          reviews?: string[];
          series_id: string;
          title: string;
        };
        Update: {
          code?: string;
          id?: string;
          introduces?: string[];
          lesson_type?: string;
          ordinal?: number;
          reviews?: string[];
          series_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculum_lessons_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_series";
            referencedColumns: ["id"];
          },
        ];
      };
      curriculum_series: {
        Row: {
          content_hash: string | null;
          id: string;
          key: string;
          release_id: string;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          series_kind: string;
          source: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          content_hash?: string | null;
          id?: string;
          key: string;
          release_id: string;
          review_status: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          series_kind: string;
          source?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          content_hash?: string | null;
          id?: string;
          key?: string;
          release_id?: string;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          series_kind?: string;
          source?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "curriculum_series_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "content_releases";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_consents: {
        Row: {
          class_id: string;
          id: string;
          method: string;
          note: string | null;
          notice_version: string;
          recorded_at: string;
          recorded_by: string;
          scope: string;
          status: string;
          student_id: string;
          withdrawn_at: string | null;
          withdrawn_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          id?: string;
          method: string;
          note?: string | null;
          notice_version: string;
          recorded_at?: string;
          recorded_by: string;
          scope: string;
          status?: string;
          student_id: string;
          withdrawn_at?: string | null;
          withdrawn_by?: string | null;
        };
        Update: {
          class_id?: string;
          id?: string;
          method?: string;
          note?: string | null;
          notice_version?: string;
          recorded_at?: string;
          recorded_by?: string;
          scope?: string;
          status?: string;
          student_id?: string;
          withdrawn_at?: string | null;
          withdrawn_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_consents_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_consents_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "guardian_consents_withdrawn_by_fkey";
            columns: ["withdrawn_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      kb_units: {
        Row: {
          content_hash: string | null;
          id: string;
          key: string;
          kind: string;
          release_id: string;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          text: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          content_hash?: string | null;
          id?: string;
          key: string;
          kind: string;
          release_id: string;
          review_status: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          text: string;
          updated_at?: string;
        };
        Update: {
          content_hash?: string | null;
          id?: string;
          key?: string;
          kind?: string;
          release_id?: string;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          text?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kb_units_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "content_releases";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_buckets: {
        Row: {
          count: number;
          key_hash: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          key_hash: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key_hash?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      schools: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          class_id: string;
          closed_by: string | null;
          config: NonNullable<Json>;
          ended_at: string | null;
          id: string;
          planned_end_on: string | null;
          rules_version: string;
          seq_no: number;
          started_at: string;
          started_by: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          closed_by?: string | null;
          config?: NonNullable<Json>;
          ended_at?: string | null;
          id?: string;
          planned_end_on?: string | null;
          rules_version: string;
          seq_no: number;
          started_at?: string;
          started_by?: string | null;
          status?: string;
        };
        Update: {
          class_id?: string;
          closed_by?: string | null;
          config?: NonNullable<Json>;
          ended_at?: string | null;
          id?: string;
          planned_end_on?: string | null;
          rules_version?: string;
          seq_no?: number;
          started_at?: string;
          started_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seasons_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seasons_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          role: string;
          school_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          is_active?: boolean;
          role?: string;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          role?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_profiles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      student_band_assignments: {
        Row: {
          band: string;
          class_id: string;
          id: string;
          reason: string | null;
          set_by: string;
          source: string;
          student_id: string;
          valid_from: string;
          valid_to: string | null;
        };
        ComputedFields: never;
        Insert: {
          band: string;
          class_id: string;
          id?: string;
          reason?: string | null;
          set_by: string;
          source?: string;
          student_id: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Update: {
          band?: string;
          class_id?: string;
          id?: string;
          reason?: string | null;
          set_by?: string;
          source?: string;
          student_id?: string;
          valid_from?: string;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_band_assignments_set_by_fkey";
            columns: ["set_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_band_assignments_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      student_devices: {
        Row: {
          auth_user_id: string;
          class_id: string;
          id: string;
          last_seen_at: string | null;
          linked_at: string;
          login_code_id: string | null;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth_user_id: string;
          class_id: string;
          id?: string;
          last_seen_at?: string | null;
          linked_at?: string;
          login_code_id?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_id: string;
        };
        Update: {
          auth_user_id?: string;
          class_id?: string;
          id?: string;
          last_seen_at?: string | null;
          linked_at?: string;
          login_code_id?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_devices_login_code_id_fkey";
            columns: ["login_code_id"];
            isOneToOne: false;
            referencedRelation: "student_login_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_devices_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_devices_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      student_login_codes: {
        Row: {
          backup_code_hmac: string;
          class_id: string;
          created_at: string;
          created_by: string;
          devices_linked: number;
          expires_at: string;
          id: string;
          last_used_at: string | null;
          max_devices: number;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          student_id: string;
          token_hmac: string;
        };
        ComputedFields: never;
        Insert: {
          backup_code_hmac: string;
          class_id: string;
          created_at?: string;
          created_by: string;
          devices_linked?: number;
          expires_at: string;
          id?: string;
          last_used_at?: string | null;
          max_devices?: number;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_id: string;
          token_hmac: string;
        };
        Update: {
          backup_code_hmac?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string;
          devices_linked?: number;
          expires_at?: string;
          id?: string;
          last_used_at?: string | null;
          max_devices?: number;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          student_id?: string;
          token_hmac?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_login_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_login_codes_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_login_codes_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      students: {
        Row: {
          archived_at: string | null;
          avatar_key: string;
          class_id: string;
          created_at: string;
          created_by: string | null;
          display_name: string;
          id: string;
          leaderboard_alias: string | null;
          leaderboard_alias_approved_at: string | null;
          leaderboard_alias_approved_by: string | null;
          motion_preference: string;
          sound_preference: string;
          status: string;
          student_number: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          avatar_key: string;
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          display_name: string;
          id?: string;
          leaderboard_alias?: string | null;
          leaderboard_alias_approved_at?: string | null;
          leaderboard_alias_approved_by?: string | null;
          motion_preference?: string;
          sound_preference?: string;
          status?: string;
          student_number?: number | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          avatar_key?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          display_name?: string;
          id?: string;
          leaderboard_alias?: string | null;
          leaderboard_alias_approved_at?: string | null;
          leaderboard_alias_approved_by?: string | null;
          motion_preference?: string;
          sound_preference?: string;
          status?: string;
          student_number?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_leaderboard_alias_approved_by_fkey";
            columns: ["leaderboard_alias_approved_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      gateway_check_login_code: { Args: { p_code_hmac: string; p_kind: string }; Returns: string };
      gateway_consume_rate_limit: {
        Args: { p_key_hash: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      gateway_redeem_login_code: {
        Args: { p_auth_user_id: string; p_code_hmac: string; p_kind: string };
        Returns: {
          device_id: string;
          outcome: string;
          student_id: string;
        }[];
      };
      gateway_touch_device: { Args: { p_auth_user_id: string; p_student_id: string }; Returns: undefined };
      gateway_update_student_preferences: {
        Args: { p_auth_user_id: string; p_avatar_key: string; p_motion: string; p_sound: string; p_student_id: string };
        Returns: boolean;
      };
      teacher_approve_leaderboard_alias: { Args: { p_student_id: string }; Returns: undefined };
      teacher_assign_band: { Args: { p_band: string; p_reason: string; p_student_id: string }; Returns: undefined };
      teacher_confirm_class_curriculum: { Args: { p_class_id: string }; Returns: undefined };
      teacher_create_class: { Args: { p_name: string; p_school_year: string }; Returns: string };
      teacher_create_student: {
        Args: { p_avatar_key: string; p_class_id: string; p_display_name: string; p_student_number: number };
        Returns: string;
      };
      teacher_issue_login_code: {
        Args: {
          p_backup_code_hmac: string;
          p_expires_at: string;
          p_max_devices: number;
          p_student_id: string;
          p_token_hmac: string;
        };
        Returns: string;
      };
      teacher_record_consent: {
        Args: {
          p_attested: boolean;
          p_method: string;
          p_note: string;
          p_notice_version: string;
          p_scope: string;
          p_student_id: string;
        };
        Returns: string;
      };
      teacher_rename_class: { Args: { p_class_id: string; p_name: string }; Returns: undefined };
      teacher_revoke_device: { Args: { p_device_id: string }; Returns: undefined };
      teacher_revoke_login_code: { Args: { p_code_id: string }; Returns: undefined };
      teacher_set_class_curriculum: {
        Args: { p_class_id: string; p_lesson_id: string; p_series_id: string };
        Returns: undefined;
      };
      teacher_set_leaderboard_alias: { Args: { p_alias: string; p_student_id: string }; Returns: undefined };
      teacher_set_student_status: { Args: { p_status: string; p_student_id: string }; Returns: undefined };
      teacher_update_student: {
        Args: { p_avatar_key: string; p_display_name: string; p_student_id: string; p_student_number: number };
        Returns: undefined;
      };
      teacher_withdraw_consent: { Args: { p_scope: string; p_student_id: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
