/**
 * Places integration service – Task 3 placeholder.
 *
 * This file is a structured stub for the Google Places integration that
 * Task 3 will implement. It provides a safe contract so the suggestions
 * route works end-to-end without breaking.
 *
 * When Task 3 fills this in, it will:
 * 1. Accept Gemini intent + current coordinates
 * 2. Query Google Places Nearby Search API
 * 3. Filter by open now, rating, walking distance
 * 4. Return normalized candidate objects
 */

/**
 * Fetch nearby wellness-friendly places.
 *
 * @param {object} _intent - Gemini classifier result (needs_rerouting, energy_gap, etc.)
 * @param {number} _lat - current latitude
 * @param {number} _lng - current longitude
 * @param {string} _destination - trip destination string
 * @returns {Promise<object[]>} Array of NearbyPlaceCandidate-shaped objects
 *
 * TODO (Task 3): Replace this with real Google Places Nearby Search.
 */
export async function findNearbyPlaceCandidates(_intent, _lat, _lng, _destination) {
  // Return empty array — the suggestions route handles this gracefully
  // and will tell the client that nearby search is not yet available.
  return [];
}
