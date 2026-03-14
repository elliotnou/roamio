/**
 * Runtime validators for Gemini agent outputs.
 * Migrated from _task2_ai/validate.ts — uses manual assertions (no zod needed here,
 * but zod is available in the project as a bonus layer).
 */

import type {
  AgentActivityType,
  PlaceResolverOutput,
  IntentClassifierOutput,
  AlternativeRankerOutput,
  ScheduleSlotOutput,
} from './types';

const VALID_ACTIVITY_TYPES = new Set<string>([
  'hiking', 'walking_tour', 'museum', 'shopping', 'dining',
  'nightlife', 'spa_wellness', 'beach', 'park', 'sightseeing',
  'adventure_sport', 'cultural_event', 'water_activity', 'cycling',
  'relaxation', 'other',
]);

// ─── Helpers ───

function assertString(val: unknown, field: string): asserts val is string {
  if (typeof val !== 'string' || val.length === 0) {
    throw new Error(`Validation: "${field}" must be a non-empty string`);
  }
}

function assertNumber(
  val: unknown,
  field: string,
  min?: number,
  max?: number
): asserts val is number {
  if (typeof val !== 'number' || Number.isNaN(val)) {
    throw new Error(`Validation: "${field}" must be a number`);
  }
  if (min !== undefined && val < min) {
    throw new Error(`Validation: "${field}" must be >= ${min}`);
  }
  if (max !== undefined && val > max) {
    throw new Error(`Validation: "${field}" must be <= ${max}`);
  }
}

function assertBoolean(val: unknown, field: string): asserts val is boolean {
  if (typeof val !== 'boolean') {
    throw new Error(`Validation: "${field}" must be a boolean`);
  }
}

function assertActivityType(
  val: unknown,
  field: string
): asserts val is AgentActivityType {
  if (!VALID_ACTIVITY_TYPES.has(val as string)) {
    throw new Error(
      `Validation: "${field}" must be a valid AgentActivityType, got "${val}"`
    );
  }
}

// ─── Public Validators ───

export function validatePlaceResolverOutput(data: unknown): PlaceResolverOutput {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Validation: PlaceResolverOutput must be an object');
  }
  const obj = data as Record<string, unknown>;

  assertString(obj.google_places_query, 'google_places_query');
  assertActivityType(obj.activity_type, 'activity_type');
  assertNumber(obj.energy_cost_estimate, 'energy_cost_estimate', 1, 10);

  return {
    google_places_query: obj.google_places_query,
    activity_type: obj.activity_type as AgentActivityType,
    energy_cost_estimate: Math.round(obj.energy_cost_estimate as number),
  };
}

export function validateIntentClassifierOutput(
  data: unknown
): IntentClassifierOutput {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Validation: IntentClassifierOutput must be an object');
  }
  const obj = data as Record<string, unknown>;

  assertBoolean(obj.needs_rerouting, 'needs_rerouting');
  assertNumber(obj.energy_gap, 'energy_gap', 0);
  assertString(obj.reasoning, 'reasoning');

  if (obj.needs_rerouting) {
    // Coerce to null for safety
    obj.affirmation_message = null;
  } else {
    if (typeof obj.affirmation_message !== 'string') {
      throw new Error(
        'Validation: "affirmation_message" must be a string when needs_rerouting is false'
      );
    }
  }

  return {
    needs_rerouting: obj.needs_rerouting as boolean,
    energy_gap: obj.energy_gap as number,
    affirmation_message: (obj.affirmation_message as string | null) ?? null,
    reasoning: obj.reasoning as string,
  };
}

export function validateAlternativeRankerOutput(
  data: unknown,
  allowedPlaceIds: Set<string>
): AlternativeRankerOutput {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Validation: AlternativeRankerOutput must be an object');
  }
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.suggestions)) {
    throw new Error('Validation: "suggestions" must be an array');
  }

  if (obj.suggestions.length < 1) {
    throw new Error('Validation: "suggestions" must contain at least 1 item');
  }

  // Clamp to max 5
  const rawSuggestions = (obj.suggestions as unknown[]).slice(0, 5);

  const validated = rawSuggestions.map((s, i) => {
    if (typeof s !== 'object' || s === null) {
      throw new Error(`Validation: suggestions[${i}] must be an object`);
    }
    const item = s as Record<string, unknown>;

    assertString(item.place_id, `suggestions[${i}].place_id`);
    assertString(item.name, `suggestions[${i}].name`);
    assertActivityType(item.activity_type, `suggestions[${i}].activity_type`);
    assertNumber(item.estimated_energy, `suggestions[${i}].estimated_energy`, 1, 10);
    assertNumber(item.rank, `suggestions[${i}].rank`, 1, 10);
    assertString(item.reason, `suggestions[${i}].reason`);

    // Safety: ensure the model didn't hallucinate a place_id
    if (!allowedPlaceIds.has(item.place_id as string)) {
      throw new Error(
        `Validation: suggestions[${i}].place_id "${item.place_id}" is not in the candidate list — model hallucinated`
      );
    }

    return {
      place_id: item.place_id as string,
      name: item.name as string,
      activity_type: item.activity_type as AgentActivityType,
      estimated_energy: Math.round(item.estimated_energy as number),
      rank: item.rank as number,
      reason: item.reason as string,
    };
  });

  return { suggestions: validated };
}

const HH_MM = /^\d{2}:\d{2}$/;

export function validateScheduleSlotOutput(data: unknown): ScheduleSlotOutput {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Validation: ScheduleSlotOutput must be an object');
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.start_time !== 'string' || !HH_MM.test(obj.start_time)) {
    throw new Error(`Validation: "start_time" must be HH:MM, got "${obj.start_time}"`);
  }
  if (typeof obj.end_time !== 'string' || !HH_MM.test(obj.end_time)) {
    throw new Error(`Validation: "end_time" must be HH:MM, got "${obj.end_time}"`);
  }
  assertString(obj.reasoning, 'reasoning');

  // Sanity: end must be after start
  if (obj.end_time <= obj.start_time) {
    throw new Error(`Validation: end_time "${obj.end_time}" must be after start_time "${obj.start_time}"`);
  }

  return {
    start_time: obj.start_time as string,
    end_time: obj.end_time as string,
    reasoning: obj.reasoning as string,
  };
}
