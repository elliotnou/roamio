/**
 * Intent Classifier Agent
 *
 * Classifies a check-in to decide whether the traveller needs rerouting.
 * - energy_level <= 6 → needs_rerouting = true → hand off to Alternative Ranker
 * - energy_level >= 7 → needs_rerouting = false → show affirmation_message
 */

import { callGemini } from '../gemini';
import { buildIntentClassifierPrompt } from './prompts';
import { validateIntentClassifierOutput } from './validate';
import type { IntentClassifierInput, IntentClassifierOutput } from './types';

export type { IntentClassifierInput, IntentClassifierOutput };

/**
 * Classify a check-in. If Gemini fails, falls back to simple energy threshold logic.
 */
export async function classifyCheckIn(
  input: IntentClassifierInput
): Promise<IntentClassifierOutput> {
  try {
    const prompt = buildIntentClassifierPrompt(input);
    const raw = await callGemini<unknown>(prompt);
    return validateIntentClassifierOutput(raw);
  } catch (err) {
    console.warn('[classifyCheckIn] Gemini failed, using fallback logic:', err);
    // Fallback: pure energy threshold
    const needsRerouting = input.energy_level <= 6;
    return {
      needs_rerouting: needsRerouting,
      energy_gap: needsRerouting ? Math.max(0, 7 - input.energy_level) : 0,
      affirmation_message: needsRerouting
        ? null
        : `Great energy! Enjoy ${input.current_block.place_name} — you're doing wonderfully.`,
      reasoning: needsRerouting
        ? `Energy level ${input.energy_level}/10 is below the rerouting threshold of 7.`
        : `Energy level ${input.energy_level}/10 is sufficient for the planned activities.`,
    };
  }
}
