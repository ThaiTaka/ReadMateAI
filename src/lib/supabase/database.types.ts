export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audio_asset_versions: {
        Row: {
          asset_id: string;
          consent_id: string;
          content_hash: string;
          created_at: string;
          created_by: string;
          duration_ms: number;
          id: string;
          mime_type: string;
          review_listened: boolean;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          school_id: string;
          size_bytes: number;
          spoken_label: string;
          status: string;
          storage_bucket: string;
          storage_key: string;
          submitted_at: string | null;
          submitted_by: string | null;
          version_no: number;
        };
        ComputedFields: never;
        Insert: {
          asset_id: string;
          consent_id: string;
          content_hash: string;
          created_at?: string;
          created_by: string;
          duration_ms: number;
          id: string;
          mime_type: string;
          review_listened?: boolean;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          school_id: string;
          size_bytes: number;
          spoken_label: string;
          status?: string;
          storage_bucket?: string;
          storage_key: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          version_no: number;
        };
        Update: {
          asset_id?: string;
          consent_id?: string;
          content_hash?: string;
          created_at?: string;
          created_by?: string;
          duration_ms?: number;
          id?: string;
          mime_type?: string;
          review_listened?: boolean;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          school_id?: string;
          size_bytes?: number;
          spoken_label?: string;
          status?: string;
          storage_bucket?: string;
          storage_key?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          version_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: "audio_asset_versions_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "audio_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_asset_versions_consent_id_fkey";
            columns: ["consent_id"];
            isOneToOne: false;
            referencedRelation: "audio_voice_consents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_asset_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_asset_versions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_asset_versions_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_asset_versions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_asset_versions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audio_assets: {
        Row: {
          active_version_id: string | null;
          confirmed_label: string | null;
          created_at: string;
          created_by: string;
          id: string;
          pronunciation_confirmed_at: string | null;
          pronunciation_confirmed_by: string | null;
          proposed_label: string;
          school_id: string;
          source: string;
          teacher_note: string | null;
          unit_kind: string;
          unit_text: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active_version_id?: string | null;
          confirmed_label?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          pronunciation_confirmed_at?: string | null;
          pronunciation_confirmed_by?: string | null;
          proposed_label: string;
          school_id: string;
          source?: string;
          teacher_note?: string | null;
          unit_kind: string;
          unit_text: string;
          updated_at?: string;
        };
        Update: {
          active_version_id?: string | null;
          confirmed_label?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          pronunciation_confirmed_at?: string | null;
          pronunciation_confirmed_by?: string | null;
          proposed_label?: string;
          school_id?: string;
          source?: string;
          teacher_note?: string | null;
          unit_kind?: string;
          unit_text?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audio_assets_active_version_fk";
            columns: ["active_version_id"];
            isOneToOne: false;
            referencedRelation: "audio_asset_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_assets_pronunciation_confirmed_by_fkey";
            columns: ["pronunciation_confirmed_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_assets_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      audio_voice_consents: {
        Row: {
          granted_at: string;
          id: string;
          notice_version: string;
          school_id: string;
          scope: string;
          staff_id: string;
          status: string;
          withdraw_reason: string | null;
          withdrawn_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          id?: string;
          notice_version: string;
          school_id: string;
          scope?: string;
          staff_id: string;
          status?: string;
          withdraw_reason?: string | null;
          withdrawn_at?: string | null;
        };
        Update: {
          granted_at?: string;
          id?: string;
          notice_version?: string;
          school_id?: string;
          scope?: string;
          staff_id?: string;
          status?: string;
          withdraw_reason?: string | null;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audio_voice_consents_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_voice_consents_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
      content_reviews: {
        Row: {
          action: string;
          checklist: NonNullable<Json>;
          comment: string | null;
          content_hash: string;
          created_at: string;
          exercise_version_id: string;
          id: string;
          reviewer_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          checklist?: NonNullable<Json>;
          comment?: string | null;
          content_hash: string;
          created_at?: string;
          exercise_version_id: string;
          id?: string;
          reviewer_id: string;
        };
        Update: {
          action?: string;
          checklist?: NonNullable<Json>;
          comment?: string | null;
          content_hash?: string;
          created_at?: string;
          exercise_version_id?: string;
          id?: string;
          reviewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_reviews_exercise_version_id_fkey";
            columns: ["exercise_version_id"];
            isOneToOne: false;
            referencedRelation: "exercise_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
        ];
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
      exercise_items: {
        Row: {
          answer: NonNullable<Json>;
          audio: NonNullable<Json>;
          content: NonNullable<Json>;
          content_fingerprint: string;
          difficulty: number;
          exercise_version_id: string;
          id: string;
          item_key: string;
          item_schema_version: number;
          objective: NonNullable<Json>;
          position: number;
          required_units: string[];
          type_code: string;
          variant: string;
        };
        ComputedFields: never;
        Insert: {
          answer: NonNullable<Json>;
          audio?: NonNullable<Json>;
          content: NonNullable<Json>;
          content_fingerprint: string;
          difficulty: number;
          exercise_version_id: string;
          id?: string;
          item_key: string;
          item_schema_version?: number;
          objective: NonNullable<Json>;
          position: number;
          required_units?: string[];
          type_code: string;
          variant: string;
        };
        Update: {
          answer?: NonNullable<Json>;
          audio?: NonNullable<Json>;
          content?: NonNullable<Json>;
          content_fingerprint?: string;
          difficulty?: number;
          exercise_version_id?: string;
          id?: string;
          item_key?: string;
          item_schema_version?: number;
          objective?: NonNullable<Json>;
          position?: number;
          required_units?: string[];
          type_code?: string;
          variant?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_items_exercise_version_id_fkey";
            columns: ["exercise_version_id"];
            isOneToOne: false;
            referencedRelation: "exercise_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_versions: {
        Row: {
          content_hash: string | null;
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decided_by: string | null;
          exercise_id: string;
          id: string;
          lesson_ordinal: number;
          schema_version: number;
          series_id: string;
          source: NonNullable<Json>;
          status: string;
          submitted_at: string | null;
          validation_report: NonNullable<Json>;
          version_no: number;
        };
        ComputedFields: never;
        Insert: {
          content_hash?: string | null;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          exercise_id: string;
          id?: string;
          lesson_ordinal: number;
          schema_version?: number;
          series_id: string;
          source?: NonNullable<Json>;
          status?: string;
          submitted_at?: string | null;
          validation_report?: NonNullable<Json>;
          version_no: number;
        };
        Update: {
          content_hash?: string | null;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          exercise_id?: string;
          id?: string;
          lesson_ordinal?: number;
          schema_version?: number;
          series_id?: string;
          source?: NonNullable<Json>;
          status?: string;
          submitted_at?: string | null;
          validation_report?: NonNullable<Json>;
          version_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_versions_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_versions_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_versions_series_id_fkey";
            columns: ["series_id"];
            isOneToOne: false;
            referencedRelation: "curriculum_series";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          key: string;
          origin: string;
          owner_school_id: string | null;
          target_bands: string[];
          title: string;
          type_code: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key: string;
          origin: string;
          owner_school_id?: string | null;
          target_bands?: string[];
          title: string;
          type_code: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key?: string;
          origin?: string;
          owner_school_id?: string | null;
          target_bands?: string[];
          title?: string;
          type_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercises_owner_school_id_fkey";
            columns: ["owner_school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      game_encounters: {
        Row: {
          activated_at: string | null;
          class_id: string;
          encounter_no: number;
          hp_remaining: number;
          id: string;
          monster_key: string;
          resolved_at: string | null;
          return_position: Json | null;
          run_id: string;
          season_id: string;
          status: string;
          student_id: string;
          trigger_key: string;
        };
        ComputedFields: never;
        Insert: {
          activated_at?: string | null;
          class_id: string;
          encounter_no: number;
          hp_remaining?: number;
          id?: string;
          monster_key: string;
          resolved_at?: string | null;
          return_position?: Json | null;
          run_id: string;
          season_id: string;
          status?: string;
          student_id: string;
          trigger_key: string;
        };
        Update: {
          activated_at?: string | null;
          class_id?: string;
          encounter_no?: number;
          hp_remaining?: number;
          id?: string;
          monster_key?: string;
          resolved_at?: string | null;
          return_position?: Json | null;
          run_id?: string;
          season_id?: string;
          status?: string;
          student_id?: string;
          trigger_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_encounters_run_id_student_id_class_id_season_id_fkey";
            columns: ["run_id", "student_id", "class_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "game_runs";
            referencedColumns: ["id", "student_id", "class_id", "season_id"];
          },
        ];
      };
      game_runs: {
        Row: {
          class_id: string;
          completed_at: string | null;
          encounter_count: number;
          ended_at: string | null;
          game_key: string;
          id: string;
          is_replay: boolean;
          last_active_at: string;
          level_key: string;
          level_version: string;
          position: NonNullable<Json>;
          scored: boolean;
          season_id: string;
          started_at: string;
          state_version: number;
          status: string;
          student_id: string;
          treasure_opened_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          completed_at?: string | null;
          encounter_count?: number;
          ended_at?: string | null;
          game_key: string;
          id?: string;
          is_replay?: boolean;
          last_active_at?: string;
          level_key: string;
          level_version: string;
          position: NonNullable<Json>;
          scored?: boolean;
          season_id: string;
          started_at?: string;
          state_version?: number;
          status?: string;
          student_id: string;
          treasure_opened_at?: string | null;
        };
        Update: {
          class_id?: string;
          completed_at?: string | null;
          encounter_count?: number;
          ended_at?: string | null;
          game_key?: string;
          id?: string;
          is_replay?: boolean;
          last_active_at?: string;
          level_key?: string;
          level_version?: string;
          position?: NonNullable<Json>;
          scored?: boolean;
          season_id?: string;
          started_at?: string;
          state_version?: number;
          status?: string;
          student_id?: string;
          treasure_opened_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_runs_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "game_runs_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      game_unlocks: {
        Row: {
          balance_at_unlock: number;
          class_id: string;
          first_reached_at: string;
          game_key: string;
          season_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          balance_at_unlock: number;
          class_id: string;
          first_reached_at?: string;
          game_key: string;
          season_id: string;
          student_id: string;
        };
        Update: {
          balance_at_unlock?: number;
          class_id?: string;
          first_reached_at?: string;
          game_key?: string;
          season_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_unlocks_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "game_unlocks_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
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
      honor_snapshot_entries: {
        Row: {
          alias: string;
          avatar_key: string;
          class_id: string;
          points: number;
          position: number;
          rank: number;
          snapshot_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          alias: string;
          avatar_key: string;
          class_id: string;
          points: number;
          position: number;
          rank: number;
          snapshot_id: string;
          student_id: string;
        };
        Update: {
          alias?: string;
          avatar_key?: string;
          class_id?: string;
          points?: number;
          position?: number;
          rank?: number;
          snapshot_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "honor_snapshot_entries_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "honor_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "honor_snapshot_entries_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      honor_snapshot_requests: {
        Row: {
          class_id: string;
          created_at: string;
          deduplicated: boolean;
          request_id: string;
          requested_by: string;
          snapshot_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          deduplicated: boolean;
          request_id: string;
          requested_by: string;
          snapshot_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          deduplicated?: boolean;
          request_id?: string;
          requested_by?: string;
          snapshot_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "honor_snapshot_requests_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "honor_snapshot_requests_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "honor_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      honor_snapshots: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          id: string;
          season_id: string;
          season_no: number;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          season_id: string;
          season_no: number;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          season_id?: string;
          season_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: "honor_snapshots_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "honor_snapshots_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      item_attempts: {
        Row: {
          attempt_no: number;
          class_id: string;
          client_attempt_id: string;
          error_tags: string[];
          exercise_item_id: string;
          grader_version: string;
          id: string;
          is_correct: boolean;
          marks: NonNullable<Json>;
          question_instance_id: string;
          received_at: string;
          request_hash: string;
          response: NonNullable<Json>;
          response_key: string;
          scorable: boolean;
          season_id: string;
          student_id: string;
          support_level: number;
        };
        ComputedFields: never;
        Insert: {
          attempt_no: number;
          class_id: string;
          client_attempt_id: string;
          error_tags?: string[];
          exercise_item_id: string;
          grader_version: string;
          id?: string;
          is_correct: boolean;
          marks?: NonNullable<Json>;
          question_instance_id: string;
          received_at?: string;
          request_hash: string;
          response: NonNullable<Json>;
          response_key: string;
          scorable: boolean;
          season_id: string;
          student_id: string;
          support_level: number;
        };
        Update: {
          attempt_no?: number;
          class_id?: string;
          client_attempt_id?: string;
          error_tags?: string[];
          exercise_item_id?: string;
          grader_version?: string;
          id?: string;
          is_correct?: boolean;
          marks?: NonNullable<Json>;
          question_instance_id?: string;
          received_at?: string;
          request_hash?: string;
          response?: NonNullable<Json>;
          response_key?: string;
          scorable?: boolean;
          season_id?: string;
          student_id?: string;
          support_level?: number;
        };
        Relationships: [
          {
            foreignKeyName: "item_attempts_exercise_item_id_fkey";
            columns: ["exercise_item_id"];
            isOneToOne: false;
            referencedRelation: "exercise_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_attempts_question_instance_id_fkey";
            columns: ["question_instance_id"];
            isOneToOne: false;
            referencedRelation: "question_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_attempts_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "item_attempts_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
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
      map_tile_reveals: {
        Row: {
          class_id: string;
          earned_total_at_reveal: number;
          map_key: string;
          ordinal: number;
          revealed_at: string;
          season_id: string;
          student_id: string;
          tile_key: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          earned_total_at_reveal: number;
          map_key: string;
          ordinal: number;
          revealed_at?: string;
          season_id: string;
          student_id: string;
          tile_key: string;
        };
        Update: {
          class_id?: string;
          earned_total_at_reveal?: number;
          map_key?: string;
          ordinal?: number;
          revealed_at?: string;
          season_id?: string;
          student_id?: string;
          tile_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_tile_reveals_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "map_tile_reveals_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      point_events: {
        Row: {
          applied_delta: number;
          attempt_no: number;
          balance_after: number;
          balance_before: number;
          class_id: string;
          created_at: string;
          earned_total_after: number;
          id: string;
          idempotency_key: string;
          item_attempt_id: string;
          nominal_delta: number;
          outcome: string;
          question_instance_id: string;
          rules_version: string;
          season_id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          applied_delta: number;
          attempt_no: number;
          balance_after: number;
          balance_before: number;
          class_id: string;
          created_at?: string;
          earned_total_after: number;
          id?: string;
          idempotency_key: string;
          item_attempt_id: string;
          nominal_delta: number;
          outcome: string;
          question_instance_id: string;
          rules_version: string;
          season_id: string;
          student_id: string;
        };
        Update: {
          applied_delta?: number;
          attempt_no?: number;
          balance_after?: number;
          balance_before?: number;
          class_id?: string;
          created_at?: string;
          earned_total_after?: number;
          id?: string;
          idempotency_key?: string;
          item_attempt_id?: string;
          nominal_delta?: number;
          outcome?: string;
          question_instance_id?: string;
          rules_version?: string;
          season_id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "point_events_item_attempt_id_fkey";
            columns: ["item_attempt_id"];
            isOneToOne: true;
            referencedRelation: "item_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "point_events_question_instance_id_fkey";
            columns: ["question_instance_id"];
            isOneToOne: false;
            referencedRelation: "question_instances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "point_events_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "point_events_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      practice_sessions: {
        Row: {
          class_id: string;
          device_id: string | null;
          ended_at: string | null;
          id: string;
          mode: string;
          plan: NonNullable<Json>;
          planner_version: string;
          question_count: number;
          season_id: string;
          started_at: string;
          status: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          device_id?: string | null;
          ended_at?: string | null;
          id?: string;
          mode?: string;
          plan?: NonNullable<Json>;
          planner_version: string;
          question_count: number;
          season_id: string;
          started_at?: string;
          status?: string;
          student_id: string;
        };
        Update: {
          class_id?: string;
          device_id?: string | null;
          ended_at?: string | null;
          id?: string;
          mode?: string;
          plan?: NonNullable<Json>;
          planner_version?: string;
          question_count?: number;
          season_id?: string;
          started_at?: string;
          status?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_sessions_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "student_devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practice_sessions_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "practice_sessions_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      question_instances: {
        Row: {
          attempts_used: number;
          class_id: string;
          closed_at: string | null;
          content_fingerprint: string;
          context_kind: string;
          exercise_item_id: string;
          exercise_version_id: string;
          game_encounter_id: string | null;
          id: string;
          max_attempts: number;
          not_scorable_reason: string | null;
          opened_at: string;
          position: number;
          practice_session_id: string | null;
          rewarded: boolean;
          run_id: string | null;
          scorable: boolean;
          season_id: string;
          status: string;
          student_id: string;
          support_level: number;
          view: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          attempts_used?: number;
          class_id: string;
          closed_at?: string | null;
          content_fingerprint: string;
          context_kind?: string;
          exercise_item_id: string;
          exercise_version_id: string;
          game_encounter_id?: string | null;
          id?: string;
          max_attempts: number;
          not_scorable_reason?: string | null;
          opened_at?: string;
          position: number;
          practice_session_id?: string | null;
          rewarded?: boolean;
          run_id?: string | null;
          scorable: boolean;
          season_id: string;
          status?: string;
          student_id: string;
          support_level: number;
          view: NonNullable<Json>;
        };
        Update: {
          attempts_used?: number;
          class_id?: string;
          closed_at?: string | null;
          content_fingerprint?: string;
          context_kind?: string;
          exercise_item_id?: string;
          exercise_version_id?: string;
          game_encounter_id?: string | null;
          id?: string;
          max_attempts?: number;
          not_scorable_reason?: string | null;
          opened_at?: string;
          position?: number;
          practice_session_id?: string | null;
          rewarded?: boolean;
          run_id?: string | null;
          scorable?: boolean;
          season_id?: string;
          status?: string;
          student_id?: string;
          support_level?: number;
          view?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "question_instances_exercise_item_id_fkey";
            columns: ["exercise_item_id"];
            isOneToOne: false;
            referencedRelation: "exercise_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_instances_exercise_version_id_fkey";
            columns: ["exercise_version_id"];
            isOneToOne: false;
            referencedRelation: "exercise_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_instances_game_encounter_fk";
            columns: ["game_encounter_id", "run_id", "student_id", "class_id", "season_id"];
            isOneToOne: false;
            referencedRelation: "game_encounters";
            referencedColumns: ["id", "run_id", "student_id", "class_id", "season_id"];
          },
          {
            foreignKeyName: "question_instances_practice_session_id_fkey";
            columns: ["practice_session_id"];
            isOneToOne: false;
            referencedRelation: "practice_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_instances_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "question_instances_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
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
      season_resets: {
        Row: {
          class_id: string;
          new_season_id: string;
          old_season_id: string;
          performed_at: string;
          performed_by: string;
          request_id: string;
          scored_students: number;
          voided_encounters: number;
          voided_game_runs: number;
          voided_questions: number;
          voided_sessions: number;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          new_season_id: string;
          old_season_id: string;
          performed_at?: string;
          performed_by: string;
          request_id: string;
          scored_students: number;
          voided_encounters?: number;
          voided_game_runs?: number;
          voided_questions: number;
          voided_sessions: number;
        };
        Update: {
          class_id?: string;
          new_season_id?: string;
          old_season_id?: string;
          performed_at?: string;
          performed_by?: string;
          request_id?: string;
          scored_students?: number;
          voided_encounters?: number;
          voided_game_runs?: number;
          voided_questions?: number;
          voided_sessions?: number;
        };
        Relationships: [
          {
            foreignKeyName: "season_resets_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_resets_new_season_id_class_id_fkey";
            columns: ["new_season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "season_resets_old_season_id_class_id_fkey";
            columns: ["old_season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
        ];
      };
      season_scores: {
        Row: {
          balance: number;
          balance_updated_at: string | null;
          class_id: string;
          created_at: string;
          deducted_total: number;
          earned_total: number;
          final_rank: number | null;
          season_id: string;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          balance?: number;
          balance_updated_at?: string | null;
          class_id: string;
          created_at?: string;
          deducted_total?: number;
          earned_total?: number;
          final_rank?: number | null;
          season_id: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          balance?: number;
          balance_updated_at?: string | null;
          class_id?: string;
          created_at?: string;
          deducted_total?: number;
          earned_total?: number;
          final_rank?: number | null;
          season_id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_scores_season_id_class_id_fkey";
            columns: ["season_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "class_id"];
          },
          {
            foreignKeyName: "season_scores_student_id_class_id_fkey";
            columns: ["student_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "class_id"];
          },
        ];
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
      tts_audio_versions: {
        Row: {
          asset_key: string;
          config_version: string;
          content_hash: string;
          content_sha256: string;
          duration_ms: number;
          entry_id: string;
          generated_at: string;
          generated_by: string;
          id: string;
          mime_type: string;
          provider: string;
          purpose: string;
          review_listened: boolean;
          review_note: string | null;
          review_pronunciation_confirmed: boolean;
          reviewed_at: string | null;
          reviewed_by: string | null;
          revoke_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          school_id: string;
          size_bytes: number;
          speed: string;
          status: string;
          storage_bucket: string;
          storage_key: string;
          test_only: boolean;
          text_nfc: string;
          version_no: number;
          voice_key: string;
        };
        ComputedFields: never;
        Insert: {
          asset_key: string;
          config_version: string;
          content_hash: string;
          content_sha256: string;
          duration_ms: number;
          entry_id: string;
          generated_at?: string;
          generated_by: string;
          id?: string;
          mime_type: string;
          provider: string;
          purpose: string;
          review_listened?: boolean;
          review_note?: string | null;
          review_pronunciation_confirmed?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          school_id: string;
          size_bytes: number;
          speed: string;
          status?: string;
          storage_bucket?: string;
          storage_key: string;
          test_only?: boolean;
          text_nfc: string;
          version_no: number;
          voice_key: string;
        };
        Update: {
          asset_key?: string;
          config_version?: string;
          content_hash?: string;
          content_sha256?: string;
          duration_ms?: number;
          entry_id?: string;
          generated_at?: string;
          generated_by?: string;
          id?: string;
          mime_type?: string;
          provider?: string;
          purpose?: string;
          review_listened?: boolean;
          review_note?: string | null;
          review_pronunciation_confirmed?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          school_id?: string;
          size_bytes?: number;
          speed?: string;
          status?: string;
          storage_bucket?: string;
          storage_key?: string;
          test_only?: boolean;
          text_nfc?: string;
          version_no?: number;
          voice_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tts_audio_versions_generated_by_fkey";
            columns: ["generated_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tts_audio_versions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tts_audio_versions_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tts_audio_versions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      tts_script_reviews: {
        Row: {
          content_hash: string;
          decision: string;
          entry_id: string;
          id: string;
          note: string | null;
          pronunciation_confirmed: boolean;
          reviewed_at: string;
          reviewed_by: string;
          school_id: string;
        };
        ComputedFields: never;
        Insert: {
          content_hash: string;
          decision: string;
          entry_id: string;
          id?: string;
          note?: string | null;
          pronunciation_confirmed: boolean;
          reviewed_at?: string;
          reviewed_by: string;
          school_id: string;
        };
        Update: {
          content_hash?: string;
          decision?: string;
          entry_id?: string;
          id?: string;
          note?: string | null;
          pronunciation_confirmed?: boolean;
          reviewed_at?: string;
          reviewed_by?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tts_script_reviews_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "staff_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tts_script_reviews_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      gateway_activate_encounter: {
        Args: { p_auth_user_id: string; p_run_id: string; p_student_id: string };
        Returns: Json;
      };
      gateway_check_login_code: { Args: { p_code_hmac: string; p_kind: string }; Returns: string };
      gateway_class_leaderboard: { Args: { p_auth_user_id: string; p_student_id: string }; Returns: Json };
      gateway_consume_rate_limit: {
        Args: { p_key_hash: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      gateway_latest_honors: { Args: { p_auth_user_id: string; p_student_id: string }; Returns: Json };
      gateway_list_learning_audio: {
        Args: { p_auth_user_id: string; p_student_id: string; p_units: Json };
        Returns: Json;
      };
      gateway_open_treasure: {
        Args: { p_auth_user_id: string; p_run_id: string; p_student_id: string };
        Returns: Json;
      };
      gateway_practice_candidates: { Args: { p_auth_user_id: string; p_student_id: string }; Returns: Json };
      gateway_record_attempt: {
        Args: {
          p_auth_user_id: string;
          p_client_attempt_id: string;
          p_error_tags: string[];
          p_grader_version: string;
          p_is_correct: boolean;
          p_marks: Json;
          p_question_instance_id: string;
          p_request_hash: string;
          p_response: Json;
          p_response_key: string;
        };
        Returns: Json;
      };
      gateway_redeem_login_code: {
        Args: { p_auth_user_id: string; p_code_hmac: string; p_kind: string };
        Returns: {
          device_id: string;
          outcome: string;
          student_id: string;
        }[];
      };
      gateway_resolve_learning_audio: {
        Args: {
          p_auth_user_id: string;
          p_expected_label: string;
          p_fallback_unit_text: string;
          p_student_id: string;
          p_unit_kind: string;
          p_unit_text: string;
        };
        Returns: Json;
      };
      gateway_resolve_teacher_audio: {
        Args: {
          p_auth_user_id: string;
          p_expected_label: string;
          p_fallback_unit_text: string;
          p_question_instance_id: string;
          p_unit_text: string;
        };
        Returns: Json;
      };
      gateway_resolve_tts_line: {
        Args: {
          p_asset_key: string;
          p_auth_user_id: string;
          p_content_hash: string;
          p_entry_id: string;
          p_student_id: string;
        };
        Returns: Json;
      };
      gateway_reveal_map_tile: {
        Args: {
          p_adjacent_to_start: boolean;
          p_auth_user_id: string;
          p_map_key: string;
          p_neighbors: string[];
          p_student_id: string;
          p_tile_count: number;
          p_tile_key: string;
        };
        Returns: Json;
      };
      gateway_save_game_position: {
        Args: { p_auth_user_id: string; p_path: Json; p_run_id: string; p_state_version: number; p_student_id: string };
        Returns: Json;
      };
      gateway_scoring_rules: { Args: { p_version: string }; Returns: Json };
      gateway_start_game_run: {
        Args: {
          p_auth_user_id: string;
          p_game_key: string;
          p_level_key: string;
          p_plan?: Json;
          p_replay?: boolean;
          p_student_id: string;
        };
        Returns: Json;
      };
      gateway_start_practice_session: {
        Args: { p_auth_user_id: string; p_items: Json; p_planner_version: string; p_student_id: string };
        Returns: Json;
      };
      gateway_touch_device: { Args: { p_auth_user_id: string; p_student_id: string }; Returns: undefined };
      gateway_update_student_preferences: {
        Args: { p_auth_user_id: string; p_avatar_key: string; p_motion: string; p_sound: string; p_student_id: string };
        Returns: boolean;
      };
      teacher_approve_leaderboard_alias: { Args: { p_student_id: string }; Returns: undefined };
      teacher_assign_band: { Args: { p_band: string; p_reason: string; p_student_id: string }; Returns: undefined };
      teacher_audio_status: { Args: Record<PropertyKey, never>; Returns: Json };
      teacher_confirm_audio_pronunciation: { Args: { p_asset_id: string; p_label: string }; Returns: undefined };
      teacher_confirm_class_curriculum: { Args: { p_class_id: string }; Returns: undefined };
      teacher_create_audio_version: {
        Args: {
          p_asset_id: string;
          p_content_hash: string;
          p_duration_ms: number;
          p_mime_type: string;
          p_size_bytes: number;
          p_storage_key: string;
          p_version_id: string;
        };
        Returns: Json;
      };
      teacher_create_class: { Args: { p_name: string; p_school_year: string }; Returns: string };
      teacher_create_honor_snapshot: { Args: { p_class_id: string; p_request_id: string }; Returns: Json };
      teacher_create_student: {
        Args: { p_avatar_key: string; p_class_id: string; p_display_name: string; p_student_number: number };
        Returns: string;
      };
      teacher_discard_audio_version: { Args: { p_version_id: string }; Returns: undefined };
      teacher_ensure_audio_asset: {
        Args: { p_proposed_label: string; p_unit_kind: string; p_unit_text: string };
        Returns: string;
      };
      teacher_get_honor_snapshot: { Args: { p_snapshot_id: string }; Returns: Json };
      teacher_grant_audio_consent: { Args: { p_notice_version: string }; Returns: string };
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
      teacher_leaderboard_display: { Args: { p_class_id: string }; Returns: Json };
      teacher_leaderboard_overview: { Args: { p_class_id: string }; Returns: Json };
      teacher_list_honor_snapshots: { Args: { p_class_id: string }; Returns: Json };
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
      teacher_register_tts_version: {
        Args: {
          p_asset_key: string;
          p_config_version: string;
          p_content_hash: string;
          p_content_sha256: string;
          p_duration_ms: number;
          p_entry_id: string;
          p_mime_type: string;
          p_provider: string;
          p_purpose: string;
          p_size_bytes: number;
          p_speed: string;
          p_storage_key: string;
          p_test_only: boolean;
          p_text: string;
          p_version_id: string;
          p_voice_key: string;
        };
        Returns: Json;
      };
      teacher_rename_class: { Args: { p_class_id: string; p_name: string }; Returns: undefined };
      teacher_reset_season: {
        Args: { p_class_id: string; p_confirmation: string; p_expected_season_id: string; p_request_id: string };
        Returns: Json;
      };
      teacher_review_audio_version: {
        Args: { p_decision: string; p_listened: boolean; p_note: string; p_version_id: string };
        Returns: Json;
      };
      teacher_review_tts_script: {
        Args: {
          p_content_hash: string;
          p_decision: string;
          p_entry_id: string;
          p_note: string;
          p_pronunciation_confirmed: boolean;
        };
        Returns: Json;
      };
      teacher_review_tts_version: {
        Args: {
          p_decision: string;
          p_listened: boolean;
          p_note: string;
          p_pronunciation_confirmed: boolean;
          p_version_id: string;
        };
        Returns: Json;
      };
      teacher_revoke_audio_version: { Args: { p_reason: string; p_version_id: string }; Returns: undefined };
      teacher_revoke_device: { Args: { p_device_id: string }; Returns: undefined };
      teacher_revoke_login_code: { Args: { p_code_id: string }; Returns: undefined };
      teacher_revoke_tts_version: { Args: { p_reason: string; p_version_id: string }; Returns: undefined };
      teacher_set_audio_note: { Args: { p_asset_id: string; p_note: string }; Returns: undefined };
      teacher_set_class_curriculum: {
        Args: { p_class_id: string; p_lesson_id: string; p_series_id: string };
        Returns: undefined;
      };
      teacher_set_honors_enabled: { Args: { p_class_id: string; p_enabled: boolean }; Returns: undefined };
      teacher_set_leaderboard_alias: { Args: { p_alias: string; p_student_id: string }; Returns: undefined };
      teacher_set_leaderboard_settings: {
        Args: { p_class_id: string; p_enabled: boolean; p_student_view: string };
        Returns: undefined;
      };
      teacher_set_student_status: { Args: { p_status: string; p_student_id: string }; Returns: undefined };
      teacher_submit_audio_version: { Args: { p_version_id: string }; Returns: undefined };
      teacher_tts_status: { Args: Record<PropertyKey, never>; Returns: Json };
      teacher_update_student: {
        Args: { p_avatar_key: string; p_display_name: string; p_student_id: string; p_student_number: number };
        Returns: undefined;
      };
      teacher_withdraw_audio_consent: { Args: { p_reason: string }; Returns: number };
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
