/**
 * Community support place finder.
 *
 * Finds nearby essential places by need category using Google Places API.
 * Designed to be independent from trip suggestion flow.
 */

const NEARBY_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
const TEXT_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const MAX_RESULTS = 12;
const DEFAULT_RADIUS_METERS = 3500;
const CLOSED_BUSINESS_STATUSES = new Set(["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"]);

const COMMUNITY_NEED_DEFINITIONS = {
  food_and_water: {
    label: "Food & Water",
    description: "Find places to eat, drink, or buy groceries nearby.",
    icon: "coffee",
    included_types: ["restaurant", "meal_takeaway", "cafe", "supermarket"],
    category_tags: ["restaurant", "meal_takeaway", "cafe", "supermarket", "grocery_store"],
    text_fallback_queries: ["food near me", "grocery store near me"],
  },
  medication: {
    label: "Medication",
    description: "Locate pharmacies and urgent medical support.",
    icon: "plus-square",
    included_types: ["pharmacy", "hospital", "doctor"],
    category_tags: ["pharmacy", "hospital", "doctor", "drugstore"],
    text_fallback_queries: ["pharmacy near me", "walk-in clinic near me"],
  },
  safe_rest: {
    label: "Safe Place to Rest",
    description: "Find calmer spaces to recover and rest.",
    icon: "moon",
    included_types: ["park", "library", "cafe", "lodging"],
    category_tags: ["park", "library", "cafe", "lodging"],
    text_fallback_queries: ["quiet place near me", "library near me"],
  },
  mental_health: {
    label: "Mental Health Support",
    description: "Look up supportive services and calming spaces.",
    icon: "heart",
    included_types: ["hospital", "doctor", "spa"],
    category_tags: ["hospital", "doctor", "spa"],
    text_fallback_queries: ["mental health clinic near me", "wellness center near me"],
  },
  transit_help: {
    label: "Transit Help",
    description: "Get nearby stations to safely get where you need to go.",
    icon: "navigation",
    included_types: ["bus_station", "train_station", "subway_station"],
    category_tags: ["bus_station", "train_station", "subway_station", "transit_station"],
    text_fallback_queries: ["transit station near me", "bus station near me"],
  },
};

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

function normalizeNeedCategory(category) {
  if (!category || typeof category !== "string") return null;
  const normalized = category.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(COMMUNITY_NEED_DEFINITIONS, normalized)
    ? normalized
    : null;
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

function buildFallbackResources(category) {
  const shared = [
    {
      name: "Call 211",
      type: "phone",
      contact: "211",
      description: "24/7 local community resources and social support navigation.",
      url: "tel:211",
    },
    {
      name: "211 Website",
      type: "web",
      contact: "211.org",
      description: "Search for local services if no nearby place appears.",
      url: "https://www.211.org/",
    },
  ];

  if (category === "mental_health") {
    return [
      {
        name: "988 Lifeline",
        type: "phone",
        contact: "988",
        description: "24/7 confidential mental health and crisis support.",
        url: "tel:988",
      },
      ...shared,
    ];
  }

  return shared;
}

function mapPlaceToResult(place, originLat, originLng, categoryTags) {
  const placeId = place?.id;
  const placeName = place?.displayName?.text;
  const placeLat = place?.location?.latitude;
  const placeLng = place?.location?.longitude;

  if (!placeId || !placeName || placeLat == null || placeLng == null) {
    return null;
  }

  const placeTypes = Array.isArray(place?.types) ? place.types : [];
  const matchedTags = placeTypes.filter((t) => categoryTags.includes(t));
  const distanceKm = haversineKm(Number(originLat), Number(originLng), placeLat, placeLng);

  return {
    place_id: placeId,
    place_name: placeName,
    address: place?.formattedAddress || "",
    maps_url:
      place?.googleMapsUri ||
      `https://maps.google.com/?q=${encodeURIComponent(placeName)}`,
    distance_km: Math.round(distanceKm * 10) / 10,
    rating: typeof place?.rating === "number" ? place.rating : null,
    user_rating_count:
      typeof place?.userRatingCount === "number" ? place.userRatingCount : null,
    open_now:
      typeof place?.currentOpeningHours?.openNow === "boolean"
        ? place.currentOpeningHours.openNow
        : null,
    business_status: place?.businessStatus || null,
    matched_tags: matchedTags,
  };
}

async function searchNearby({
  apiKey,
  lat,
  lng,
  radius,
  includedTypes,
}) {
  const body = {
    includedTypes,
    maxResultCount: MAX_RESULTS,
    rankPreference: "DISTANCE",
    locationRestriction: {
      circle: {
        center: { latitude: Number(lat), longitude: Number(lng) },
        radius,
      },
    },
  };

  const response = await fetch(NEARBY_ENDPOINT, {
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

async function searchByText({
  apiKey,
  lat,
  lng,
  radius,
  query,
}) {
  const body = {
    textQuery: query,
    pageSize: Math.min(MAX_RESULTS, 8),
    locationBias: {
      circle: {
        center: { latitude: Number(lat), longitude: Number(lng) },
        radius,
      },
    },
  };

  const response = await fetch(TEXT_ENDPOINT, {
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

export function getCommunitySupportCategories() {
  return Object.entries(COMMUNITY_NEED_DEFINITIONS).map(([id, def]) => ({
    id,
    label: def.label,
    description: def.description,
    icon: def.icon,
  }));
}

export async function findCommunitySupportPlaces({
  need_category,
  current_lat,
  current_lng,
  radius_meters,
}) {
  const categoryId = normalizeNeedCategory(need_category);
  if (!categoryId) {
    throw new Error("Invalid need_category");
  }

  const apiKey =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      category: {
        id: categoryId,
        label: COMMUNITY_NEED_DEFINITIONS[categoryId].label,
        description: COMMUNITY_NEED_DEFINITIONS[categoryId].description,
      },
      results: [],
      fallback_resources: buildFallbackResources(categoryId),
      fetched_count: 0,
    };
  }

  const lat = Number(current_lat);
  const lng = Number(current_lng);
  const radius = Math.max(500, Math.min(10000, Number(radius_meters || DEFAULT_RADIUS_METERS)));

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new Error("Invalid current_lat/current_lng");
  }

  const category = COMMUNITY_NEED_DEFINITIONS[categoryId];

  const nearby = await searchNearby({
    apiKey,
    lat,
    lng,
    radius,
    includedTypes: category.included_types,
  });

  if (nearby.error) {
    console.warn(`[community-support] Nearby search warning: ${nearby.error}`);
  }

  const textFallbackPlaces = [];
  if ((nearby.places || []).length < 4) {
    for (const query of category.text_fallback_queries) {
      const fallbackSearch = await searchByText({ apiKey, lat, lng, radius, query });
      if (fallbackSearch.error) {
        console.warn(`[community-support] Text search warning: ${fallbackSearch.error}`);
      }
      textFallbackPlaces.push(...fallbackSearch.places);
    }
  }

  const mergedPlaces = mergePlaces(nearby.places, textFallbackPlaces);
  const results = mergedPlaces
    .filter(isOpenCandidate)
    .map((place) => mapPlaceToResult(place, lat, lng, category.category_tags))
    .filter(Boolean)
    .sort((a, b) => {
      const distanceDiff = (a.distance_km || 0) - (b.distance_km || 0);
      if (distanceDiff !== 0) return distanceDiff;
      return (b.rating || 0) - (a.rating || 0);
    })
    .slice(0, MAX_RESULTS);

  return {
    category: {
      id: categoryId,
      label: category.label,
      description: category.description,
    },
    results,
    fallback_resources: buildFallbackResources(categoryId),
    fetched_count: results.length,
  };
}
