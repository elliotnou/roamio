/**
 * Google Places candidate fetch for low-energy alternatives.
 *
 * Returns candidates normalized for rankAlternatives().
 * If no key is configured or the API request fails, returns [] gracefully.
 */

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const MAX_RESULTS = 20;
const DEFAULT_RADIUS_METERS = 3000;

/**
 * Map Google place type strings to the app's activity types.
 */
function mapTypeToActivityType(types = []) {
  const set = new Set(types);
  if (set.has("park")) return "park";
  if (set.has("spa")) return "spa";
  if (set.has("museum")) return "museum";
  if (set.has("art_gallery")) return "gallery";
  if (set.has("tourist_attraction")) return "landmark";
  if (set.has("cafe")) return "cafe";
  if (set.has("restaurant")) return "restaurant";
  if (set.has("shopping_mall")) return "shopping";
  return "other";
}

/**
 * Cheap heuristic used only for ranking context. 1 = lowest energy, 10 = highest.
 */
function estimateEnergyForType(activityType) {
  switch (activityType) {
    case "spa":
      return 2;
    case "park":
    case "museum":
    case "gallery":
      return 3;
    case "cafe":
    case "restaurant":
      return 4;
    case "landmark":
    case "shopping":
      return 5;
    default:
      return 4;
  }
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

/**
 * Fetch nearby wellness-friendly places.
 *
 * @param {object} intent - Gemini classifier result (needs_rerouting, energy_gap, etc.)
 * @param {number} lat - current latitude
 * @param {number} lng - current longitude
 * @param {string} _destination - trip destination string (unused but kept for API compatibility)
 * @returns {Promise<object[]>}
 */
export async function findNearbyPlaceCandidates(intent, lat, lng, _destination) {
  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn("[places] Missing Google Places key. Returning empty candidates.");
    return [];
  }

  if (lat == null || lng == null) {
    return [];
  }

  // Lower energy gap -> keep suggestions closer.
  const gap = Math.max(0, Number(intent?.energy_gap || 0));
  const radius = gap >= 3 ? 2500 : DEFAULT_RADIUS_METERS;

  const body = {
    includedTypes: ["park", "museum", "spa", "cafe", "tourist_attraction", "art_gallery"],
    maxResultCount: MAX_RESULTS,
    locationRestriction: {
      circle: {
        center: { latitude: Number(lat), longitude: Number(lng) },
        radius,
      },
    },
  };

  try {
    const response = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri,places.types",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      console.warn(`[places] Nearby search failed (${response.status}): ${raw.slice(0, 200)}`);
      return [];
    }

    const json = await response.json();
    const places = Array.isArray(json?.places) ? json.places : [];

    const candidates = places
      .map((place) => {
        const placeId = place?.id;
        const placeName = place?.displayName?.text;
        const placeLat = place?.location?.latitude;
        const placeLng = place?.location?.longitude;

        if (!placeId || !placeName || placeLat == null || placeLng == null) {
          return null;
        }

        const activityType = mapTypeToActivityType(place?.types || []);
        const distanceKm = haversineKm(Number(lat), Number(lng), placeLat, placeLng);

        return {
          place_id: placeId,
          place_name: placeName,
          activity_type: activityType,
          estimated_energy: estimateEnergyForType(activityType),
          distance_km: Math.round(distanceKm * 10) / 10,
          rating: typeof place?.rating === "number" ? place.rating : null,
          address: place?.formattedAddress || "",
          maps_url:
            place?.googleMapsUri ||
            `https://maps.google.com/?q=${encodeURIComponent(placeName)}`,
          estimated_duration_minutes: 60,
          image_url: undefined,
        };
      })
      .filter(Boolean);

    return candidates;
  } catch (err) {
    console.warn("[places] Nearby search exception:", err?.message || err);
    return [];
  }
}
