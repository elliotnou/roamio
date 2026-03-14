/**
 * Prompt builders for Gemini agent calls.
 * Migrated and adapted from _task2_ai/prompts.ts.
 */

import type {
  AgentActivityType,
  PlaceResolverInput,
  IntentClassifierInput,
  AlternativeRankerInput,
  ScheduleSlotInput,
} from './types';

const ACTIVITY_TYPES: AgentActivityType[] = [
  'hiking', 'walking_tour', 'museum', 'shopping', 'dining',
  'nightlife', 'spa_wellness', 'beach', 'park', 'sightseeing',
  'adventure_sport', 'cultural_event', 'water_activity', 'cycling',
  'relaxation', 'other',
];

// ─── Place Resolver Prompt ───

export function buildPlaceResolverPrompt(input: PlaceResolverInput): string {
  return `You are a travel activity classifier. Given a place name and a trip destination, produce a JSON object with these exact keys:

- "google_places_query": a concise Google Places Text Search query string that would find this exact place in the destination region. Include the destination in the query for disambiguation.
- "activity_type": one of the following values: ${JSON.stringify(ACTIVITY_TYPES)}
- "energy_cost_estimate": an integer from 1 (very relaxing, e.g. spa) to 10 (very strenuous, e.g. mountain climbing)

Place name: "${input.place_name}"
Destination: "${input.destination}"

Respond ONLY with a valid JSON object, no markdown fences, no extra text.`;
}

// ─── Intent Classifier Prompt ───

export function buildIntentClassifierPrompt(input: IntentClassifierInput): string {
  const remainingBlocksSummary = input.remaining_blocks_today
    .map((b) => `  - ${b.place_name} (${b.start_time} → ${b.end_time})`)
    .join('\n');

  const priorCheckinsSummary =
    input.prior_checkins_this_trip.length > 0
      ? input.prior_checkins_this_trip
          .map((c) => `  - energy ${c.energy_level}/10 at ${c.timestamp}`)
          .join('\n')
      : '  (none yet)';

  return `You are a wellness-aware travel assistant. A traveller just checked in with their current energy level. Decide whether the remaining itinerary should be adjusted ("rerouted").

Rules:
- If energy_level <= 6, the user likely needs rerouting. Set "needs_rerouting" to true.
- If energy_level >= 7, the user is fine. Set "needs_rerouting" to false.
- "energy_gap" is a positive integer representing how much extra energy the remaining activities require beyond what the user has. Set to 0 if no gap.
- "affirmation_message" should be a short, warm, encouraging message when needs_rerouting is false. Set to null when needs_rerouting is true.
- "reasoning" is a 1-2 sentence explanation of your decision considering energy trends and upcoming activities.

Current energy level: ${input.energy_level}/10
Current time: ${input.current_time}
Current activity: ${input.current_block.place_name} (${input.current_block.start_time} → ${input.current_block.end_time})

Remaining activities today:
${remainingBlocksSummary || '  (none)'}

Prior check-ins this trip:
${priorCheckinsSummary}

Respond ONLY with a valid JSON object with keys: "needs_rerouting" (boolean), "energy_gap" (number), "affirmation_message" (string or null), "reasoning" (string). No markdown fences, no extra text.`;
}

// ─── Alternative Ranker Prompt ───

export function buildAlternativeRankerPrompt(input: AlternativeRankerInput): string {
  const candidateList = input.candidates
    .map(
      (c) =>
        `  - place_id: "${c.place_id}", name: "${c.name}", type: ${c.activity_type}, energy: ${c.estimated_energy}/10, distance: ${c.distance_meters}m, rating: ${c.rating ?? 'N/A'}`
    )
    .join('\n');

  const vibesStr = input.travel_vibes.length > 0
    ? input.travel_vibes.join(', ')
    : 'not specified';

  const remainingStr = input.remaining_activities.length > 0
    ? input.remaining_activities
        .map((a) => `  - "${a.place_name}" at ${a.start_time} (energy ${a.energy_cost_estimate}/10)`)
        .join('\n')
    : '  (none — rest of day is free)';

  const windowStr = input.available_window_minutes > 0
    ? `${input.available_window_minutes} minutes`
    : 'unknown';

  return `You are a wellness travel assistant. A traveller feels low-energy and needs gentler alternative activities. Rank 3–5 options from the candidate list that best fit their energy, mood, and available time.

Traveller context:
- Destination: ${input.destination}
- Trip vibes: ${vibesStr}
- Current energy: ${input.energy_level}/10 (gap from ideal: ${input.energy_gap})
- Original activity type: ${input.current_activity_type}
- Available time window: ${windowStr}
- Remaining schedule today:
${remainingStr}

Ranking rules:
- ONLY use place_ids from the candidate list. Never invent locations.
- Prioritise low energy cost (≤ ${Math.min(input.energy_level + 1, 5)}/10 preferred).
- Match the trip vibes: e.g. if vibes include "relaxing", prefer parks/cafes/spas over busy markets.
- If the window is short (< 60 min), prefer nearby, brief activities.
- Each suggestion needs: "place_id", "name", "activity_type", "estimated_energy" (1–10), "rank" (1 = best), "reason" (one sentence mentioning vibe/energy/time fit).
- Return 3–5 suggestions ordered by rank.

Available candidates:
${candidateList}

Respond ONLY with a valid JSON object: {"suggestions": [...]}. No markdown fences, no extra text.`;
}

// ─── Schedule Slot Prompt ───

export function buildScheduleSlotPrompt(input: ScheduleSlotInput): string {
  const scheduleStr = input.day_activities.length > 0
    ? input.day_activities
        .map((a) => `  - "${a.place_name}": ${a.start_time} → ${a.end_time}`)
        .join('\n')
    : '  (no other activities)';

  const windowEnd = input.next_block_start_time
    ? `must end by ${input.next_block_start_time} (next commitment)`
    : 'no hard deadline — rest of day is free';

  const energyNote = input.energy_level <= 3
    ? 'User is very tired — give them a 20–30 minute rest gap before starting.'
    : input.energy_level <= 5
    ? 'User is a bit tired — give them a 10–15 minute buffer before starting.'
    : 'User has decent energy — a 5–10 minute transition gap is enough.';

  return `You are a travel scheduler. Place a new activity into the traveller's day at the optimal time.

Activity: "${input.activity_name}" (estimated ${input.estimated_duration_minutes} minutes)
Earliest start: ${input.current_block_end_time} (previous block just ended)
Window constraint: ${windowEnd}
Energy level: ${input.energy_level}/10 — ${energyNote}

Today's existing schedule:
${scheduleStr}

Rules:
- Start no earlier than ${input.current_block_end_time}.
- Respect the window constraint above.
- Apply the appropriate rest gap based on energy level.
- If the estimated duration doesn't fit, shorten it to fit (minimum 20 minutes).
- Output times in HH:MM 24-hour format.

Respond ONLY with JSON: {"start_time": "HH:MM", "end_time": "HH:MM", "reasoning": "one sentence"}. No markdown fences.`;
}
