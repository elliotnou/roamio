/**
 * Trips service — Supabase CRUD for trip records.
 */
import { supabaseForUser } from "../config/supabase.js";

/**
 * Fetch all trips for the authenticated user, ordered by start_date.
 */
export async function getUserTrips(user) {
  const sb = supabaseForUser(user.token);
  const { data, error } = await sb
    .from("trips")
    .select("*")
    .eq("user_id", user.id)
    .order("start_date", { ascending: true });

  if (error) throw new Error(`Failed to fetch trips: ${error.message}`);
  return data;
}

/**
 * Fetch a single trip by ID (RLS enforces ownership).
 */
export async function getTripById(user, tripId) {
  const sb = supabaseForUser(user.token);
  const { data, error } = await sb
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();

  if (error) throw new Error(`Failed to fetch trip: ${error.message}`);
  return data;
}

/**
 * Create a new trip for the authenticated user.
 * @param {object} user - req.user from auth middleware
 * @param {object} body - { destination, start_date, end_date, travel_vibes?, destination_image? }
 */
export async function createTrip(user, body) {
  const sb = supabaseForUser(user.token);
  const row = {
    user_id: user.id,
    destination: body.destination,
    start_date: body.start_date,
    end_date: body.end_date,
    travel_vibes: body.travel_vibes || [],
    destination_image: body.destination_image || null,
  };

  const { data, error } = await sb.from("trips").insert([row]).select().single();
  if (error) throw new Error(`Failed to create trip: ${error.message}`);
  return data;
}
