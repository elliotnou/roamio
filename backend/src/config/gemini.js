/**
 * Gemini AI client configuration.
 *
 * Uses the official @google/generative-ai SDK (already in package.json).
 * Exports:
 *   - callGemini(prompt)     – send a prompt string, get parsed JSON back
 *   - callGeminiRaw(prompt)  – send a prompt string, get raw text back
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("Missing required env var: GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.2,
    topP: 0.8,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",   // force JSON mode
  },
});

/**
 * Send a prompt and parse the response as JSON.
 * @param {string} prompt
 * @returns {Promise<any>} parsed JSON object
 */
export async function callGemini(prompt) {
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini returned an empty response");
  }

  // Strip markdown fences if the model adds them despite JSON mode
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini JSON response: ${err.message}\nRaw: ${text}`
    );
  }
}

/**
 * Send a prompt and return the raw text response (no JSON parsing).
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function callGeminiRaw(prompt) {
  const rawModel = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    generationConfig: { temperature: 0.5, maxOutputTokens: 256 },
  });
  const result = await rawModel.generateContent(prompt);
  return result.response.text();
}

// ─── Prompt builder: Place Resolver ───

const VALID_ACTIVITY_TYPES = [
  "hiking", "walking", "cycling",
  "museum", "gallery", "landmark",
  "restaurant", "cafe",
  "shopping", "market",
  "spa", "park", "beach",
  "other",
];

export function buildPlaceResolverPrompt(placeName, destination) {
  return `You are a travel activity classifier. Given a place name and a trip destination, produce a JSON object with these exact keys:

- "google_places_query": a concise Google Places Text Search query that would find this exact place in the destination area. Include the destination for disambiguation.
- "activity_type": one of these values: ${JSON.stringify(VALID_ACTIVITY_TYPES)}
- "energy_cost_estimate": an integer from 1 (very relaxing, e.g. spa) to 10 (very strenuous, e.g. mountain climbing)

Place name: "${placeName}"
Destination: "${destination}"

Respond ONLY with a valid JSON object.`;
}

// ─── Prompt builder: Intent Classifier ───

export function buildClassifierPrompt({
  energyLevel,
  currentTime,
  currentBlock,
  remainingBlocks,
  priorCheckIns,
}) {
  const remaining = remainingBlocks
    .map((b) => `  - ${b.place_name} (${b.start_time} → ${b.end_time}, energy cost: ${b.energy_cost_estimate || "?"}`)
    .join("\n") || "  (none)";

  const prior = priorCheckIns.length > 0
    ? priorCheckIns
        .map((c) => `  - energy ${c.energy_level}/10 at ${c.timestamp}`)
        .join("\n")
    : "  (none yet)";

  return `You are a wellness-aware travel assistant. A traveller just checked in with their current energy level. Decide whether the remaining itinerary should be adjusted ("rerouted").

Rules:
- If energy_level <= 6, the user likely needs rerouting. Set "needs_rerouting" to true.
- If energy_level >= 7, the user is fine. Set "needs_rerouting" to false.
- "energy_gap" is a positive integer representing how much extra energy the remaining activities require beyond what the user has. Set to 0 if no gap.
- "affirmation_message" should be a short, warm, encouraging message when needs_rerouting is false. Set to null when needs_rerouting is true.
- "reasoning" is a 1–2 sentence explanation of your decision considering energy trends and upcoming activities.

Current energy level: ${energyLevel}/10
Current time: ${currentTime}
Current activity: ${currentBlock.place_name} (${currentBlock.start_time} → ${currentBlock.end_time})

Remaining activities today:
${remaining}

Prior check-ins this trip:
${prior}

Respond ONLY with a valid JSON object with keys: "needs_rerouting" (boolean), "energy_gap" (number), "affirmation_message" (string or null), "reasoning" (string).`;
}

// ─── Prompt builder: Alternative Ranker ───

export function buildRankerPrompt({
  currentActivityType,
  energyLevel,
  energyGap,
  timeRemainingMinutes,
  destination,
  candidates,
}) {
  const candidateList = candidates
    .map(
      (c) =>
        `  - place_id: "${c.place_id}", place_name: "${c.place_name}", activity_type: ${c.activity_type || "other"}, energy: ${c.estimated_energy || "?"}/10, distance_km: ${c.distance_km ?? "?"}, rating: ${c.rating ?? "N/A"}, user_rating_count: ${c.user_rating_count ?? "N/A"}`
    )
    .join("\n");

  return `You are a wellness travel assistant. A traveller with low energy needs alternative activities. Rank 3 to 5 alternatives from the candidate list below.

Rules:
- You MUST only use place_ids that appear in the candidate list. Never invent locations.
- Prefer candidates with lower energy cost that still match the traveller's interests.
- If the original activity type is not "other", suggestions must stay in that same activity type.
- For food-related alternatives, you may use lower user_rating_count as a rough proxy for a calmer venue when other factors are similar.
- Consider distance (closer is better), rating (higher is better), and variety.
- Each suggestion needs: "place_id", "place_name", "activity_type", "estimated_energy", "rank" (1 = best fit), "why_it_fits" (one-line explanation), "energy_cost_label" (one of "very low", "low", "moderate").
- Return between 3 and 5 suggestions ordered by rank.

Traveller context:
- Original activity type: ${currentActivityType}
- Current energy: ${energyLevel}/10
- Energy gap: ${energyGap}
- Time remaining: ${timeRemainingMinutes} minutes
- Trip destination: ${destination}

Available candidates:
${candidateList}

Respond ONLY with a valid JSON object with a single key "suggestions" containing an array of suggestion objects.`;
}
