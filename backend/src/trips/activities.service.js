/**
 * Activities service — activity block CRUD + Gemini place resolution.
 */
import { supabaseForUser } from "../config/supabase.js";
import { callGemini, buildPlaceResolverPrompt } from "../config/gemini.js";

const PLACE_DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";

function mapPlaceTypesToActivityType(types = []) {
  const set = new Set(types.filter(Boolean));
  if (set.has("restaurant") || set.has("meal_takeaway") || set.has("meal_delivery")) return "restaurant";
  if (set.has("cafe") || set.has("coffee_shop") || set.has("bakery")) return "cafe";
  if (set.has("park")) return "park";
  if (set.has("spa")) return "spa";
  if (set.has("museum")) return "museum";
  if (set.has("art_gallery")) return "gallery";
  if (set.has("tourist_attraction")) return "landmark";
  if (set.has("shopping_mall")) return "shopping";
  if (set.has("beach")) return "beach";
  if (set.has("hiking_area")) return "hiking";
  return "other";
}

async function fetchGooglePlaceType(placeId) {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || !placeId) return null;

  try {
    const response = await fetch(
      `${PLACE_DETAILS_ENDPOINT}/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,primaryType,types",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const place = await response.json();
    const mappedType = mapPlaceTypesToActivityType([
      place?.primaryType,
      ...(Array.isArray(place?.types) ? place.types : []),
    ]);

    return {
      activity_type: mappedType,
      resolved_place_name: place?.displayName?.text || null,
    };
  } catch {
    return null;
  }
}

function toBlockDateTime(baseDate, dayIndex, timeValue) {
  if (!timeValue) return timeValue;
  if (typeof timeValue === "string" && timeValue.includes("T")) {
    return timeValue;
  }

  const [hours = "0", minutes = "0"] = String(timeValue).split(":");
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + Number(dayIndex || 0));
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toISOString();
}

/**
 * Fetch all activity blocks for a trip.
 */
export async function getBlocksForTrip(user, tripId) {
  const sb = supabaseForUser(user.token);
  const { data, error } = await sb
    .from("activity_blocks")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_index")
    .order("start_time");

  if (error) throw new Error(`Failed to fetch blocks: ${error.message}`);
  return data;
}

/**
 * Fetch a single activity block by ID.
 */
export async function getBlockById(user, blockId) {
  const sb = supabaseForUser(user.token);
  const { data, error } = await sb
    .from("activity_blocks")
    .select("*")
    .eq("id", blockId)
    .single();

  if (error) throw new Error(`Failed to fetch activity block: ${error.message}`);
  return data;
}

/**
 * Fetch remaining blocks for a trip on the same day as `afterTime`.
 * Used by the classifier to understand what activities are left today.
 */
export async function getRemainingBlocksToday(user, tripId, afterTime) {
  const sb = supabaseForUser(user.token);

  // Get the day boundary: start and end of the day containing afterTime
  const dayStart = new Date(afterTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(afterTime);
  dayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await sb
    .from("activity_blocks")
    .select("*")
    .eq("trip_id", tripId)
    .gte("start_time", dayStart.toISOString())
    .lte("start_time", dayEnd.toISOString())
    .gt("start_time", new Date(afterTime).toISOString())
    .order("start_time");

  if (error) throw new Error(`Failed to fetch remaining blocks: ${error.message}`);
  return data || [];
}

/**
 * Create an activity block. Runs Gemini place resolver to populate
 * activity_type and energy_cost_estimate from the freeform place_name.
 */
export async function createActivityBlock(user, body, trip) {
  const row = {
    trip_id: body.trip_id,
    day_index: body.day_index,
    place_name: body.place_name,
    start_time: toBlockDateTime(trip.start_date, body.day_index, body.start_time),
    end_time: toBlockDateTime(trip.start_date, body.day_index, body.end_time),
    activity_type: body.activity_type || "other",
    energy_cost_estimate: body.energy_cost_estimate || 5,
    resolved_place_id: body.resolved_place_id || null,
    resolved_place_name: body.resolved_place_name || null,
    resolved_lat: body.resolved_lat || null,
    resolved_lng: body.resolved_lng || null,
  };

  // Prefer Google place-type mapping when a concrete place_id is available.
  if (row.resolved_place_id) {
    const placeType = await fetchGooglePlaceType(row.resolved_place_id);
    if (placeType?.activity_type && placeType.activity_type !== "other") {
      row.activity_type = placeType.activity_type;
    }
    if (placeType?.resolved_place_name && !row.resolved_place_name) {
      row.resolved_place_name = placeType.resolved_place_name;
    }
  }

  // Run Gemini place resolver to enrich the row
  try {
    const prompt = buildPlaceResolverPrompt(body.place_name, trip.destination);
    const resolved = await callGemini(prompt);

    if (resolved?.activity_type && (!row.activity_type || row.activity_type === "other")) {
      row.activity_type = resolved.activity_type;
    }
    if (typeof resolved?.energy_cost_estimate === "number") {
      row.energy_cost_estimate = Math.max(1, Math.min(10, Math.round(resolved.energy_cost_estimate)));
    }
    // Store the Google Places query as resolved_place_name for Task 3 to use later
    if (resolved?.google_places_query && !row.resolved_place_name) {
      row.resolved_place_name = resolved.google_places_query;
    }
  } catch (err) {
    console.warn("Gemini place resolution failed, using defaults:", err.message);
    // Non-fatal — continue with user-supplied or default values
  }

  const sb = supabaseForUser(user.token);
  const { data, error } = await sb
    .from("activity_blocks")
    .insert([row])
    .select()
    .single();

  if (error) throw new Error(`Failed to create activity block: ${error.message}`);
  return data;
}

/**
 * Update resolved place data on an existing activity block.
 * Called after Task 3 performs actual Google Places lookup.
 */
export async function patchBlockResolution(user, blockId, resolution) {
  const sb = supabaseForUser(user.token);
  const updates = {};

  if (resolution.resolved_place_id) updates.resolved_place_id = resolution.resolved_place_id;
  if (resolution.resolved_place_name) updates.resolved_place_name = resolution.resolved_place_name;
  if (resolution.resolved_lat != null) updates.resolved_lat = resolution.resolved_lat;
  if (resolution.resolved_lng != null) updates.resolved_lng = resolution.resolved_lng;

  if (Object.keys(updates).length === 0) return null;

  const { data, error } = await sb
    .from("activity_blocks")
    .update(updates)
    .eq("id", blockId)
    .select()
    .single();

  if (error) throw new Error(`Failed to patch block: ${error.message}`);
  return data;
}
