/**
 * Check-ins service — Supabase CRUD for check-in records.
 */
import { supabaseForUser } from "../config/supabase.js";

/**
 * Create a new check-in row in Supabase.
 */
export async function createCheckIn(user, payload) {
  const sb = supabaseForUser(user.token);
  const row = {
    activity_block_id: payload.activity_block_id,
    user_id: user.id,
    energy_level: payload.energy_level,
    current_lat: payload.current_lat,
    current_lng: payload.current_lng,
    agent_outcome: payload.agent_outcome || null,
    selected_place_id: payload.selected_place_id || null,
    selected_place_name: payload.selected_place_name || null,
  };

  const { data, error } = await sb
    .from("check_ins")
    .insert([row])
    .select()
    .single();

  if (error) throw new Error(`Failed to create check-in: ${error.message}`);
  return data;
}

/**
 * Update a check-in's agent_outcome and selected place after user picks a suggestion.
 */
export async function updateCheckInOutcome(user, checkInId, outcome) {
  const sb = supabaseForUser(user.token);
  const updates = {
    agent_outcome: outcome.agent_outcome,
  };
  if (outcome.selected_place_id) updates.selected_place_id = outcome.selected_place_id;
  if (outcome.selected_place_name) updates.selected_place_name = outcome.selected_place_name;

  const { data, error } = await sb
    .from("check_ins")
    .update(updates)
    .eq("id", checkInId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update check-in: ${error.message}`);
  return data;
}

/**
 * Fetch all check-ins for a user within a specific trip.
 * Used by the classifier for energy trend context.
 */
export async function getCheckInsForTrip(user, tripId) {
  const sb = supabaseForUser(user.token);

  // Join through activity_blocks to filter by trip_id
  const { data, error } = await sb
    .from("check_ins")
    .select("*, activity_blocks!inner(trip_id)")
    .eq("user_id", user.id)
    .eq("activity_blocks.trip_id", tripId)
    .order("timestamp", { ascending: true });

  if (error) throw new Error(`Failed to fetch check-ins: ${error.message}`);

  // Flatten: remove the nested join object
  return (data || []).map((row) => {
    const { activity_blocks, ...checkIn } = row;
    return checkIn;
  });
}

/**
 * Fetch check-ins for a specific user (all trips).
 */
export async function getAllCheckIns(user) {
  const sb = supabaseForUser(user.token);
  const { data, error } = await sb
    .from("check_ins")
    .select("*")
    .eq("user_id", user.id)
    .order("timestamp", { ascending: false });

  if (error) throw new Error(`Failed to fetch check-ins: ${error.message}`);
  return data || [];
}
