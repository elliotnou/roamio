// ─── Place Resolver Module ───

import type { GeminiConfig, PlaceResolverInput, PlaceResolverOutput } from "./types";
import { callGemini } from "./gemini-client";
import { buildPlaceResolverPrompt } from "./prompts";
import { validatePlaceResolverOutput } from "./validate";

/**
 * Resolve a free-form place name into a structured Google Places query,
 * an activity type classification, and an energy cost estimate.
 *
 * @example
 * const result = await resolvePlace(
 *   { place_name: "Johnston Canyon", destination: "Banff, Alberta, Canada" },
 *   { apiKey: "YOUR_KEY" }
 * );
 * // result.google_places_query → "Johnston Canyon trail Banff Alberta Canada"
 * // result.activity_type        → "hiking"
 * // result.energy_cost_estimate → 7
 */
export async function resolvePlace(
  input: PlaceResolverInput,
  config: GeminiConfig
): Promise<PlaceResolverOutput> {
  const prompt = buildPlaceResolverPrompt(input);
  const raw = await callGemini<unknown>(prompt, config);
  return validatePlaceResolverOutput(raw);
}
