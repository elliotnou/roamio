import { callGemini } from "../config/gemini.js";
import { supabaseForUser } from "../config/supabase.js";

const CURATED_ACTIVITY_TYPE = "mindful";
const MIN_ACTIVITIES_PER_DAY = 3;
const MAX_ACTIVITIES_PER_DAY = 4;
const DEFAULT_SLOT_PAIRS = [
  ["09:00", "10:30"],
  ["11:30", "13:00"],
  ["14:30", "16:00"],
  ["17:30", "19:00"],
];

const GOOGLE_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const CLOSED_BUSINESS_STATUSES = new Set(["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"]);

const VIBE_QUERY_TEMPLATES = {
  relaxing: [
    "quiet parks and gardens in {destination}",
    "wellness spa in {destination}",
    "calm tea house cafe in {destination}",
  ],
  adventure: [
    "hiking trail in {destination}",
    "outdoor viewpoint in {destination}",
    "walking tour attraction in {destination}",
  ],
  culture: [
    "museum in {destination}",
    "art gallery in {destination}",
    "historic landmark in {destination}",
  ],
  foodie: [
    "local restaurant in {destination}",
    "food market in {destination}",
    "popular cafe in {destination}",
  ],
};

function getGooglePlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ""
  );
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function normalizeClock(timeValue, fallback = null) {
  if (typeof timeValue !== "string") return fallback;
  const match = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function clockToMinutes(clock) {
  const normalized = normalizeClock(clock, null);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToClock(totalMinutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toBlockTimestamp(baseDate, dayIndex, clock) {
  const normalized = normalizeClock(clock, "09:00");
  const [hours, minutes] = normalized.split(":").map(Number);
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + Number(dayIndex || 0));
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function getTripDayCount(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  const raw = Number.isNaN(diff) ? 0 : Math.floor(diff / 86400000) + 1;
  return Math.max(1, raw);
}

function mapTypeToActivityType(types = []) {
  const set = new Set((types || []).filter(Boolean));
  if (set.has("restaurant") || set.has("meal_takeaway") || set.has("meal_delivery")) return "restaurant";
  if (set.has("cafe") || set.has("coffee_shop") || set.has("bakery")) return "cafe";
  if (set.has("park")) return "park";
  if (set.has("spa")) return "spa";
  if (set.has("museum")) return "museum";
  if (set.has("art_gallery")) return "gallery";
  if (set.has("tourist_attraction")) return "landmark";
  if (set.has("shopping_mall")) return "shopping";
  if (set.has("market")) return "market";
  if (set.has("hiking_area")) return "hiking";
  return "other";
}

function estimateEnergyForType(types = []) {
  const activityType = mapTypeToActivityType(types);
  switch (activityType) {
    case "spa":
      return 2;
    case "park":
    case "museum":
    case "gallery":
      return 3;
    case "cafe":
    case "restaurant":
    case "market":
      return 4;
    case "landmark":
    case "shopping":
      return 5;
    case "hiking":
      return 6;
    default:
      return 4;
  }
}

function buildVibeQueryPlan(destination, travelVibes = []) {
  const selectedVibes = Array.from(
    new Set((Array.isArray(travelVibes) ? travelVibes : []).filter((v) => VIBE_QUERY_TEMPLATES[v]))
  );
  const activeVibes = selectedVibes.length > 0 ? selectedVibes : ["relaxing", "culture", "foodie"];

  const plan = [];
  for (const vibe of activeVibes) {
    const templates = VIBE_QUERY_TEMPLATES[vibe] || [];
    for (const template of templates) {
      plan.push({
        vibe_hint: vibe,
        query: template.replace("{destination}", destination),
      });
    }
  }
  return plan.slice(0, 8);
}

function toCandidate(place, vibeHint) {
  const placeId = place?.id;
  const placeName = place?.displayName?.text;
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  if (!placeId || !placeName) return null;
  if (CLOSED_BUSINESS_STATUSES.has(place?.businessStatus)) return null;

  return {
    place_id: placeId,
    place_name: placeName,
    address: place?.formattedAddress || "",
    maps_url: place?.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(placeName)}`,
    rating: typeof place?.rating === "number" ? place.rating : null,
    user_rating_count: typeof place?.userRatingCount === "number" ? place.userRatingCount : null,
    types: Array.isArray(place?.types) ? place.types : [],
    resolved_lat: typeof lat === "number" ? lat : null,
    resolved_lng: typeof lng === "number" ? lng : null,
    vibe_hint: vibeHint || "relaxing",
  };
}

async function searchPlacesByText(apiKey, query, vibeHint) {
  try {
    const response = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.businessStatus,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "en",
        maxResultCount: 12,
      }),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      console.warn(`[curation] Places text search failed (${query}): HTTP ${response.status} ${raw.slice(0, 160)}`);
      return [];
    }

    const json = await response.json();
    const places = Array.isArray(json?.places) ? json.places : [];
    return places.map((place) => toCandidate(place, vibeHint)).filter(Boolean);
  } catch (err) {
    console.warn(`[curation] Places text search exception (${query}):`, err?.message || err);
    return [];
  }
}

function dedupeCandidates(candidates) {
  const bestById = new Map();

  for (const candidate of candidates) {
    if (!candidate?.place_id) continue;
    const current = bestById.get(candidate.place_id);
    const currentRating = Number(current?.rating || 0);
    const nextRating = Number(candidate.rating || 0);
    if (!current || nextRating >= currentRating) {
      bestById.set(candidate.place_id, candidate);
    }
  }

  return Array.from(bestById.values()).sort((a, b) => {
    const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return Number(b.user_rating_count || 0) - Number(a.user_rating_count || 0);
  });
}

async function fetchDestinationCandidates(destination, travelVibes) {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) return [];

  const queryPlan = buildVibeQueryPlan(destination, travelVibes);
  if (queryPlan.length === 0) return [];

  const results = await Promise.all(
    queryPlan.map((item) => searchPlacesByText(apiKey, item.query, item.vibe_hint))
  );
  return dedupeCandidates(results.flat()).slice(0, 36);
}

function buildGroundedDescription(candidate, vibeHint) {
  const vibeLabel = vibeHint || candidate.vibe_hint || "relaxing";
  const address = candidate.address ? candidate.address.split(",").slice(0, 2).join(",").trim() : "";
  const ratingPart =
    typeof candidate.rating === "number"
      ? `Rated ${candidate.rating.toFixed(1)}`
      : "Well-regarded locally";
  const areaPart = address ? ` in ${address}` : "";
  const calmPart = `with a ${vibeLabel}-friendly pace for lower stress.`;

  return `${ratingPart}${areaPart}; ${calmPart}`.slice(0, 220);
}

function buildGeminiSchedulePrompt({ trip, candidates, dayCount }) {
  const vibeText =
    Array.isArray(trip.travel_vibes) && trip.travel_vibes.length > 0
      ? trip.travel_vibes.join(", ")
      : "balanced";

  const candidateList = candidates
    .map((candidate) => {
      const type = mapTypeToActivityType(candidate.types);
      const rating =
        typeof candidate.rating === "number" ? candidate.rating.toFixed(1) : "N/A";
      return `- place_id="${candidate.place_id}", name="${candidate.place_name}", vibe="${candidate.vibe_hint}", type="${type}", rating="${rating}", address="${candidate.address}"`;
    })
    .join("\n");

  return `You are curating a full itinerary for an anxious traveller.

IMPORTANT:
- Use only the provided place_ids.
- Build day_index values from 0 to ${dayCount - 1}.
- Pick 3 to 4 activities per day.
- Times must be non-overlapping HH:MM (24-hour), within 08:00-21:30.
- Reflect travel vibes strongly: ${vibeText}.
- Descriptions must stay factual to the place metadata and under 24 words.

Return JSON only:
{
  "days": [
    {
      "day_index": 0,
      "activities": [
        {
          "place_id": "string",
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "description": "short grounded description",
          "energy_cost_estimate": 1
        }
      ]
    }
  ]
}

Destination: ${trip.destination}
Candidates:
${candidateList}`;
}

function buildDeterministicPlan(candidates, trip) {
  const dayCount = getTripDayCount(trip.start_date, trip.end_date);
  const selectedVibes = Array.isArray(trip.travel_vibes) && trip.travel_vibes.length > 0
    ? trip.travel_vibes
    : ["relaxing", "culture", "foodie"];

  const plansByDay = [];
  let cursor = 0;

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const dayActivities = [];
    const dayTarget = Math.min(MAX_ACTIVITIES_PER_DAY, Math.max(MIN_ACTIVITIES_PER_DAY, 3));

    for (let slotIndex = 0; slotIndex < dayTarget; slotIndex += 1) {
      const vibe = selectedVibes[(dayIndex + slotIndex) % selectedVibes.length];
      let pick = null;

      for (let probe = 0; probe < candidates.length; probe += 1) {
        const candidate = candidates[(cursor + probe) % candidates.length];
        if (!candidate) continue;
        if (candidate.vibe_hint === vibe) {
          pick = candidate;
          cursor = (cursor + probe + 1) % candidates.length;
          break;
        }
      }

      if (!pick) {
        pick = candidates[cursor % candidates.length];
        cursor = (cursor + 1) % candidates.length;
      }

      const [start, end] = DEFAULT_SLOT_PAIRS[slotIndex];
      dayActivities.push({
        place_id: pick.place_id,
        start_time: start,
        end_time: end,
        description: "",
        energy_cost_estimate: estimateEnergyForType(pick.types),
      });
    }

    plansByDay.push({ day_index: dayIndex, activities: dayActivities });
  }

  return { days: plansByDay };
}

function normalizePlannedDays(model, candidatesById, trip) {
  const dayCount = getTripDayCount(trip.start_date, trip.end_date);
  const normalizedDays = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const modelDay =
      (Array.isArray(model?.days) ? model.days : []).find((day) => Number(day?.day_index) === dayIndex) ||
      null;
    const rawActivities = Array.isArray(modelDay?.activities) ? modelDay.activities : [];

    const accepted = [];
    const usedPlaceIds = new Set();
    for (let slotIndex = 0; slotIndex < rawActivities.length && accepted.length < MAX_ACTIVITIES_PER_DAY; slotIndex += 1) {
      const item = rawActivities[slotIndex];
      const candidate = candidatesById.get(item?.place_id);
      if (!candidate || usedPlaceIds.has(candidate.place_id)) continue;

      const fallbackSlot = DEFAULT_SLOT_PAIRS[accepted.length] || DEFAULT_SLOT_PAIRS[DEFAULT_SLOT_PAIRS.length - 1];
      let start = normalizeClock(item?.start_time, fallbackSlot[0]);
      let end = normalizeClock(item?.end_time, fallbackSlot[1]);
      const startMinutes = clockToMinutes(start) ?? 9 * 60;
      let endMinutes = clockToMinutes(end) ?? startMinutes + 90;
      if (endMinutes <= startMinutes) {
        endMinutes = startMinutes + 90;
      }
      if (endMinutes > 21 * 60 + 30) {
        endMinutes = 21 * 60 + 30;
      }
      start = minutesToClock(startMinutes);
      end = minutesToClock(endMinutes);

      accepted.push({
        place_id: candidate.place_id,
        start_time: start,
        end_time: end,
        description: buildGroundedDescription(candidate, candidate.vibe_hint),
        energy_cost_estimate: clampNumber(
          item?.energy_cost_estimate,
          1,
          10,
          estimateEnergyForType(candidate.types)
        ),
      });
      usedPlaceIds.add(candidate.place_id);
    }

    normalizedDays.push({ day_index: dayIndex, activities: accepted });
  }

  return normalizedDays;
}

function fillMissingActivities(days, candidates, trip) {
  const selectedVibes = Array.isArray(trip.travel_vibes) && trip.travel_vibes.length > 0
    ? trip.travel_vibes
    : ["relaxing", "culture", "foodie"];

  let cursor = 0;
  for (const day of days) {
    const used = new Set(day.activities.map((item) => item.place_id));
    while (day.activities.length < MIN_ACTIVITIES_PER_DAY && candidates.length > 0) {
      const targetVibe = selectedVibes[(day.day_index + day.activities.length) % selectedVibes.length];
      let pick = null;
      for (let probe = 0; probe < candidates.length; probe += 1) {
        const candidate = candidates[(cursor + probe) % candidates.length];
        if (!candidate || used.has(candidate.place_id)) continue;
        if (candidate.vibe_hint === targetVibe) {
          pick = candidate;
          cursor = (cursor + probe + 1) % candidates.length;
          break;
        }
      }
      if (!pick) {
        for (let probe = 0; probe < candidates.length; probe += 1) {
          const candidate = candidates[(cursor + probe) % candidates.length];
          if (candidate && !used.has(candidate.place_id)) {
            pick = candidate;
            cursor = (cursor + probe + 1) % candidates.length;
            break;
          }
        }
      }
      if (!pick) break;

      const slot = DEFAULT_SLOT_PAIRS[Math.min(day.activities.length, DEFAULT_SLOT_PAIRS.length - 1)];
      day.activities.push({
        place_id: pick.place_id,
        start_time: slot[0],
        end_time: slot[1],
        description: buildGroundedDescription(pick, pick.vibe_hint),
        energy_cost_estimate: estimateEnergyForType(pick.types),
      });
      used.add(pick.place_id);
    }
  }
}

function buildRowsFromDays(days, candidatesById, trip) {
  const rows = [];

  for (const day of days) {
    for (const activity of day.activities) {
      const candidate = candidatesById.get(activity.place_id);
      if (!candidate) continue;

      rows.push({
        trip_id: trip.id,
        day_index: day.day_index,
        place_name: candidate.place_name,
        resolved_place_id: candidate.place_id,
        resolved_place_name: buildGroundedDescription(candidate, candidate.vibe_hint),
        resolved_lat: candidate.resolved_lat,
        resolved_lng: candidate.resolved_lng,
        activity_type: CURATED_ACTIVITY_TYPE,
        energy_cost_estimate: clampNumber(
          activity.energy_cost_estimate,
          1,
          10,
          estimateEnergyForType(candidate.types)
        ),
        start_time: toBlockTimestamp(trip.start_date, day.day_index, activity.start_time),
        end_time: toBlockTimestamp(trip.start_date, day.day_index, activity.end_time),
      });
    }
  }

  return rows;
}

function sortBlocks(blocks) {
  return [...blocks].sort((a, b) => {
    const dayDiff = Number(a.day_index || 0) - Number(b.day_index || 0);
    if (dayDiff !== 0) return dayDiff;
    return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  });
}

export async function curateTripItinerary(user, trip, options = {}) {
  const sb = supabaseForUser(user.token);
  const replaceExisting = !!options.replaceExisting;

  const candidates = await fetchDestinationCandidates(
    trip.destination,
    Array.isArray(trip.travel_vibes) ? trip.travel_vibes : []
  );
  if (candidates.length === 0) {
    throw new Error("No Google Places candidates were found for this destination.");
  }

  const dayCount = getTripDayCount(trip.start_date, trip.end_date);
  let modelPlan;
  try {
    modelPlan = await callGemini(
      buildGeminiSchedulePrompt({
        trip,
        candidates,
        dayCount,
      })
    );
  } catch (err) {
    console.warn("[curation] Gemini schedule failed, using deterministic schedule:", err?.message || err);
    modelPlan = buildDeterministicPlan(candidates, trip);
  }

  const candidatesById = new Map(candidates.map((candidate) => [candidate.place_id, candidate]));
  const normalizedDays = normalizePlannedDays(modelPlan, candidatesById, trip);
  fillMissingActivities(normalizedDays, candidates, trip);

  const rows = buildRowsFromDays(normalizedDays, candidatesById, trip);
  if (rows.length === 0) {
    throw new Error("Could not build a valid itinerary from Google Places results.");
  }

  if (replaceExisting) {
    const { error: deleteError } = await sb
      .from("activity_blocks")
      .delete()
      .eq("trip_id", trip.id);
    if (deleteError) {
      throw new Error(`Failed to clear existing activities: ${deleteError.message}`);
    }
  }

  const { data, error } = await sb
    .from("activity_blocks")
    .insert(rows)
    .select("*");
  if (error) throw new Error(`Failed to save curated itinerary: ${error.message}`);

  return sortBlocks(data || []);
}
