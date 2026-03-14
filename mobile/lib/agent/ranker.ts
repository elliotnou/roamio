/**
 * Alternative Ranker Agent
 *
 * Ranks 3-5 lower-energy alternatives from pre-fetched Google Places candidates.
 * Safety: NEVER invents locations — only place_ids from the candidate list are allowed.
 */

import { callGemini } from '../gemini';
import { buildAlternativeRankerPrompt, buildScheduleSlotPrompt } from './prompts';
import { validateAlternativeRankerOutput, validateScheduleSlotOutput } from './validate';
import type {
  AlternativeRankerInput,
  AlternativeRankerOutput,
  NearbyPlaceCandidate,
  RankedSuggestion,
  ScheduleSlotInput,
  ScheduleSlotOutput,
} from './types';

export type {
  AlternativeRankerInput,
  AlternativeRankerOutput,
  NearbyPlaceCandidate,
  RankedSuggestion,
  ScheduleSlotInput,
  ScheduleSlotOutput,
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

// ─── Schedule Slot Agent ─────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function simpleFallbackSlot(input: ScheduleSlotInput): ScheduleSlotOutput {
  const restGap = input.energy_level <= 3 ? 25 : input.energy_level <= 5 ? 15 : 10;
  const startMin = timeToMinutes(input.current_block_end_time) + restGap;
  const hardLimit = input.next_block_start_time
    ? timeToMinutes(input.next_block_start_time) - 10
    : startMin + input.estimated_duration_minutes;
  const endMin = Math.min(startMin + input.estimated_duration_minutes, hardLimit);

  return {
    start_time: minutesToHHMM(startMin),
    end_time: minutesToHHMM(Math.max(endMin, startMin + 20)),
    reasoning: 'Scheduled automatically based on energy level and available window.',
  };
}

/**
 * Ask Gemini to find the optimal time slot for an alternative activity,
 * given the day's existing schedule and the user's energy level.
 * Falls back to a simple calculation if Gemini fails.
 */
export async function scheduleAlternative(
  input: ScheduleSlotInput
): Promise<ScheduleSlotOutput> {
  try {
    const prompt = buildScheduleSlotPrompt(input);
    const raw = await callGemini<unknown>(prompt);
    return validateScheduleSlotOutput(raw);
  } catch (err) {
    console.warn('[scheduleAlternative] Gemini failed, using simple fallback:', err);
    return simpleFallbackSlot(input);
  }
}
