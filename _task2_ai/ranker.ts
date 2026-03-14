// ─── Alternative Ranker Module ───

import type {
  GeminiConfig,
  AlternativeRankerInput,
  AlternativeRankerOutput,
} from "./types";
import { callGemini } from "./gemini-client";
import { buildAlternativeRankerPrompt } from "./prompts";
import { validateAlternativeRankerOutput } from "./validate";

/**
 * Rank 3-5 lower-energy alternatives from pre-fetched Google Places candidates.
 *
 * Safety: The ranker NEVER invents locations. It only references place_ids
 * already present in `input.candidates`. The validator enforces this.
 *
 * @example
 * const result = await rankAlternatives(
 *   {
 *     current_activity_type: "hiking",
 *     energy_level: 4,
 *     energy_gap: 3,
 *     time_remaining_minutes: 90,
 *     destination: "Banff, Alberta, Canada",
 *     candidates: [...],
 *   },
 *   { apiKey: "YOUR_KEY" }
 * );
 * // result.suggestions[0].rank === 1  (best fit)
 */
export async function rankAlternatives(
  input: AlternativeRankerInput,
  config: GeminiConfig
): Promise<AlternativeRankerOutput> {
  const prompt = buildAlternativeRankerPrompt(input);
  const raw = await callGemini<unknown>(prompt, config);

  // Build allowed set from actual input candidates
  const allowedPlaceIds = new Set(input.candidates.map((c) => c.place_id));

  return validateAlternativeRankerOutput(raw, allowedPlaceIds);
}
