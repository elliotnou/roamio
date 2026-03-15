/**
 * Client-side community support place finder.
 *
 * Calls Google Places API (New) directly from the mobile app,
 * no backend server needed.
 */
import type {
  CommunityNeedCategory,
  CommunitySupportCategory,
  CommunitySupportPlace,
  CommunityFallbackResource,
} from '../types';

const NEARBY_ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
const TEXT_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const MAX_RESULTS = 12;
const DEFAULT_RADIUS_METERS = 3500;
const CLOSED_BUSINESS_STATUSES = new Set(['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']);

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.types,places.currentOpeningHours.openNow,places.businessStatus';

interface NeedDefinition {
  label: string;
  description: string;
  icon: string;
  included_types: string[];
  category_tags: string[];
  text_fallback_queries: string[];
}

const COMMUNITY_NEED_DEFINITIONS: Record<CommunityNeedCategory, NeedDefinition> = {
  food_and_water: {
    label: 'Food & Water',
    description: 'Find places to eat, drink, or buy groceries nearby.',
    icon: 'coffee',
    included_types: ['restaurant', 'meal_takeaway', 'cafe', 'supermarket'],
    category_tags: ['restaurant', 'meal_takeaway', 'cafe', 'supermarket', 'grocery_store'],
    text_fallback_queries: ['food near me', 'grocery store near me'],
  },
  medication: {
    label: 'Medication',
    description: 'Locate pharmacies and urgent medical support.',
    icon: 'plus-square',
    included_types: ['pharmacy', 'hospital', 'doctor'],
    category_tags: ['pharmacy', 'hospital', 'doctor', 'drugstore'],
    text_fallback_queries: ['pharmacy near me', 'walk-in clinic near me'],
  },
  safe_rest: {
    label: 'Safe Place to Rest',
    description: 'Find calmer spaces to recover and rest.',
    icon: 'moon',
    included_types: ['park', 'library', 'cafe', 'lodging'],
    category_tags: ['park', 'library', 'cafe', 'lodging'],
    text_fallback_queries: ['quiet place near me', 'library near me'],
  },
  mental_health: {
    label: 'Mental Health Support',
    description: 'Look up supportive services and calming spaces.',
    icon: 'heart',
    included_types: ['hospital', 'doctor', 'spa'],
    category_tags: ['hospital', 'doctor', 'spa'],
    text_fallback_queries: ['mental health clinic near me', 'wellness center near me'],
  },
  transit_help: {
    label: 'Transit Help',
    description: 'Get nearby stations to safely get where you need to go.',
    icon: 'navigation',
    included_types: ['bus_station', 'train_station', 'subway_station'],
    category_tags: ['bus_station', 'train_station', 'subway_station', 'transit_station'],
    text_fallback_queries: ['transit station near me', 'bus station near me'],
  },
};

/* ── Helpers ─────────────────────────────────────────── */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function isOpenCandidate(place: any): boolean {
  if (CLOSED_BUSINESS_STATUSES.has(place?.businessStatus)) return false;
  if (place?.currentOpeningHours?.openNow === false) return false;
  return true;
}

function mergePlaces(primary: any[], secondary: any[]): any[] {
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const place of [...primary, ...secondary]) {
    const id = place?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(place);
  }
  return merged;
}

function buildFallbackResources(category: CommunityNeedCategory): CommunityFallbackResource[] {
  const shared: CommunityFallbackResource[] = [
    {
      name: 'Call 211',
      type: 'phone',
      contact: '211',
      description: '24/7 local community resources and social support navigation.',
      url: 'tel:211',
    },
    {
      name: '211 Website',
      type: 'web',
      contact: '211.org',
      description: 'Search for local services if no nearby place appears.',
      url: 'https://www.211.org/',
    },
  ];

  if (category === 'mental_health') {
    return [
      {
        name: '988 Lifeline',
        type: 'phone',
        contact: '988',
        description: '24/7 confidential mental health and crisis support.',
        url: 'tel:988',
      },
      ...shared,
    ];
  }

  return shared;
}

function mapPlaceToResult(
  place: any,
  originLat: number,
  originLng: number,
  categoryTags: string[],
): CommunitySupportPlace | null {
  const placeId = place?.id;
  const placeName = place?.displayName?.text;
  const placeLat = place?.location?.latitude;
  const placeLng = place?.location?.longitude;

  if (!placeId || !placeName || placeLat == null || placeLng == null) return null;

  const placeTypes: string[] = Array.isArray(place?.types) ? place.types : [];
  const matchedTags = placeTypes.filter((t: string) => categoryTags.includes(t));
  const distanceKm = haversineKm(originLat, originLng, placeLat, placeLng);

  return {
    place_id: placeId,
    place_name: placeName,
    address: place?.formattedAddress || '',
    maps_url:
      place?.googleMapsUri ||
      `https://maps.google.com/?q=${encodeURIComponent(placeName)}`,
    distance_km: Math.round(distanceKm * 10) / 10,
    rating: typeof place?.rating === 'number' ? place.rating : null,
    user_rating_count:
      typeof place?.userRatingCount === 'number' ? place.userRatingCount : null,
    open_now:
      typeof place?.currentOpeningHours?.openNow === 'boolean'
        ? place.currentOpeningHours.openNow
        : null,
    business_status: place?.businessStatus || null,
    matched_tags: matchedTags,
  };
}

/* ── Google Places API calls ────────────────────────── */

async function searchNearby(
  lat: number,
  lng: number,
  radius: number,
  includedTypes: string[],
): Promise<any[]> {
  const body = {
    includedTypes,
    maxResultCount: MAX_RESULTS,
    rankPreference: 'DISTANCE',
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
  };

  const response = await fetch(NEARBY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return [];
  const json = await response.json();
  return Array.isArray(json?.places) ? json.places : [];
}

async function searchByText(
  lat: number,
  lng: number,
  radius: number,
  query: string,
): Promise<any[]> {
  const body = {
    textQuery: query,
    pageSize: Math.min(MAX_RESULTS, 8),
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
  };

  const response = await fetch(TEXT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return [];
  const json = await response.json();
  return Array.isArray(json?.places) ? json.places : [];
}

/* ── Exported API (mirrors backend interface) ─────── */

export function getCommunitySupportCategories(): CommunitySupportCategory[] {
  return Object.entries(COMMUNITY_NEED_DEFINITIONS).map(([id, def]) => ({
    id: id as CommunityNeedCategory,
    label: def.label,
    description: def.description,
    icon: def.icon,
  }));
}

export interface CommunitySupportResult {
  category: { id: CommunityNeedCategory; label: string; description: string };
  results: CommunitySupportPlace[];
  fallback_resources: CommunityFallbackResource[];
  fetched_count: number;
}

export async function findCommunitySupportPlaces(payload: {
  need_category: CommunityNeedCategory;
  current_lat: number;
  current_lng: number;
  radius_meters?: number;
}): Promise<CommunitySupportResult> {
  const { need_category, current_lat, current_lng, radius_meters } = payload;
  const category = COMMUNITY_NEED_DEFINITIONS[need_category];

  if (!category) throw new Error('Invalid need_category');

  if (!API_KEY) {
    // No API key — return fallback resources only
    return {
      category: { id: need_category, label: category.label, description: category.description },
      results: [],
      fallback_resources: buildFallbackResources(need_category),
      fetched_count: 0,
    };
  }

  const lat = Number(current_lat);
  const lng = Number(current_lng);
  const radius = Math.max(500, Math.min(10000, Number(radius_meters || DEFAULT_RADIUS_METERS)));

  // Primary: nearby search
  const nearbyPlaces = await searchNearby(lat, lng, radius, category.included_types);

  // Fallback: text search when few results
  const textPlaces: any[] = [];
  if (nearbyPlaces.length < 4) {
    for (const query of category.text_fallback_queries) {
      const found = await searchByText(lat, lng, radius, query);
      textPlaces.push(...found);
    }
  }

  const merged = mergePlaces(nearbyPlaces, textPlaces);
  const results = merged
    .filter(isOpenCandidate)
    .map((p) => mapPlaceToResult(p, lat, lng, category.category_tags))
    .filter(Boolean) as CommunitySupportPlace[];

  results.sort((a, b) => {
    const distDiff = (a.distance_km || 0) - (b.distance_km || 0);
    if (distDiff !== 0) return distDiff;
    return (b.rating || 0) - (a.rating || 0);
  });

  return {
    category: { id: need_category, label: category.label, description: category.description },
    results: results.slice(0, MAX_RESULTS),
    fallback_resources: buildFallbackResources(need_category),
    fetched_count: Math.min(results.length, MAX_RESULTS),
  };
}
