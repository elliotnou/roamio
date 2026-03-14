// ─── Test Fixtures & Mock Data ───
// Realistic sample inputs and expected-shaped outputs for integration testing.

import type {
  PlaceResolverInput,
  PlaceResolverOutput,
  IntentClassifierInput,
  IntentClassifierOutput,
  AlternativeRankerInput,
  AlternativeRankerOutput,
  NearbyPlaceCandidate,
} from "./types";

// ─────────────────────────────────────
// 1. Place Resolution – Banff hiking
// ─────────────────────────────────────

export const FIXTURE_PLACE_RESOLVER_INPUT: PlaceResolverInput = {
  place_name: "Johnston Canyon",
  destination: "Banff, Alberta, Canada",
};

export const FIXTURE_PLACE_RESOLVER_OUTPUT: PlaceResolverOutput = {
  google_places_query: "Johnston Canyon trail Banff Alberta Canada",
  activity_type: "hiking",
  energy_cost_estimate: 7,
};

// ─────────────────────────────────────
// 2. Low-energy check-in (reroute)
// ─────────────────────────────────────

export const FIXTURE_CLASSIFIER_LOW_ENERGY_INPUT: IntentClassifierInput = {
  energy_level: 4,
  current_time: "2026-07-15T14:30:00-06:00",
  current_block: {
    id: "blk-001",
    place_name: "Johnston Canyon",
    resolved_place_id: "ChIJ_____johnston_canyon",
    start_time: "2026-07-15T10:00:00-06:00",
    end_time: "2026-07-15T15:00:00-06:00",
  },
  remaining_blocks_today: [
    {
      id: "blk-002",
      place_name: "Sunshine Meadows",
      resolved_place_id: "ChIJ_____sunshine_meadows",
      start_time: "2026-07-15T16:00:00-06:00",
      end_time: "2026-07-15T19:00:00-06:00",
    },
  ],
  prior_checkins_this_trip: [
    {
      activity_block_id: "blk-000",
      energy_level: 7,
      timestamp: "2026-07-14T11:00:00-06:00",
    },
  ],
};

export const FIXTURE_CLASSIFIER_LOW_ENERGY_OUTPUT: IntentClassifierOutput = {
  needs_rerouting: true,
  energy_gap: 3,
  affirmation_message: null,
  reasoning:
    "Energy is 4/10 and the next activity (Sunshine Meadows) is high-energy hiking. The user's energy has dropped significantly since yesterday. Rerouting is recommended.",
};

// ─────────────────────────────────────
// 3. High-energy check-in (affirmation)
// ─────────────────────────────────────

export const FIXTURE_CLASSIFIER_HIGH_ENERGY_INPUT: IntentClassifierInput = {
  energy_level: 8,
  current_time: "2026-07-15T10:30:00-06:00",
  current_block: {
    id: "blk-001",
    place_name: "Banff Upper Hot Springs",
    resolved_place_id: "ChIJ_____hot_springs",
    start_time: "2026-07-15T09:00:00-06:00",
    end_time: "2026-07-15T11:00:00-06:00",
  },
  remaining_blocks_today: [
    {
      id: "blk-002",
      place_name: "Bow Falls",
      resolved_place_id: "ChIJ_____bow_falls",
      start_time: "2026-07-15T12:00:00-06:00",
      end_time: "2026-07-15T13:30:00-06:00",
    },
  ],
  prior_checkins_this_trip: [],
};

export const FIXTURE_CLASSIFIER_HIGH_ENERGY_OUTPUT: IntentClassifierOutput = {
  needs_rerouting: false,
  energy_gap: 0,
  affirmation_message:
    "You're doing great! Enjoy the rest of your day exploring Banff 🌿",
  reasoning:
    "Energy is 8/10 which is well above the threshold. The remaining activities are moderate intensity. No changes needed.",
};

// ─────────────────────────────────────
// 4. Alternative Ranker – nearby options
// ─────────────────────────────────────

export const FIXTURE_RANKER_CANDIDATES: NearbyPlaceCandidate[] = [
  {
    place_id: "ChIJ_____cascade_gardens",
    name: "Cascade Gardens",
    activity_type: "park",
    estimated_energy: 2,
    distance_meters: 800,
    rating: 4.5,
  },
  {
    place_id: "ChIJ_____banff_museum",
    name: "Whyte Museum of the Canadian Rockies",
    activity_type: "museum",
    estimated_energy: 2,
    distance_meters: 1200,
    rating: 4.6,
  },
  {
    place_id: "ChIJ_____bow_river_bench",
    name: "Bow River Benches Trail",
    activity_type: "walking_tour",
    estimated_energy: 3,
    distance_meters: 600,
    rating: 4.3,
  },
  {
    place_id: "ChIJ_____wild_flour_bakery",
    name: "Wild Flour Bakery",
    activity_type: "dining",
    estimated_energy: 1,
    distance_meters: 1500,
    rating: 4.7,
  },
  {
    place_id: "ChIJ_____banff_spa",
    name: "Red Earth Spa",
    activity_type: "spa_wellness",
    estimated_energy: 1,
    distance_meters: 2000,
    rating: 4.4,
  },
];

export const FIXTURE_RANKER_INPUT: AlternativeRankerInput = {
  current_activity_type: "hiking",
  energy_level: 4,
  energy_gap: 3,
  time_remaining_minutes: 90,
  destination: "Banff, Alberta, Canada",
  candidates: FIXTURE_RANKER_CANDIDATES,
};

export const FIXTURE_RANKER_OUTPUT: AlternativeRankerOutput = {
  suggestions: [
    {
      place_id: "ChIJ_____bow_river_bench",
      name: "Bow River Benches Trail",
      activity_type: "walking_tour",
      estimated_energy: 3,
      rank: 1,
      reason: "A gentle riverside walk keeps you outdoors without the steep climb.",
    },
    {
      place_id: "ChIJ_____cascade_gardens",
      name: "Cascade Gardens",
      activity_type: "park",
      estimated_energy: 2,
      rank: 2,
      reason: "Beautiful park right in town — scenic and relaxing.",
    },
    {
      place_id: "ChIJ_____banff_museum",
      name: "Whyte Museum of the Canadian Rockies",
      activity_type: "museum",
      estimated_energy: 2,
      rank: 3,
      reason: "Indoor activity with local history — great for recharging.",
    },
    {
      place_id: "ChIJ_____wild_flour_bakery",
      name: "Wild Flour Bakery",
      activity_type: "dining",
      estimated_energy: 1,
      rank: 4,
      reason: "Grab a snack and sit down to recover energy for later.",
    },
  ],
};
