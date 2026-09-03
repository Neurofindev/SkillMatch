export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      account_action_requests: {
        Row: {
          id: string;
          processed_at: string | null;
          processed_by: string | null;
          profile_id: string;
          reason: string | null;
          request_type: string;
          requested_at: string;
          resolution_note: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          processed_at?: string | null;
          processed_by?: string | null;
          profile_id: string;
          reason?: string | null;
          request_type?: string;
          requested_at?: string;
          resolution_note?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          processed_at?: string | null;
          processed_by?: string | null;
          profile_id?: string;
          reason?: string | null;
          request_type?: string;
          requested_at?: string;
          resolution_note?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_action_requests_processed_by_fkey';
            columns: ['processed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'account_action_requests_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      agreements: {
        Row: {
          budget_max: number | null;
          budget_min: number | null;
          budget_model: Database['public']['Enums']['budget_model'];
          client_confirmed_at: string | null;
          created_at: string;
          created_by: string;
          currency_code: string;
          deliverables: Json;
          ends_on: string | null;
          id: string;
          lock_version: number;
          match_id: string;
          mission_id: string;
          platform_notice: string;
          scope_snapshot: string;
          starts_on: string | null;
          status: Database['public']['Enums']['agreement_status'];
          talent_confirmed_at: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          budget_max?: number | null;
          budget_min?: number | null;
          budget_model: Database['public']['Enums']['budget_model'];
          client_confirmed_at?: string | null;
          created_at?: string;
          created_by: string;
          currency_code?: string;
          deliverables?: Json;
          ends_on?: string | null;
          id?: string;
          lock_version?: number;
          match_id: string;
          mission_id: string;
          platform_notice?: string;
          scope_snapshot: string;
          starts_on?: string | null;
          status?: Database['public']['Enums']['agreement_status'];
          talent_confirmed_at?: string | null;
          updated_at?: string;
          version: number;
        };
        Update: {
          budget_max?: number | null;
          budget_min?: number | null;
          budget_model?: Database['public']['Enums']['budget_model'];
          client_confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          currency_code?: string;
          deliverables?: Json;
          ends_on?: string | null;
          id?: string;
          lock_version?: number;
          match_id?: string;
          mission_id?: string;
          platform_notice?: string;
          scope_snapshot?: string;
          starts_on?: string | null;
          status?: Database['public']['Enums']['agreement_status'];
          talent_confirmed_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'agreements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agreements_match_mission_fk';
            columns: ['match_id', 'mission_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id', 'mission_id'];
          },
        ];
      };
      application_swipes: {
        Row: {
          application_id: string;
          created_at: string;
          decision: Database['public']['Enums']['application_swipe_decision'];
          id: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          application_id: string;
          created_at?: string;
          decision: Database['public']['Enums']['application_swipe_decision'];
          id?: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          decision?: Database['public']['Enums']['application_swipe_decision'];
          id?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'application_swipes_application_id_fkey';
            columns: ['application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'application_swipes_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      applications: {
        Row: {
          applicant_id: string;
          availability_note: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          lock_version: number;
          message: string;
          mission_id: string;
          proposed_amount: number | null;
          proposed_currency_code: string;
          relevance_details: Json;
          relevance_score: number | null;
          score_version: string | null;
          status: Database['public']['Enums']['application_status'];
          submission_confirmed_at: string;
          updated_at: string;
        };
        Insert: {
          applicant_id: string;
          availability_note: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          lock_version?: number;
          message: string;
          mission_id: string;
          proposed_amount?: number | null;
          proposed_currency_code?: string;
          relevance_details?: Json;
          relevance_score?: number | null;
          score_version?: string | null;
          status?: Database['public']['Enums']['application_status'];
          submission_confirmed_at?: string;
          updated_at?: string;
        };
        Update: {
          applicant_id?: string;
          availability_note?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          lock_version?: number;
          message?: string;
          mission_id?: string;
          proposed_amount?: number | null;
          proposed_currency_code?: string;
          relevance_details?: Json;
          relevance_score?: number | null;
          score_version?: string | null;
          status?: Database['public']['Enums']['application_status'];
          submission_confirmed_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'applications_applicant_id_fkey';
            columns: ['applicant_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'applications_mission_id_fkey';
            columns: ['mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
        ];
      };
      availability_slots: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          kind: Database['public']['Enums']['availability_kind'];
          profile_id: string;
          recurrence_rule: string | null;
          starts_at: string;
          timezone: string;
          updated_at: string;
          visibility: Database['public']['Enums']['availability_visibility'];
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          kind: Database['public']['Enums']['availability_kind'];
          profile_id: string;
          recurrence_rule?: string | null;
          starts_at: string;
          timezone: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['availability_visibility'];
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['availability_kind'];
          profile_id?: string;
          recurrence_rule?: string | null;
          starts_at?: string;
          timezone?: string;
          updated_at?: string;
          visibility?: Database['public']['Enums']['availability_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'availability_slots_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      completion_confirmations: {
        Row: {
          created_at: string;
          decision: Database['public']['Enums']['completion_decision'];
          id: string;
          match_id: string;
          mission_id: string;
          note: string | null;
          participant_id: string;
        };
        Insert: {
          created_at?: string;
          decision: Database['public']['Enums']['completion_decision'];
          id?: string;
          match_id: string;
          mission_id: string;
          note?: string | null;
          participant_id: string;
        };
        Update: {
          created_at?: string;
          decision?: Database['public']['Enums']['completion_decision'];
          id?: string;
          match_id?: string;
          mission_id?: string;
          note?: string | null;
          participant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'completion_confirmations_match_mission_fk';
            columns: ['match_id', 'mission_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id', 'mission_id'];
          },
          {
            foreignKeyName: 'completion_confirmations_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_members: {
        Row: {
          archived_at: string | null;
          conversation_id: string;
          joined_at: string;
          last_read_at: string | null;
          profile_id: string;
        };
        Insert: {
          archived_at?: string | null;
          conversation_id: string;
          joined_at?: string;
          last_read_at?: string | null;
          profile_id: string;
        };
        Update: {
          archived_at?: string | null;
          conversation_id?: string;
          joined_at?: string;
          last_read_at?: string | null;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_members_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_members_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          mission_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          mission_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          mission_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_match_mission_fk';
            columns: ['match_id', 'mission_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id', 'mission_id'];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          mission_id: string;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          mission_id: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          mission_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_mission_id_fkey';
            columns: ['mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      matches: {
        Row: {
          accepted_application_id: string;
          cancelled_at: string | null;
          client_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          matched_at: string;
          mission_id: string;
          status: Database['public']['Enums']['match_status'];
          talent_id: string;
          updated_at: string;
        };
        Insert: {
          accepted_application_id: string;
          cancelled_at?: string | null;
          client_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          matched_at?: string;
          mission_id: string;
          status?: Database['public']['Enums']['match_status'];
          talent_id: string;
          updated_at?: string;
        };
        Update: {
          accepted_application_id?: string;
          cancelled_at?: string | null;
          client_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          matched_at?: string;
          mission_id?: string;
          status?: Database['public']['Enums']['match_status'];
          talent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'matches_application_talent_fk';
            columns: ['accepted_application_id', 'mission_id', 'talent_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['id', 'mission_id', 'applicant_id'];
          },
          {
            foreignKeyName: 'matches_mission_client_fk';
            columns: ['mission_id', 'client_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      messages: {
        Row: {
          attachment_mime_type: string | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size_bytes: number | null;
          author_id: string | null;
          body: string;
          client_message_id: string;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
        };
        Insert: {
          attachment_mime_type?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size_bytes?: number | null;
          author_id?: string | null;
          body: string;
          client_message_id?: string;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
        };
        Update: {
          attachment_mime_type?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size_bytes?: number | null;
          author_id?: string | null;
          body?: string;
          client_message_id?: string;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      mission_attachments: {
        Row: {
          created_at: string;
          draft_id: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          mission_id: string | null;
          owner_id: string;
          size_bytes: number;
          storage_path: string;
        };
        Insert: {
          created_at?: string;
          draft_id?: string | null;
          file_name: string;
          id?: string;
          mime_type: string;
          mission_id?: string | null;
          owner_id: string;
          size_bytes: number;
          storage_path: string;
        };
        Update: {
          created_at?: string;
          draft_id?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string;
          mission_id?: string | null;
          owner_id?: string;
          size_bytes?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mission_attachments_draft_owner_fk';
            columns: ['draft_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'mission_drafts';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'mission_attachments_mission_owner_fk';
            columns: ['mission_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'mission_attachments_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      mission_drafts: {
        Row: {
          created_at: string;
          current_step: number;
          id: string;
          owner_id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_step?: number;
          id?: string;
          owner_id: string;
          payload?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_step?: number;
          id?: string;
          owner_id?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mission_drafts_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      mission_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event_type: Database['public']['Enums']['mission_event_type'];
          id: number;
          metadata: Json;
          mission_id: string;
          new_values: Json | null;
          old_values: Json | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event_type: Database['public']['Enums']['mission_event_type'];
          id?: never;
          metadata?: Json;
          mission_id: string;
          new_values?: Json | null;
          old_values?: Json | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event_type?: Database['public']['Enums']['mission_event_type'];
          id?: never;
          metadata?: Json;
          mission_id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mission_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mission_events_mission_id_fkey';
            columns: ['mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
        ];
      };
      mission_private_locations: {
        Row: {
          access_notes: string | null;
          created_at: string;
          exact_address: string | null;
          latitude: number | null;
          longitude: number | null;
          mission_id: string;
          updated_at: string;
        };
        Insert: {
          access_notes?: string | null;
          created_at?: string;
          exact_address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          mission_id: string;
          updated_at?: string;
        };
        Update: {
          access_notes?: string | null;
          created_at?: string;
          exact_address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          mission_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mission_private_locations_mission_id_fkey';
            columns: ['mission_id'];
            isOneToOne: true;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
        ];
      };
      mission_skills: {
        Row: {
          created_at: string;
          importance: number;
          mission_id: string;
          required_level: Database['public']['Enums']['skill_level'];
          skill_id: number;
        };
        Insert: {
          created_at?: string;
          importance?: number;
          mission_id: string;
          required_level: Database['public']['Enums']['skill_level'];
          skill_id: number;
        };
        Update: {
          created_at?: string;
          importance?: number;
          mission_id?: string;
          required_level?: Database['public']['Enums']['skill_level'];
          skill_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'mission_skills_mission_id_fkey';
            columns: ['mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mission_skills_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
        ];
      };
      missions: {
        Row: {
          application_deadline: string | null;
          archived_at: string | null;
          assigned_talent_id: string | null;
          budget_max: number | null;
          budget_min: number | null;
          budget_model: Database['public']['Enums']['budget_model'];
          category: string;
          country_code: string | null;
          created_at: string;
          currency_code: string;
          deleted_at: string | null;
          deliverables: Json;
          description: string;
          ends_on: string | null;
          flexible_schedule: boolean;
          id: string;
          lock_version: number;
          max_applications: number | null;
          moderated_by: string | null;
          moderation_hidden_at: string | null;
          moderation_reason: string | null;
          owner_id: string;
          presence_details: string | null;
          public_city: string | null;
          public_region: string | null;
          required_level: Database['public']['Enums']['skill_level'];
          starts_on: string | null;
          status: Database['public']['Enums']['mission_status'];
          title: string;
          updated_at: string;
          work_mode: Database['public']['Enums']['work_mode'];
        };
        Insert: {
          application_deadline?: string | null;
          archived_at?: string | null;
          assigned_talent_id?: string | null;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_model: Database['public']['Enums']['budget_model'];
          category: string;
          country_code?: string | null;
          created_at?: string;
          currency_code?: string;
          deleted_at?: string | null;
          deliverables?: Json;
          description: string;
          ends_on?: string | null;
          flexible_schedule?: boolean;
          id?: string;
          lock_version?: number;
          max_applications?: number | null;
          moderated_by?: string | null;
          moderation_hidden_at?: string | null;
          moderation_reason?: string | null;
          owner_id: string;
          presence_details?: string | null;
          public_city?: string | null;
          public_region?: string | null;
          required_level?: Database['public']['Enums']['skill_level'];
          starts_on?: string | null;
          status?: Database['public']['Enums']['mission_status'];
          title: string;
          updated_at?: string;
          work_mode: Database['public']['Enums']['work_mode'];
        };
        Update: {
          application_deadline?: string | null;
          archived_at?: string | null;
          assigned_talent_id?: string | null;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_model?: Database['public']['Enums']['budget_model'];
          category?: string;
          country_code?: string | null;
          created_at?: string;
          currency_code?: string;
          deleted_at?: string | null;
          deliverables?: Json;
          description?: string;
          ends_on?: string | null;
          flexible_schedule?: boolean;
          id?: string;
          lock_version?: number;
          max_applications?: number | null;
          moderated_by?: string | null;
          moderation_hidden_at?: string | null;
          moderation_reason?: string | null;
          owner_id?: string;
          presence_details?: string | null;
          public_city?: string | null;
          public_region?: string | null;
          required_level?: Database['public']['Enums']['skill_level'];
          starts_on?: string | null;
          status?: Database['public']['Enums']['mission_status'];
          title?: string;
          updated_at?: string;
          work_mode?: Database['public']['Enums']['work_mode'];
        };
        Relationships: [
          {
            foreignKeyName: 'missions_assigned_talent_id_fkey';
            columns: ['assigned_talent_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'missions_moderated_by_fkey';
            columns: ['moderated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'missions_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      moderation_actions: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          moderator_id: string;
          reason: string;
          report_id: string;
          target_message_id: string | null;
          target_mission_id: string | null;
          target_profile_id: string | null;
          target_type: Database['public']['Enums']['report_target_type'];
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: never;
          moderator_id: string;
          reason: string;
          report_id: string;
          target_message_id?: string | null;
          target_mission_id?: string | null;
          target_profile_id?: string | null;
          target_type: Database['public']['Enums']['report_target_type'];
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: never;
          moderator_id?: string;
          reason?: string;
          report_id?: string;
          target_message_id?: string | null;
          target_mission_id?: string | null;
          target_profile_id?: string | null;
          target_type?: Database['public']['Enums']['report_target_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_actions_moderator_id_fkey';
            columns: ['moderator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_actions_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'reports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_actions_target_message_id_fkey';
            columns: ['target_message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_actions_target_mission_id_fkey';
            columns: ['target_mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_actions_target_profile_id_fkey';
            columns: ['target_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          internal_path: string | null;
          read_at: string | null;
          recipient_id: string;
          source_message_id: string | null;
          source_review_id: string | null;
          title: string;
          type: Database['public']['Enums']['notification_type'];
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          internal_path?: string | null;
          read_at?: string | null;
          recipient_id: string;
          source_message_id?: string | null;
          source_review_id?: string | null;
          title: string;
          type: Database['public']['Enums']['notification_type'];
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          internal_path?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          source_message_id?: string | null;
          source_review_id?: string | null;
          title?: string;
          type?: Database['public']['Enums']['notification_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_source_message_id_fkey';
            columns: ['source_message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_source_review_id_fkey';
            columns: ['source_review_id'];
            isOneToOne: false;
            referencedRelation: 'reviews';
            referencedColumns: ['id'];
          },
        ];
      };
      onboarding_drafts: {
        Row: {
          created_at: string;
          current_step: number;
          payload: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_step?: number;
          payload?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_step?: number;
          payload?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profile_skills: {
        Row: {
          created_at: string;
          declared_level: Database['public']['Enums']['skill_level'];
          profile_id: string;
          skill_id: number;
          updated_at: string;
          years_experience: number | null;
        };
        Insert: {
          created_at?: string;
          declared_level: Database['public']['Enums']['skill_level'];
          profile_id: string;
          skill_id: number;
          updated_at?: string;
          years_experience?: number | null;
        };
        Update: {
          created_at?: string;
          declared_level?: Database['public']['Enums']['skill_level'];
          profile_id?: string;
          skill_id?: number;
          updated_at?: string;
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_skills_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_skills_skill_id_fkey';
            columns: ['skill_id'];
            isOneToOne: false;
            referencedRelation: 'skills';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          adult_confirmed: boolean;
          avatar_path: string | null;
          bio: string | null;
          can_hire: boolean;
          can_work: boolean;
          city: string | null;
          country_code: string | null;
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          headline: string | null;
          id: string;
          onboarding_completed: boolean;
          primary_mode: Database['public']['Enums']['account_mode'];
          remote_available: boolean;
          show_approximate_location: boolean;
          suspended_at: string | null;
          suspended_by: string | null;
          suspension_reason: string | null;
          updated_at: string;
          username: string;
        };
        Insert: {
          adult_confirmed?: boolean;
          avatar_path?: string | null;
          bio?: string | null;
          can_hire?: boolean;
          can_work?: boolean;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          headline?: string | null;
          id: string;
          onboarding_completed?: boolean;
          primary_mode: Database['public']['Enums']['account_mode'];
          remote_available?: boolean;
          show_approximate_location?: boolean;
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          adult_confirmed?: boolean;
          avatar_path?: string | null;
          bio?: string | null;
          can_hire?: boolean;
          can_work?: boolean;
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          headline?: string | null;
          id?: string;
          onboarding_completed?: boolean;
          primary_mode?: Database['public']['Enums']['account_mode'];
          remote_available?: boolean;
          show_approximate_location?: boolean;
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_suspended_by_fkey';
            columns: ['suspended_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          lock_version: number;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['public']['Enums']['moderation_status'];
          target_message_id: string | null;
          target_mission_id: string | null;
          target_profile_id: string | null;
          target_review_id: string | null;
          target_type: Database['public']['Enums']['report_target_type'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          lock_version?: number;
          reason: Database['public']['Enums']['report_reason'];
          reporter_id: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['moderation_status'];
          target_message_id?: string | null;
          target_mission_id?: string | null;
          target_profile_id?: string | null;
          target_review_id?: string | null;
          target_type: Database['public']['Enums']['report_target_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          lock_version?: number;
          reason?: Database['public']['Enums']['report_reason'];
          reporter_id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['moderation_status'];
          target_message_id?: string | null;
          target_mission_id?: string | null;
          target_profile_id?: string | null;
          target_review_id?: string | null;
          target_type?: Database['public']['Enums']['report_target_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_message_id_fkey';
            columns: ['target_message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_mission_id_fkey';
            columns: ['target_mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_profile_id_fkey';
            columns: ['target_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_target_review_id_fkey';
            columns: ['target_review_id'];
            isOneToOne: false;
            referencedRelation: 'reviews';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          author_id: string;
          comment: string | null;
          created_at: string;
          criteria: Json;
          id: string;
          match_id: string;
          mission_id: string;
          rating: number;
          recipient_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          comment?: string | null;
          created_at?: string;
          criteria?: Json;
          id?: string;
          match_id: string;
          mission_id: string;
          rating: number;
          recipient_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          comment?: string | null;
          created_at?: string;
          criteria?: Json;
          id?: string;
          match_id?: string;
          mission_id?: string;
          rating?: number;
          recipient_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_match_mission_fk';
            columns: ['match_id', 'mission_id'];
            isOneToOne: false;
            referencedRelation: 'matches';
            referencedColumns: ['id', 'mission_id'];
          },
          {
            foreignKeyName: 'reviews_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      skills: {
        Row: {
          category: string;
          created_at: string;
          id: number;
          is_active: boolean;
          name: string;
          normalized_name: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: never;
          is_active?: boolean;
          name: string;
          normalized_name?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: never;
          is_active?: boolean;
          name?: string;
          normalized_name?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      swipes: {
        Row: {
          author_id: string;
          created_at: string;
          decision: Database['public']['Enums']['swipe_decision'];
          favorite_created_by_swipe: boolean;
          id: string;
          target_mission_id: string | null;
          target_profile_id: string | null;
          target_type: Database['public']['Enums']['swipe_target_type'];
        };
        Insert: {
          author_id: string;
          created_at?: string;
          decision: Database['public']['Enums']['swipe_decision'];
          favorite_created_by_swipe?: boolean;
          id?: string;
          target_mission_id?: string | null;
          target_profile_id?: string | null;
          target_type: Database['public']['Enums']['swipe_target_type'];
        };
        Update: {
          author_id?: string;
          created_at?: string;
          decision?: Database['public']['Enums']['swipe_decision'];
          favorite_created_by_swipe?: boolean;
          id?: string;
          target_mission_id?: string | null;
          target_profile_id?: string | null;
          target_type?: Database['public']['Enums']['swipe_target_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'swipes_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swipes_target_mission_id_fkey';
            columns: ['target_mission_id'];
            isOneToOne: false;
            referencedRelation: 'missions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'swipes_target_profile_id_fkey';
            columns: ['target_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database['public']['Enums']['user_role'];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database['public']['Enums']['user_role'];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database['public']['Enums']['user_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_application: {
        Args: {
          p_application_id: string;
          p_expected_application_version: number;
          p_expected_mission_version: number;
        };
        Returns: {
          application_lock_version: number;
          application_status: Database['public']['Enums']['application_status'];
          conversation_id: string;
          match_id: string;
          mission_lock_version: number;
          mission_status: Database['public']['Enums']['mission_status'];
        }[];
      };
      add_mission_progress: {
        Args: { p_kind: string; p_match_id: string; p_note: string };
        Returns: {
          created_at: string;
          event_id: number;
        }[];
      };
      archive_mission: {
        Args: { p_expected_version: number; p_mission_id: string };
        Returns: {
          archived_at: string;
          lock_version: number;
          mission_id: string;
        }[];
      };
      cancel_match_mission: {
        Args: {
          p_expected_mission_version: number;
          p_match_id: string;
          p_reason: string;
        };
        Returns: {
          match_id: string;
          match_status: Database['public']['Enums']['match_status'];
          mission_lock_version: number;
          mission_status: Database['public']['Enums']['mission_status'];
        }[];
      };
      complete_match: {
        Args: {
          p_expected_agreement_version: number;
          p_expected_mission_version: number;
          p_match_id: string;
        };
        Returns: {
          agreement_lock_version: number;
          agreement_status: Database['public']['Enums']['agreement_status'];
          match_id: string;
          match_status: Database['public']['Enums']['match_status'];
          mission_lock_version: number;
          mission_status: Database['public']['Enums']['mission_status'];
        }[];
      };
      confirm_agreement: {
        Args: { p_agreement_id: string; p_expected_version: number };
        Returns: {
          agreement_id: string;
          client_confirmed_at: string;
          lock_version: number;
          status: Database['public']['Enums']['agreement_status'];
          talent_confirmed_at: string;
        }[];
      };
      delete_message: { Args: { p_message_id: string }; Returns: string };
      find_or_create_skill: {
        Args: { p_name: string };
        Returns: {
          category: string;
          id: number;
          name: string;
        }[];
      };
      get_account_export: { Args: never; Returns: Json };
      get_application_counts: {
        Args: never;
        Returns: {
          accepted_count: number;
          closed_count: number;
          mission_id: string;
          shortlisted_count: number;
          submitted_count: number;
          total_count: number;
          viewed_count: number;
        }[];
      };
      get_conversation_workspace: {
        Args: { p_conversation_id: string };
        Returns: Json;
      };
      get_dashboard_overview: {
        Args: never;
        Returns: {
          agreements_to_confirm: number;
          can_hire: boolean;
          can_work: boolean;
          client_active_missions: number;
          onboarding_completed: boolean;
          pending_applications: number;
          profile_missing_fields: string[];
          reviews_to_leave: number;
          talent_active_missions: number;
          unread_messages: number;
          upcoming_deadlines: number;
        }[];
      };
      get_dashboard_stats: {
        Args: never;
        Returns: {
          active_applications: number;
          active_matches: number;
          average_rating: number;
          completed_matches: number;
          owned_missions: number;
          review_count: number;
          unread_messages: number;
          unread_notifications: number;
        }[];
      };
      get_match_workspace: { Args: { p_match_id: string }; Returns: Json };
      get_moderation_access: { Args: never; Returns: boolean };
      get_moderation_report: { Args: { p_report_id: string }; Returns: Json };
      get_public_profiles: {
        Args: { p_profile_id?: string };
        Returns: {
          avatar_path: string;
          bio: string;
          can_hire: boolean;
          can_work: boolean;
          city: string;
          country_code: string;
          created_at: string;
          display_name: string;
          email_verified: boolean;
          headline: string;
          id: string;
          primary_mode: Database['public']['Enums']['account_mode'];
          remote_available: boolean;
          username: string;
        }[];
      };
      get_reputation: {
        Args: { p_profile_id: string };
        Returns: {
          average_rating: number;
          completed_matches: number;
          profile_id: string;
          reputation_score: number;
          review_count: number;
        }[];
      };
      get_reputation_summary: {
        Args: { p_profile_id: string };
        Returns: {
          average_rating: number;
          completed_missions: number;
          is_new_profile: boolean;
          profile_id: string;
          rating_1_count: number;
          rating_2_count: number;
          rating_3_count: number;
          rating_4_count: number;
          rating_5_count: number;
          review_count: number;
        }[];
      };
      get_unread_counts: {
        Args: never;
        Returns: {
          unread_messages: number;
          unread_notifications: number;
        }[];
      };
      get_weekly_ranking: { Args: { p_limit?: number }; Returns: Json };
      is_username_available: { Args: { p_username: string }; Returns: boolean };
      list_applications: {
        Args: {
          p_application_id?: string;
          p_mission_id?: string;
          p_page?: number;
          p_page_size?: number;
          p_query?: string;
          p_scope: string;
          p_sort?: string;
          p_statuses?: Database['public']['Enums']['application_status'][];
        };
        Returns: {
          applicant_avatar_path: string;
          applicant_bio: string;
          applicant_city: string;
          applicant_completed_count: number;
          applicant_country_code: string;
          applicant_display_name: string;
          applicant_email_verified: boolean;
          applicant_experience_years: number;
          applicant_headline: string;
          applicant_id: string;
          applicant_remote_available: boolean;
          applicant_reputation: number;
          applicant_review_count: number;
          applicant_skills: Json;
          applicant_username: string;
          application_id: string;
          application_status: Database['public']['Enums']['application_status'];
          availability_note: string;
          conversation_id: string;
          created_at: string;
          lock_version: number;
          message: string;
          mission_budget_max: number;
          mission_budget_min: number;
          mission_budget_model: Database['public']['Enums']['budget_model'];
          mission_country_code: string;
          mission_ends_on: string;
          mission_id: string;
          mission_public_city: string;
          mission_public_region: string;
          mission_starts_on: string;
          mission_status: Database['public']['Enums']['mission_status'];
          mission_title: string;
          mission_work_mode: Database['public']['Enums']['work_mode'];
          owner_avatar_path: string;
          owner_display_name: string;
          owner_email_verified: boolean;
          owner_headline: string;
          owner_id: string;
          owner_username: string;
          proposed_amount: number;
          proposed_currency_code: string;
          relevance_details: Json;
          relevance_score: number;
          score_version: string;
          swipe_decision: Database['public']['Enums']['application_swipe_decision'];
          total_count: number;
          updated_at: string;
        }[];
      };
      list_blocked_profiles: {
        Args: never;
        Returns: {
          avatar_path: string;
          blocked_at: string;
          display_name: string;
          profile_id: string;
          username: string;
        }[];
      };
      list_conversations: {
        Args: {
          p_archived?: boolean;
          p_page?: number;
          p_page_size?: number;
          p_query?: string;
        };
        Returns: {
          archived_at: string;
          conversation_id: string;
          counterpart_avatar_path: string;
          counterpart_display_name: string;
          counterpart_headline: string;
          counterpart_id: string;
          counterpart_username: string;
          last_message_at: string;
          last_message_attachment_name: string;
          last_message_author_id: string;
          last_message_body: string;
          last_message_deleted_at: string;
          last_message_id: string;
          match_id: string;
          match_status: Database['public']['Enums']['match_status'];
          mission_id: string;
          mission_status: Database['public']['Enums']['mission_status'];
          mission_title: string;
          participant_role: string;
          total_count: number;
          unread_count: number;
        }[];
      };
      list_dashboard_deadlines: {
        Args: { p_limit?: number };
        Returns: {
          ends_on: string;
          internal_path: string;
          match_id: string;
          mission_id: string;
          mission_title: string;
          participant_role: string;
        }[];
      };
      list_match_workspaces: {
        Args: never;
        Returns: {
          agreement_id: string;
          agreement_status: Database['public']['Enums']['agreement_status'];
          agreement_version: number;
          conversation_id: string;
          counterpart_avatar_path: string;
          counterpart_display_name: string;
          counterpart_headline: string;
          counterpart_id: string;
          counterpart_username: string;
          match_id: string;
          match_status: Database['public']['Enums']['match_status'];
          matched_at: string;
          mission_id: string;
          mission_lock_version: number;
          mission_status: Database['public']['Enums']['mission_status'];
          mission_title: string;
          participant_role: string;
        }[];
      };
      list_messages: {
        Args: {
          p_before_created_at?: string;
          p_before_id?: string;
          p_conversation_id: string;
          p_page_size?: number;
        };
        Returns: {
          attachment_mime_type: string;
          attachment_name: string;
          attachment_path: string;
          attachment_size_bytes: number;
          author_display_name: string;
          author_id: string;
          body: string;
          client_message_id: string;
          created_at: string;
          deleted_at: string;
          edited_at: string;
          message_id: string;
        }[];
      };
      list_moderation_reports: {
        Args: {
          p_page?: number;
          p_page_size?: number;
          p_status?: Database['public']['Enums']['moderation_status'];
        };
        Returns: {
          created_at: string;
          description: string;
          lock_version: number;
          reason: Database['public']['Enums']['report_reason'];
          report_id: string;
          status: Database['public']['Enums']['moderation_status'];
          target_label: string;
          target_type: Database['public']['Enums']['report_target_type'];
          total_count: number;
        }[];
      };
      list_notifications: {
        Args: { p_page?: number; p_page_size?: number };
        Returns: {
          body: string;
          created_at: string;
          internal_path: string;
          notification_id: string;
          read_at: string;
          title: string;
          total_count: number;
          type: Database['public']['Enums']['notification_type'];
        }[];
      };
      list_received_reviews: {
        Args: { p_page?: number; p_page_size?: number; p_profile_id: string };
        Returns: {
          author_display_name: string;
          author_id: string;
          author_username: string;
          comment: string;
          created_at: string;
          criteria: Json;
          match_id: string;
          mission_id: string;
          mission_title: string;
          rating: number;
          review_id: string;
          total_count: number;
        }[];
      };
      list_review_opportunities: {
        Args: never;
        Returns: {
          completed_at: string;
          counterpart_avatar_path: string;
          counterpart_display_name: string;
          counterpart_has_reviewed: boolean;
          counterpart_id: string;
          counterpart_username: string;
          match_id: string;
          mission_id: string;
          mission_title: string;
          own_rating: number;
          own_review_created_at: string;
          own_review_id: string;
          participant_role: string;
        }[];
      };
      mark_all_notifications_read: { Args: never; Returns: number };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: string;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: string;
      };
      moderate_report: {
        Args: {
          p_action: string;
          p_expected_version: number;
          p_reason: string;
          p_report_id: string;
        };
        Returns: {
          lock_version: number;
          report_id: string;
          status: Database['public']['Enums']['moderation_status'];
        }[];
      };
      record_application_swipe: {
        Args: {
          p_application_id: string;
          p_decision: Database['public']['Enums']['application_swipe_decision'];
          p_expected_version: number;
        };
        Returns: {
          application_lock_version: number;
          application_status: Database['public']['Enums']['application_status'];
          application_swipe_id: string;
          decision: Database['public']['Enums']['application_swipe_decision'];
          undo_available: boolean;
        }[];
      };
      record_mission_swipe: {
        Args: {
          p_decision: Database['public']['Enums']['swipe_decision'];
          p_mission_id: string;
        };
        Returns: {
          decided_at: string;
          decision: Database['public']['Enums']['swipe_decision'];
          swipe_id: string;
        }[];
      };
      report_conversation_participant: {
        Args: {
          p_conversation_id: string;
          p_description: string;
          p_reason: Database['public']['Enums']['report_reason'];
        };
        Returns: string;
      };
      request_account_deletion: {
        Args: { p_confirmation: string; p_reason?: string };
        Returns: {
          request_id: string;
          requested_at: string;
          status: string;
        }[];
      };
      save_mission: {
        Args: {
          p_application_deadline: string;
          p_budget_max: number;
          p_budget_min: number;
          p_budget_model: Database['public']['Enums']['budget_model'];
          p_category: string;
          p_country_code: string;
          p_deliverables: Json;
          p_description: string;
          p_ends_on: string;
          p_expected_version: number;
          p_flexible_schedule: boolean;
          p_mission_id: string;
          p_presence_details: string;
          p_public_city: string;
          p_public_region: string;
          p_publish: boolean;
          p_required_level: Database['public']['Enums']['skill_level'];
          p_skill_ids: number[];
          p_skill_levels: Database['public']['Enums']['skill_level'][];
          p_starts_on: string;
          p_title: string;
          p_wizard_draft_id: string;
          p_work_mode: Database['public']['Enums']['work_mode'];
        };
        Returns: {
          lock_version: number;
          mission_id: string;
          status: Database['public']['Enums']['mission_status'];
        }[];
      };
      save_profile: {
        Args: {
          p_adult_confirmed: boolean;
          p_availability_end: string;
          p_availability_start: string;
          p_availability_timezone: string;
          p_availability_visibility: Database['public']['Enums']['availability_visibility'];
          p_avatar_path: string;
          p_bio: string;
          p_capability: string;
          p_city: string;
          p_complete_onboarding: boolean;
          p_country_code: string;
          p_display_name: string;
          p_headline: string;
          p_profile_id: string;
          p_show_approximate_location: boolean;
          p_skill_ids: number[];
          p_skill_levels: Database['public']['Enums']['skill_level'][];
          p_username: string;
          p_work_preference: string;
        };
        Returns: {
          onboarding_completed: boolean;
          profile_id: string;
        }[];
      };
      search_missions: {
        Args: {
          p_budget_max: number;
          p_budget_min: number;
          p_category: string;
          p_city: string;
          p_ends_after: string;
          p_favorites_only: boolean;
          p_mission_id: string;
          p_page: number;
          p_page_size: number;
          p_query: string;
          p_required_levels: Database['public']['Enums']['skill_level'][];
          p_skill_ids: number[];
          p_sort: string;
          p_starts_before: string;
          p_work_modes: Database['public']['Enums']['work_mode'][];
        };
        Returns: {
          application_count: number;
          application_deadline: string;
          budget_max: number;
          budget_min: number;
          budget_model: Database['public']['Enums']['budget_model'];
          category: string;
          country_code: string;
          created_at: string;
          currency_code: string;
          deliverables: Json;
          description: string;
          ends_on: string;
          flexible_schedule: boolean;
          is_favorite: boolean;
          mission_id: string;
          owner_avatar_path: string;
          owner_display_name: string;
          owner_email_verified: boolean;
          owner_headline: string;
          owner_id: string;
          owner_username: string;
          presence_details: string;
          public_city: string;
          public_region: string;
          required_level: Database['public']['Enums']['skill_level'];
          skills: Json;
          starts_on: string;
          status: Database['public']['Enums']['mission_status'];
          title: string;
          total_count: number;
          updated_at: string;
          work_mode: Database['public']['Enums']['work_mode'];
        }[];
      };
      send_message: {
        Args: {
          p_attachment_mime_type?: string;
          p_attachment_name?: string;
          p_attachment_path?: string;
          p_attachment_size_bytes?: number;
          p_body: string;
          p_client_message_id: string;
          p_conversation_id: string;
        };
        Returns: {
          attachment_mime_type: string;
          attachment_name: string;
          attachment_path: string;
          attachment_size_bytes: number;
          author_id: string;
          body: string;
          client_message_id: string;
          created_at: string;
          deleted_at: string;
          message_id: string;
        }[];
      };
      set_conversation_archived: {
        Args: { p_archived: boolean; p_conversation_id: string };
        Returns: string;
      };
      set_conversation_block: {
        Args: { p_blocked: boolean; p_conversation_id: string };
        Returns: boolean;
      };
      set_profile_block: {
        Args: { p_blocked: boolean; p_profile_id: string };
        Returns: boolean;
      };
      start_match: {
        Args: {
          p_expected_agreement_version: number;
          p_expected_mission_version: number;
          p_match_id: string;
        };
        Returns: {
          agreement_lock_version: number;
          agreement_status: Database['public']['Enums']['agreement_status'];
          match_id: string;
          mission_lock_version: number;
          mission_status: Database['public']['Enums']['mission_status'];
        }[];
      };
      submit_application: {
        Args: {
          p_availability_note: string;
          p_confirmed: boolean;
          p_message: string;
          p_mission_id: string;
          p_proposed_amount?: number;
        };
        Returns: {
          application_id: string;
          lock_version: number;
          relevance_details: Json;
          relevance_score: number;
          score_version: string;
          status: Database['public']['Enums']['application_status'];
        }[];
      };
      submit_completion_confirmation: {
        Args: {
          p_decision: Database['public']['Enums']['completion_decision'];
          p_match_id: string;
          p_note?: string;
        };
        Returns: {
          confirmation_id: string;
          created_at: string;
          decision: Database['public']['Enums']['completion_decision'];
        }[];
      };
      submit_report: {
        Args: {
          p_confirmed: boolean;
          p_description: string;
          p_reason: Database['public']['Enums']['report_reason'];
          p_target_id: string;
          p_target_type: Database['public']['Enums']['report_target_type'];
        };
        Returns: string;
      };
      submit_review: {
        Args: {
          p_comment: string;
          p_communication: number;
          p_match_id: string;
          p_quality: number;
          p_rating: number;
          p_reliability: number;
        };
        Returns: {
          created_at: string;
          recipient_id: string;
          review_id: string;
        }[];
      };
      transition_agreement: {
        Args: {
          p_agreement_id: string;
          p_expected_version: number;
          p_new_status: Database['public']['Enums']['agreement_status'];
        };
        Returns: {
          agreement_id: string;
          lock_version: number;
          status: Database['public']['Enums']['agreement_status'];
        }[];
      };
      transition_application: {
        Args: {
          p_application_id: string;
          p_expected_version: number;
          p_new_status: Database['public']['Enums']['application_status'];
        };
        Returns: {
          application_id: string;
          lock_version: number;
          status: Database['public']['Enums']['application_status'];
        }[];
      };
      transition_mission: {
        Args: {
          p_expected_version: number;
          p_mission_id: string;
          p_new_status: Database['public']['Enums']['mission_status'];
        };
        Returns: {
          lock_version: number;
          mission_id: string;
          status: Database['public']['Enums']['mission_status'];
        }[];
      };
      undo_last_application_swipe: {
        Args: never;
        Returns: {
          application_id: string;
          decision: Database['public']['Enums']['application_swipe_decision'];
        }[];
      };
      undo_last_mission_swipe: {
        Args: never;
        Returns: {
          decision: Database['public']['Enums']['swipe_decision'];
          mission_id: string;
        }[];
      };
    };
    Enums: {
      account_mode: 'talent' | 'client';
      agreement_status:
        | 'draft'
        | 'client_confirmed'
        | 'talent_confirmed'
        | 'confirmed'
        | 'active'
        | 'completed';
      application_status:
        | 'submitted'
        | 'viewed'
        | 'shortlisted'
        | 'accepted'
        | 'rejected'
        | 'withdrawn';
      application_swipe_decision: 'pass' | 'compare' | 'shortlist';
      availability_kind: 'one_time' | 'recurring';
      availability_visibility: 'private' | 'matched' | 'public';
      budget_model: 'fixed' | 'hourly';
      completion_decision: 'confirmed' | 'disputed';
      match_status: 'active' | 'completed' | 'cancelled';
      mission_event_type:
        | 'mission_created'
        | 'mission_published'
        | 'selection_started'
        | 'talent_assigned'
        | 'work_started'
        | 'progress_updated'
        | 'delivery_submitted'
        | 'mission_completed'
        | 'mission_cancelled'
        | 'agreement_updated'
        | 'completion_confirmed'
        | 'completion_disputed'
        | 'moderation_updated';
      mission_status:
        | 'draft'
        | 'published'
        | 'selecting'
        | 'assigned'
        | 'in_progress'
        | 'completed'
        | 'cancelled';
      moderation_status: 'submitted' | 'triaged' | 'actioned' | 'dismissed';
      notification_type:
        | 'application_received'
        | 'application_status_changed'
        | 'match_created'
        | 'agreement_updated'
        | 'new_message'
        | 'mission_status_changed'
        | 'review_received'
        | 'moderation_updated';
      report_reason:
        | 'harassment'
        | 'spam'
        | 'illegal_activity'
        | 'dangerous_activity'
        | 'sensitive_data'
        | 'impersonation'
        | 'other'
        | 'fraud'
        | 'discrimination'
        | 'abuse';
      report_target_type: 'profile' | 'mission' | 'message' | 'review';
      skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      swipe_decision: 'pass' | 'save' | 'interested';
      swipe_target_type: 'profile' | 'mission';
      user_role: 'admin' | 'moderator';
      work_mode: 'local' | 'remote' | 'hybrid';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {
      account_mode: ['talent', 'client'],
      agreement_status: [
        'draft',
        'client_confirmed',
        'talent_confirmed',
        'confirmed',
        'active',
        'completed',
      ],
      application_status: [
        'submitted',
        'viewed',
        'shortlisted',
        'accepted',
        'rejected',
        'withdrawn',
      ],
      application_swipe_decision: ['pass', 'compare', 'shortlist'],
      availability_kind: ['one_time', 'recurring'],
      availability_visibility: ['private', 'matched', 'public'],
      budget_model: ['fixed', 'hourly'],
      completion_decision: ['confirmed', 'disputed'],
      match_status: ['active', 'completed', 'cancelled'],
      mission_event_type: [
        'mission_created',
        'mission_published',
        'selection_started',
        'talent_assigned',
        'work_started',
        'progress_updated',
        'delivery_submitted',
        'mission_completed',
        'mission_cancelled',
        'agreement_updated',
        'completion_confirmed',
        'completion_disputed',
        'moderation_updated',
      ],
      mission_status: [
        'draft',
        'published',
        'selecting',
        'assigned',
        'in_progress',
        'completed',
        'cancelled',
      ],
      moderation_status: ['submitted', 'triaged', 'actioned', 'dismissed'],
      notification_type: [
        'application_received',
        'application_status_changed',
        'match_created',
        'agreement_updated',
        'new_message',
        'mission_status_changed',
        'review_received',
        'moderation_updated',
      ],
      report_reason: [
        'harassment',
        'spam',
        'illegal_activity',
        'dangerous_activity',
        'sensitive_data',
        'impersonation',
        'other',
        'fraud',
        'discrimination',
        'abuse',
      ],
      report_target_type: ['profile', 'mission', 'message', 'review'],
      skill_level: ['beginner', 'intermediate', 'advanced', 'expert'],
      swipe_decision: ['pass', 'save', 'interested'],
      swipe_target_type: ['profile', 'mission'],
      user_role: ['admin', 'moderator'],
      work_mode: ['local', 'remote', 'hybrid'],
    },
  },
} as const;
