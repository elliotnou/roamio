/**
 * Supabase database type definitions.
 * These types mirror the schema defined in backend/schema.sql.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
        };
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          destination: string;
          start_date: string;
          end_date: string;
          travel_vibes: string[] | null;
          destination_image: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          destination: string;
          start_date: string;
          end_date: string;
          travel_vibes?: string[] | null;
          destination_image?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          destination?: string;
          start_date?: string;
          end_date?: string;
          travel_vibes?: string[] | null;
          destination_image?: string | null;
          created_at?: string;
        };
      };
      activity_blocks: {
        Row: {
          id: string;
          trip_id: string;
          day_index: number;
          place_name: string;
          resolved_place_id: string | null;
          resolved_place_name: string | null;
          resolved_lat: number | null;
          resolved_lng: number | null;
          activity_type: string;
          energy_cost_estimate: number | null;
          start_time: string;
          end_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          day_index: number;
          place_name: string;
          resolved_place_id?: string | null;
          resolved_place_name?: string | null;
          resolved_lat?: number | null;
          resolved_lng?: number | null;
          activity_type?: string;
          energy_cost_estimate?: number | null;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          day_index?: number;
          place_name?: string;
          resolved_place_id?: string | null;
          resolved_place_name?: string | null;
          resolved_lat?: number | null;
          resolved_lng?: number | null;
          activity_type?: string;
          energy_cost_estimate?: number | null;
          start_time?: string;
          end_time?: string;
          created_at?: string;
        };
      };
      check_ins: {
        Row: {
          id: string;
          activity_block_id: string;
          user_id: string;
          energy_level: number;
          current_lat: number;
          current_lng: number;
          agent_outcome: 'affirmed' | 'rerouted' | 'dismissed' | null;
          selected_place_id: string | null;
          selected_place_name: string | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          activity_block_id: string;
          user_id: string;
          energy_level: number;
          current_lat: number;
          current_lng: number;
          agent_outcome?: 'affirmed' | 'rerouted' | 'dismissed' | null;
          selected_place_id?: string | null;
          selected_place_name?: string | null;
          timestamp?: string;
        };
        Update: {
          id?: string;
          activity_block_id?: string;
          user_id?: string;
          energy_level?: number;
          current_lat?: number;
          current_lng?: number;
          agent_outcome?: 'affirmed' | 'rerouted' | 'dismissed' | null;
          selected_place_id?: string | null;
          selected_place_name?: string | null;
          timestamp?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
