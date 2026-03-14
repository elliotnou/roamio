// ─── Lightweight Runtime Validators (no external deps) ───

import { ValidationError, type ActivityType } from "./types";
import type {
  PlaceResolverOutput,
  IntentClassifierOutput,
  AlternativeRankerOutput,
  NearbyPlaceCandidate,
} from "./types";

const VALID_ACTIVITY_TYPES: Set<string> = new Set([
  "hiking", "walking_tour", "museum", "shopping", "dining",
  "nightlife", "spa_wellness", "beach", "park", "sightseeing",
  "adventure_sport", "cultural_event", "water_activity", "cycling",
  "relaxation", "other",
]);

// ─── Helpers ───

function assertString(val: unknown, field: string): asserts val is string {
  if (typeof val !== "string" || val.length === 0) {
    throw new ValidationError(`"${field}" must be a non-empty string`, field);
  }
}

function assertNumber(
  val: unknown,
  field: string,
  min?: number,
  max?: number
): asserts val is number {
  if (typeof val !== "number" || Number.isNaN(val)) {
    throw new ValidationError(`"${field}" must be a number`, field);
  }
  if (min !== undefined && val < min) {
    throw new ValidationError(`"${field}" must be >= ${min}`, field);
  }
  if (max !== undefined && val > max) {
    throw new ValidationError(`"${field}" must be <= ${max}`, field);
  }
}

function assertBoolean(val: unknown, field: string): asserts val is boolean {
  if (typeof val !== "boolean") {
    throw new ValidationError(`"${field}" must be a boolean`, field);
  }
}

function assertActivityType(
  val: unknown,
  field: string
): asserts val is ActivityType {
  if (!VALID_ACTIVITY_TYPES.has(val as string)) {
    throw new ValidationError(
      `"${field}" must be a valid ActivityType, got "${val}"`,
      field
    );
  }
}

// ─── Public Validators ───

export function validatePlaceResolverOutput(
  data: unknown
): PlaceResolverOutput {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("PlaceResolverOutput must be an object");
  }
  const obj = data as Record<string, unknown>;

  assertString(obj.google_places_query, "google_places_query");
  assertActivityType(obj.activity_type, "activity_type");
  assertNumber(obj.energy_cost_estimate, "energy_cost_estimate", 1, 10);

  return {
    google_places_query: obj.google_places_query,
    activity_type: obj.activity_type as ActivityType,
    energy_cost_estimate: Math.round(obj.energy_cost_estimate as number),
  };
}

export function validateIntentClassifierOutput(
  data: unknown
): IntentClassifierOutput {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("IntentClassifierOutput must be an object");
  }
  const obj = data as Record<string, unknown>;

  assertBoolean(obj.needs_rerouting, "needs_rerouting");
  assertNumber(obj.energy_gap, "energy_gap", 0);
  assertString(obj.reasoning, "reasoning");

  // affirmation_message should be null when rerouting, string otherwise
  if (obj.needs_rerouting) {
    if (obj.affirmation_message !== null && obj.affirmation_message !== undefined) {
      // Coerce to null for safety
      obj.affirmation_message = null;
    }
  } else {
    if (typeof obj.affirmation_message !== "string") {
      throw new ValidationError(
        '"affirmation_message" must be a string when needs_rerouting is false',
        "affirmation_message"
      );
    }
  }

  return {
    needs_rerouting: obj.needs_rerouting as boolean,
    energy_gap: obj.energy_gap as number,
    affirmation_message: (obj.affirmation_message as string) ?? null,
    reasoning: obj.reasoning as string,
  };
}

export function validateAlternativeRankerOutput(
  data: unknown,
  allowedPlaceIds: Set<string>
): AlternativeRankerOutput {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("AlternativeRankerOutput must be an object");
  }
  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.suggestions)) {
    throw new ValidationError('"suggestions" must be an array', "suggestions");
  }

  if (obj.suggestions.length < 3 || obj.suggestions.length > 5) {
    throw new ValidationError(
      `"suggestions" must contain 3-5 items, got ${obj.suggestions.length}`,
      "suggestions"
    );
  }

  const validated = (obj.suggestions as unknown[]).map((s, i) => {
    if (typeof s !== "object" || s === null) {
      throw new ValidationError(`suggestions[${i}] must be an object`);
    }
    const item = s as Record<string, unknown>;

    assertString(item.place_id, `suggestions[${i}].place_id`);
    assertString(item.name, `suggestions[${i}].name`);
    assertActivityType(item.activity_type, `suggestions[${i}].activity_type`);
    assertNumber(item.estimated_energy, `suggestions[${i}].estimated_energy`, 1, 10);
    assertNumber(item.rank, `suggestions[${i}].rank`, 1, 5);
    assertString(item.reason, `suggestions[${i}].reason`);

    // Safety: ensure the model didn't hallucinate a place_id
    if (!allowedPlaceIds.has(item.place_id as string)) {
      throw new ValidationError(
        `suggestions[${i}].place_id "${item.place_id}" is not in the candidate list — model may have hallucinated`,
        `suggestions[${i}].place_id`
      );
    }

    return {
      place_id: item.place_id as string,
      name: item.name as string,
      activity_type: item.activity_type as ActivityType,
      estimated_energy: Math.round(item.estimated_energy as number),
      rank: item.rank as number,
      reason: item.reason as string,
    };
  });

  return { suggestions: validated };
}
