// ─── Core App Types (aligned with backend/schema.sql) ───

/**
 * Activity type values used in the UI (itinerary.tsx type chips).
 * These are the UI-layer activity types.
 */
export type ActivityType =
  | 'hiking' | 'walking' | 'cycling'
  | 'museum' | 'gallery' | 'landmark'
  | 'restaurant' | 'cafe'
  | 'shopping' | 'market'
  | 'spa' | 'park' | 'beach'
  | 'other';

/**
 * Activity type values used by the Gemini agent layer.
 * Re-exported here so UI code can reference them without
 * importing from lib/agent/types directly.
 */
export type AgentActivityType =
  | 'hiking'
  | 'walking_tour'
  | 'museum'
  | 'shopping'
  | 'dining'
  | 'nightlife'
  | 'spa_wellness'
  | 'beach'
  | 'park'
  | 'sightseeing'
  | 'adventure_sport'
  | 'cultural_event'
  | 'water_activity'
  | 'cycling'
  | 'relaxation'
  | 'other';

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travel_vibes?: string[];
  created_at: string;
  destination_image?: string;
}

export interface ActivityBlock {
  id: string;
  trip_id: string;
  day_index: number;
  place_name: string;
  resolved_place_id: string | null;
  resolved_place_name: string | null;
  resolved_lat: number | null;
  resolved_lng: number | null;
  activity_type: ActivityType;
  energy_cost_estimate: number;
  start_time: string;
  end_time: string;
}

export interface CheckIn {
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
}

export interface ActivitySuggestion {
  place_id: string;
  place_name: string;
  address: string;
  maps_url: string;
  energy_cost_label: 'very low' | 'low' | 'moderate';
  why_it_fits: string;
  distance_km: number;
  estimated_duration_minutes: number;
  image_url?: string;
}

// ─── AI Contract Types (re-exported for convenience) ───

export interface NearbyPlaceCandidate {
  place_id: string;
  name: string;
  activity_type: AgentActivityType;
  estimated_energy: number;
  distance_meters: number;
  rating: number | null;
}

export interface RankedSuggestion {
  place_id: string;
  name: string;
  activity_type: AgentActivityType;
  estimated_energy: number;
  rank: number;
  reason: string;
}

export interface IntentClassifierOutput {
  needs_rerouting: boolean;
  energy_gap: number;
  affirmation_message: string | null;
  reasoning: string;
}

export type CommunityNeedCategory =
  | 'food_and_water'
  | 'medication'
  | 'safe_rest'
  | 'mental_health'
  | 'transit_help';

export interface CommunitySupportCategory {
  id: CommunityNeedCategory;
  label: string;
  description: string;
  icon: string;
}

export interface CommunitySupportPlace {
  place_id: string;
  place_name: string;
  address: string;
  maps_url: string;
  distance_km: number;
  rating: number | null;
  user_rating_count: number | null;
  open_now: boolean | null;
  business_status: string | null;
  matched_tags: string[];
}

export interface CommunityFallbackResource {
  name: string;
  type: 'phone' | 'web';
  contact: string;
  description: string;
  url: string;
}
