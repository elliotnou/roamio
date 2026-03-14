/**
 * Google Places candidate fetch for low-energy alternatives.
 *
 * Returns candidates normalized for rankAlternatives().
 * If no key is configured or the API request fails, returns [] gracefully.
 */

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const PLACE_DETAILS_ENDPOINT = "https://places.googleapis.com/v1/places";
const MAX_RESULTS = 20;
const DEFAULT_RADIUS_METERS = 3000;
const MIN_PRIMARY_RESULTS = 8;
const CLOSED_BUSINESS_STATUSES = new Set(["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"]);
const DEFAULT_INCLUDED_TYPES = [
  "park",
  "museum",
  "spa",
  "cafe",
  "tourist_attraction",
  "art_gallery",
];

const INCLUDED_TYPES_BY_ACTIVITY = {
  restaurant: ["restaurant", "meal_takeaway", "meal_delivery"],
  cafe: ["cafe", "coffee_shop", "bakery"],
  museum: ["museum"],
  gallery: ["art_gallery"],
  landmark: ["tourist_attraction"],
  walking: ["walking_tour", "tourist_attraction"],
  spa: ["spa"],
  park: ["park"],
  beach: ["beach"],
  shopping: ["shopping_mall"],
  market: ["market"],
  hiking: ["hiking_area"],
  cycling: ["bicycle_store"],
};
const VALID_ACTIVITY_TYPES = new Set(["other", ...Object.keys(INCLUDED_TYPES_BY_ACTIVITY)]);

const ACTIVITY_TYPE_ALIASES = {
  food: "restaurant",
  diner: "restaurant",
  coffee: "cafe",
  coffeeshop: "cafe",
  coffee_shop: "cafe",
  attraction: "landmark",
  tourist_attraction: "landmark",
  art: "gallery",
  mall: "shopping",
  bike: "cycling",
  bicycle: "cycling",
  trail: "hiking",
};

const KEYWORD_TYPE_MATCHERS = [
  { type: "restaurant", pattern: /\b(noodle|ramen|sushi|bbq|burger|pizza|taco|kebab|bistro|eatery|restaurant|grill)\b/i },
  { type: "cafe", pattern: /\b(cafe|coffee|espresso|bakery|tea house|bubble tea)\b/i },
  { type: "spa", pattern: /\b(spa|massage|wellness|sauna)\b/i },
  { type: "park", pattern: /\b(park|garden|botanical)\b/i },
  { type: "museum", pattern: /\b(museum|exhibit|science centre|science center)\b/i },
  { type: "gallery", pattern: /\b(gallery|atelier)\b/i },
  { type: "landmark", pattern: /\b(landmark|tower|monument|historic site|observation deck)\b/i },
  { type: "shopping", pattern: /\b(mall|outlet|shopping centre|shopping center)\b/i },
  { type: "market", pattern: /\b(market|bazaar)\b/i },
  { type: "beach", pattern: /\b(beach|shore)\b/i },
  { type: "hiking", pattern: /\b(hike|hiking|trail)\b/i },
  { type: "cycling", pattern: /\b(cycle|cycling|bike|biking)\b/i },
];

/**
 * Map Google place type strings to the app's activity types.
 */
function mapTypeToActivityType(types = []) {
  const set = new Set(types.filter(Boolean));
  if (set.has("restaurant") || set.has("meal_takeaway") || set.has("meal_delivery")) return "restaurant";
  if (set.has("cafe") || set.has("coffee_shop") || set.has("bakery")) return "cafe";
  if (set.has("park")) return "park";
  if (set.has("beach")) return "beach";
  if (set.has("hiking_area")) return "hiking";
  if (set.has("bicycle_store")) return "cycling";
  if (set.has("spa")) return "spa";
  if (set.has("museum")) return "museum";
  if (set.has("art_gallery")) return "gallery";
  if (set.has("tourist_attraction")) return "landmark";
  if (set.has("shopping_mall")) return "shopping";
  if (set.has("market")) return "market";
  if (set.has("walking_tour")) return "walking";
  return "other";
}

function normalizeActivityType(activityType) {
  if (!activityType || typeof activityType !== "string") return "other";
  const lowered = activityType.trim().toLowerCase();
  const aliased = ACTIVITY_TYPE_ALIASES[lowered] || lowered;
  return VALID_ACTIVITY_TYPES.has(aliased) ? aliased : "other";
}

function inferActivityTypeFromText(text) {
  if (!text || typeof text !== "string") return "other";
  for (const matcher of KEYWORD_TYPE_MATCHERS) {
    if (matcher.pattern.test(text)) {
      return matcher.type;
    }
  }
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

function getIncludedTypesForActivity(activityType) {
  return INCLUDED_TYPES_BY_ACTIVITY[activityType] || DEFAULT_INCLUDED_TYPES;
}

function isOpenCandidate(place) {
  if (CLOSED_BUSINESS_STATUSES.has(place?.businessStatus)) {
    return false;
  }
  if (place?.currentOpeningHours?.openNow === false) {
    return false;
  }
  return true;
}

function mergePlaces(primary, secondary) {
  const seen = new Set();
  const merged = [];

  for (const place of [...primary, ...secondary]) {
    const id = place?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(place);
  }

  return merged;
}

async function fetchOriginActivityType(apiKey, currentPlaceId, fallbackActivityType) {
  const normalizedFallback = normalizeActivityType(fallbackActivityType);

  if (!currentPlaceId) {
    return normalizedFallback;
  }

  try {
    const response = await fetch(
      `${PLACE_DETAILS_ENDPOINT}/${encodeURIComponent(currentPlaceId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,primaryType,types",
        },
      }
    );

    if (!response.ok) {
      return normalizedFallback;
    }

    const place = await response.json();
    const types = [place?.primaryType, ...(Array.isArray(place?.types) ? place.types : [])];
    return mapTypeToActivityType(types) || normalizedFallback;
  } catch {
    return normalizedFallback;
  }
}

async function searchNearby({
  apiKey,
  lat,
  lng,
  radius,
  includedTypes,
  rankPreference,
}) {
  const body = {
    includedTypes,
    maxResultCount: MAX_RESULTS,
    locationRestriction: {
      circle: {
        center: { latitude: Number(lat), longitude: Number(lng) },
        radius,
      },
    },
  };

  if (rankPreference) {
    body.rankPreference = rankPreference;
  }

  const response = await fetch(PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.types,places.currentOpeningHours.openNow,places.businessStatus",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    return { places: [], error: `HTTP ${response.status}: ${raw.slice(0, 200)}` };
  }

  const json = await response.json();
  return { places: Array.isArray(json?.places) ? json.places : [], error: null };
}

/**
 * Fetch nearby wellness-friendly places.
 *
 * @param {object} intent - Gemini classifier result (needs_rerouting, energy_gap, etc.)
 * @param {number} lat - current latitude
 * @param {number} lng - current longitude
 * @param {string} _destination - trip destination string (unused but kept for API compatibility)
 * @param {object} options
 * @param {string} options.current_activity_type
 * @param {string | null} options.current_place_id
 * @param {string} [options.current_place_name]
 * @param {string} [options.current_resolved_place_name]
 * @returns {Promise<object[]>}
 */
export async function findNearbyPlaceCandidates(intent, lat, lng, _destination, options = {}) {
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
  const fallbackActivityType = normalizeActivityType(options?.current_activity_type || "other");
  const textInferredType =
    fallbackActivityType === "other"
      ? inferActivityTypeFromText(
        options?.current_place_name || options?.current_resolved_place_name || ""
      )
      : fallbackActivityType;
  const originActivityType = await fetchOriginActivityType(
    apiKey,
    options?.current_place_id || null,
    textInferredType
  );

  const primaryTypes = getIncludedTypesForActivity(originActivityType);
  const strictTypeMatch = originActivityType !== "other";

  try {
    const primarySearch = await searchNearby({
      apiKey,
      lat,
      lng,
      radius,
      includedTypes: primaryTypes,
      rankPreference: "DISTANCE",
    });
    if (primarySearch.error) {
      console.warn(`[places] Primary nearby search failed: ${primarySearch.error}`);
    }

    const shouldBackfill = !strictTypeMatch && primarySearch.places.length < MIN_PRIMARY_RESULTS;
    const secondarySearch = shouldBackfill
      ? await searchNearby({
        apiKey,
        lat,
        lng,
        radius,
        includedTypes: DEFAULT_INCLUDED_TYPES,
        rankPreference: "DISTANCE",
      })
      : { places: [], error: null };

    if (secondarySearch.error) {
      console.warn(`[places] Secondary nearby search failed: ${secondarySearch.error}`);
    }

    const places = mergePlaces(primarySearch.places, secondarySearch.places);

    const candidates = places
      .filter(isOpenCandidate)
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
          user_rating_count:
            typeof place?.userRatingCount === "number" ? place.userRatingCount : null,
          open_now:
            typeof place?.currentOpeningHours?.openNow === "boolean"
              ? place.currentOpeningHours.openNow
              : null,
          business_status: place?.businessStatus || null,
          address: place?.formattedAddress || "",
          maps_url:
            place?.googleMapsUri ||
            `https://maps.google.com/?q=${encodeURIComponent(placeName)}`,
          estimated_duration_minutes: 60,
          image_url: undefined,
        };
      })
      .filter(Boolean)
      .filter((candidate) => {
        if (!strictTypeMatch) return true;
        return candidate.activity_type === originActivityType;
      })
      .sort((a, b) => {
        const distanceDiff = (a.distance_km || 0) - (b.distance_km || 0);
        if (distanceDiff !== 0) return distanceDiff;

        return (b.rating || 0) - (a.rating || 0);
      })
      .slice(0, MAX_RESULTS);

    return candidates;
  } catch (err) {
    console.warn("[places] Nearby search exception:", err?.message || err);
    return [];
  }
}
