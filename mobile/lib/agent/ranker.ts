/**
 * Alternative Ranker Agent
 *
 * Ranks 3-5 lower-energy alternatives from pre-fetched Google Places candidates.
 * Safety: NEVER invents locations — only place_ids from the candidate list are allowed.
 */

import { callGemini } from '../gemini';
import { buildAlternativeRankerPrompt } from './prompts';
import { validateAlternativeRankerOutput } from './validate';
import type {
  AlternativeRankerInput,
  AlternativeRankerOutput,
  NearbyPlaceCandidate,
  RankedSuggestion,
} from './types';

export type {
  AlternativeRankerInput,
  AlternativeRankerOutput,
  NearbyPlaceCandidate,
  RankedSuggestion,
};

/**
 * Rank alternatives. If Gemini fails, falls back to distance + energy sort.
 * The validator enforces that ranked suggestions only reference real candidate place_ids.
 */
export async function rankAlternatives(
  input: AlternativeRankerInput
): Promise<AlternativeRankerOutput> {
  if (input.candidates.length === 0) {
    return { suggestions: [] };
  }

  const allowedPlaceIds = new Set(input.candidates.map((c) => c.place_id));

  try {
    const prompt = buildAlternativeRankerPrompt(input);
    const raw = await callGemini<unknown>(prompt);
    return validateAlternativeRankerOutput(raw, allowedPlaceIds);
  } catch (err) {
    console.warn('[rankAlternatives] Gemini failed, using fallback sort:', err);

    // Fallback: sort by energy (ascending) then distance (ascending), take top 5
    const sorted = [...input.candidates]
      .filter((c) => c.estimated_energy <= input.energy_level + 2)
      .sort((a, b) => {
        const energyDiff = a.estimated_energy - b.estimated_energy;
        if (energyDiff !== 0) return energyDiff;
        return a.distance_meters - b.distance_meters;
      })
      .slice(0, 5);

    const fallbackSuggestions: RankedSuggestion[] = sorted.map((c, i) => ({
      place_id: c.place_id,
      name: c.name,
      activity_type: c.activity_type,
      estimated_energy: c.estimated_energy,
      rank: i + 1,
      reason: `Lower energy option nearby (${c.estimated_energy}/10 energy, ${Math.round(c.distance_meters / 100) / 10} km away)`,
    }));

    return { suggestions: fallbackSuggestions };
  }
}
