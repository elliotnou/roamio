// ─── Shared Types for Task 2: Gemini AI Logic Layer ───

/** Broad category of activity for energy matching */
export type ActivityType =
  | "hiking"
  | "walking_tour"
  | "museum"
  | "shopping"
  | "dining"
  | "nightlife"
  | "spa_wellness"
  | "beach"
  | "park"
  | "sightseeing"
  | "adventure_sport"
  | "cultural_event"
  | "water_activity"
  | "cycling"
  | "relaxation"
  | "other";

// ─── Gemini Client ───

export interface GeminiConfig {
  apiKey: string;
  /** Defaults to "gemini-2.0-flash" */
  model?: string;
  /** Optional base URL override */
  baseUrl?: string;
}

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
  activity_type: ActivityType;
  /** Estimated energy cost 1-10 */
  energy_cost_estimate: number;
}

// ─── Intent Classifier ───

export interface ActivityBlock {
  id: string;
  place_name: string;
  resolved_place_id: string | null;
  start_time: string; // ISO-8601
  end_time: string;   // ISO-8601
}

export interface PriorCheckIn {
  activity_block_id: string;
  energy_level: number; // 1-10
  timestamp: string;    // ISO-8601
}

export interface IntentClassifierInput {
  /** User's current self-reported energy 1-10 */
  energy_level: number;
  /** ISO-8601 current time */
  current_time: string;
  /** The activity block the user is currently in */
  current_block: ActivityBlock;
  /** Remaining scheduled blocks for the rest of the day */
  remaining_blocks_today: ActivityBlock[];
  /** All previous check-ins during this trip */
  prior_checkins_this_trip: PriorCheckIn[];
}

export interface IntentClassifierOutput {
  /** true when user should be offered alternative activities */
  needs_rerouting: boolean;
  /**
   * Positive number indicating how much the user's energy
   * falls below what is needed for remaining activities.
   * 0 when energy is sufficient.
   */
  energy_gap: number;
  /** Warm positive message when needs_rerouting is false */
  affirmation_message: string | null;
  /** Short reasoning chain the model produced */
  reasoning: string;
}

// ─── Alternative Ranker ───

export interface NearbyPlaceCandidate {
  place_id: string;
  name: string;
  activity_type: ActivityType;
  /** Estimated energy required 1-10 */
  estimated_energy: number;
  /** Distance in metres from user's current location */
  distance_meters: number;
  /** Google Maps rating (0-5) */
  rating: number | null;
}

export interface RankedSuggestion {
  /** Must reference an existing candidate place_id */
  place_id: string;
  name: string;
  activity_type: ActivityType;
  estimated_energy: number;
  /** 1 = best fit */
  rank: number;
  /** One-line reason why this suits the user right now */
  reason: string;
}

export interface AlternativeRankerInput {
  /** The type of the original planned activity */
  current_activity_type: ActivityType;
  /** User's current energy 1-10 */
  energy_level: number;
  /** Gap from classifier */
  energy_gap: number;
  /** Minutes left in the current activity slot */
  time_remaining_minutes: number;
  /** Trip destination for context */
  destination: string;
  /** Pre-fetched Google Places candidates (from Task 3) */
  candidates: NearbyPlaceCandidate[];
}

export interface AlternativeRankerOutput {
  /** 3-5 ranked suggestions, best first */
  suggestions: RankedSuggestion[];
}

// ─── Errors ───

export class GeminiClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly rawBody?: string
  ) {
    super(message);
    this.name = "GeminiClientError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}
