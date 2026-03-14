/**
 * Gemini intent service placeholder.
 *
 * What this file should do:
 * 1. Gather remaining same-day activity context.
 * 2. Prompt Gemini for structured intent JSON only.
 * 3. Validate and normalize output schema.
 * 4. Return intent such as rest, food, hydration, or low-walk options.
 */
export class GeminiIntentServicePlaceholder {}
export async function buildIntentFromContext(_userId, payload) {
  // Placeholder deterministic intent structure expected by places layer.
  return {
    type: payload?.energy_level <= 3 ? "rest" : "light_break",
    max_walk_minutes: 5,
    max_energy_cost: 3
  };
}
