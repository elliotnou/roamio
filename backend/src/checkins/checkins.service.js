/**
 * Check-ins service placeholder.
 *
 * What this file should do:
 * 1. Insert check_ins rows for authenticated user.
 * 2. Persist optional agent_outcome and selected place metadata.
 * 3. Expose update path when user picks reroute suggestion card.
 * 4. Expose check-in history retrieval for analytics and persona logic.
 */
export class CheckinsServicePlaceholder {}
export async function createCheckIn(userId, payload) {
  return {
    id: "placeholder-checkin",
    user_id: userId,
    activity_block_id: payload?.activity_block_id,
    energy_level: payload?.energy_level,
    current_lat: payload?.current_lat,
    current_lng: payload?.current_lng,
    agent_outcome: payload?.agent_outcome || null,
    selected_place_id: payload?.selected_place_id || null,
    selected_place_name: payload?.selected_place_name || null
  };
}
