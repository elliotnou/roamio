/**
 * Prompt builders for Gemini agent calls.
 * Migrated and adapted from _task2_ai/prompts.ts.
 */

import type {
  AgentActivityType,
  PlaceResolverInput,
  IntentClassifierInput,
  AlternativeRankerInput,
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

  return `You are a wellness travel assistant. A traveller with low energy needs alternative activities. Rank 3 to 5 alternatives from the candidate list below.

Rules:
- You MUST only use place_ids that appear in the candidate list. Never invent locations.
- Prefer candidates with lower estimated_energy that still match the traveller's interests.
- Consider distance (closer is better), rating (higher is better), and variety.
- Each suggestion needs: "place_id", "name", "activity_type", "estimated_energy", "rank" (1 = best fit), and "reason" (one-line explanation).
- Return between 3 and 5 suggestions ordered by rank.

Traveller context:
- Original activity type: ${input.current_activity_type}
- Current energy: ${input.energy_level}/10
- Energy gap: ${input.energy_gap}
- Time remaining: ${input.time_remaining_minutes} minutes
- Trip destination: ${input.destination}

Available candidates:
${candidateList}

Respond ONLY with a valid JSON object with a single key "suggestions" containing an array of suggestion objects. No markdown fences, no extra text.`;
}
