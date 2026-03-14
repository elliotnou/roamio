/**
 * Gemini intent + ranking service.
 *
 * Integrates the classifier and ranker logic from _task2_ai into the
 * backend service layer, adapted to match the app's field names.
 */
import { callGemini, buildClassifierPrompt, buildRankerPrompt } from "../config/gemini.js";

// ─── Valid activity types (matches mobile/types/index.ts) ───
const VALID_ACTIVITY_TYPES = new Set([
  "hiking", "walking", "cycling",
  "museum", "gallery", "landmark",
  "restaurant", "cafe",
  "shopping", "market",
  "spa", "park", "beach",
  "other",
]);

function normalizeActivityType(activityType) {
  if (!activityType || typeof activityType !== "string") return "other";
  const lowered = activityType.trim().toLowerCase();
  return VALID_ACTIVITY_TYPES.has(lowered) ? lowered : "other";
}

// ─── Classifier ───

/**
 * Classify a check-in to determine if rerouting is needed.
 *
 * @param {object} params
 * @param {number} params.energyLevel - 1-10
 * @param {string} params.currentTime - ISO-8601
 * @param {object} params.currentBlock - current ActivityBlock row
 * @param {object[]} params.remainingBlocks - remaining ActivityBlock rows for today
 * @param {object[]} params.priorCheckIns - prior CheckIn rows for this trip
 *
 * @returns {Promise<{needs_rerouting, energy_gap, affirmation_message, reasoning}>}
 */
export async function classifyCheckIn({
  energyLevel,
  currentTime,
  currentBlock,
  remainingBlocks,
  priorCheckIns,
}) {
  const prompt = buildClassifierPrompt({
    energyLevel,
    currentTime,
    currentBlock,
    remainingBlocks: remainingBlocks || [],
    priorCheckIns: priorCheckIns || [],
  });

  const result = await callGemini(prompt);

  // Validate critical fields
  if (typeof result.needs_rerouting !== "boolean") {
    throw new Error("Gemini classifier: needs_rerouting must be a boolean");
  }
  if (typeof result.energy_gap !== "number" || result.energy_gap < 0) {
    result.energy_gap = 0;
  }
  if (!result.needs_rerouting && typeof result.affirmation_message !== "string") {
    result.affirmation_message = "You're doing great! Enjoy the rest of your trip 🌿";
  }
  if (result.needs_rerouting) {
    result.affirmation_message = null;
  }
  if (typeof result.reasoning !== "string") {
    result.reasoning = "";
  }

  return {
    needs_rerouting: result.needs_rerouting,
    energy_gap: result.energy_gap,
    affirmation_message: result.affirmation_message,
    reasoning: result.reasoning,
  };
}

// ─── Ranker ───

/**
 * Rank 3-5 lower-energy alternatives from candidate places.
 *
 * Safety: validates that all returned place_ids exist in the input candidates.
 *
 * @param {object} params
 * @param {string} params.currentActivityType
 * @param {number} params.energyLevel
 * @param {number} params.energyGap
 * @param {number} params.timeRemainingMinutes
 * @param {string} params.destination
 * @param {object[]} params.candidates - Array of candidate place objects
 *
 * @returns {Promise<{suggestions: ActivitySuggestion[]}>}
 */
export async function rankAlternatives({
  currentActivityType,
  energyLevel,
  energyGap,
  timeRemainingMinutes,
  destination,
  candidates,
}) {
  if (!candidates || candidates.length === 0) {
    return { suggestions: [] };
  }

  const prompt = buildRankerPrompt({
    currentActivityType,
    energyLevel,
    energyGap,
    timeRemainingMinutes,
    destination,
    candidates,
  });

  const result = await callGemini(prompt);

  if (!Array.isArray(result?.suggestions)) {
    throw new Error("Gemini ranker: suggestions must be an array");
  }

  // Build allowed place_id set from input candidates
  const allowedIds = new Set(candidates.map((c) => c.place_id));
  const candidateById = new Map(candidates.map((c) => [c.place_id, c]));
  const normalizedCurrentType = normalizeActivityType(currentActivityType);

  // Validate and normalize each suggestion
  const validated = result.suggestions
    .filter((s) => s && allowedIds.has(s.place_id)) // reject hallucinated IDs
    .filter((s) => {
      if (normalizedCurrentType === "other") return true;
      const candidate = candidateById.get(s.place_id);
      return (candidate?.activity_type || "other") === normalizedCurrentType;
    })
    .slice(0, 5)
    .map((s, i) => {
      const candidate = candidateById.get(s.place_id) || {};
      const estimatedEnergy = typeof s.estimated_energy === "number"
        ? Math.max(1, Math.min(10, Math.round(s.estimated_energy)))
        : typeof candidate.estimated_energy === "number"
          ? Math.max(1, Math.min(10, Math.round(candidate.estimated_energy)))
          : 5;

      return {
        place_id: s.place_id,
        place_name: s.place_name || s.name || candidate.place_name || candidate.name || "",
        activity_type: normalizeActivityType(candidate.activity_type),
        estimated_energy: estimatedEnergy,
        rank: s.rank || i + 1,
        why_it_fits: s.why_it_fits || s.reason || "",
        energy_cost_label: s.energy_cost_label || (
          estimatedEnergy <= 3 ? "very low" : estimatedEnergy <= 5 ? "low" : "moderate"
        ),
        address: candidate.address || "",
        maps_url: candidate.maps_url || "",
        distance_km: typeof candidate.distance_km === "number" ? candidate.distance_km : 0,
        estimated_duration_minutes:
          typeof candidate.estimated_duration_minutes === "number"
            ? candidate.estimated_duration_minutes
            : 0,
        image_url: candidate.image_url || undefined,
      };
    });

  return { suggestions: validated };
}
