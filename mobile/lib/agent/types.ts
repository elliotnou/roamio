/**
 * Shared AI contract types for Roamio agent layer.
 * Merged from _task2_ai/types.ts + mobile/types/index.ts to avoid duplication.
 */

/** Broad category of activity for energy matching */
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

// ─── Place Resolver ───

export interface PlaceResolverInput {
  /** Free-form name the user typed, e.g. "Johnston Canyon" */
  place_name: string;
  /** Trip destination, e.g. "Banff, Alberta, Canada" */
  destination: string;
}

export interface PlaceResolverOutput {
  /** A Google Places Text Search query string */
  google_places_query: string;
  /** Classified activity type */
  activity_type: AgentActivityType;
  /** Estimated energy cost 1-10 */
  energy_cost_estimate: number;
}

// ─── Intent Classifier ───

export interface AgentActivityBlock {
  id: string;
  place_name: string;
  resolved_place_id: string | null;
  start_time: string;
  end_time: string;
}

export interface PriorCheckIn {
  activity_block_id: string;
  energy_level: number;
  timestamp: string;
}

export interface IntentClassifierInput {
  energy_level: number;
  current_time: string;
  current_block: AgentActivityBlock;
  remaining_blocks_today: AgentActivityBlock[];
  prior_checkins_this_trip: PriorCheckIn[];
}

export interface IntentClassifierOutput {
  needs_rerouting: boolean;
  energy_gap: number;
  affirmation_message: string | null;
  reasoning: string;
}

// ─── Alternative Ranker ───

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

export interface AlternativeRankerInput {
  current_activity_type: AgentActivityType;
  energy_level: number;
  energy_gap: number;
  time_remaining_minutes: number;
  destination: string;
  candidates: NearbyPlaceCandidate[];
}

export interface AlternativeRankerOutput {
  suggestions: RankedSuggestion[];
}
