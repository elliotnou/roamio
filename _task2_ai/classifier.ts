// ─── Intent Classifier Module ───

import type { GeminiConfig, IntentClassifierInput, IntentClassifierOutput } from "./types";
import { callGemini } from "./gemini-client";
import { buildIntentClassifierPrompt } from "./prompts";
import { validateIntentClassifierOutput } from "./validate";

/**
 * Classify a check-in to decide whether the traveller needs rerouting.
 *
 * - energy_level <= 6 → likely needs rerouting
 * - energy_level >= 7 → positive affirmation, no rerouting
 *
 * @example
 * const result = await classifyCheckIn(input, { apiKey: "YOUR_KEY" });
 * if (result.needs_rerouting) {
 *   // hand off to the Alternative Ranker
 * } else {
 *   // show result.affirmation_message
 * }
 */
export async function classifyCheckIn(
  input: IntentClassifierInput,
  config: GeminiConfig
): Promise<IntentClassifierOutput> {
  const prompt = buildIntentClassifierPrompt(input);
  const raw = await callGemini<unknown>(prompt, config);
  return validateIntentClassifierOutput(raw);
}
