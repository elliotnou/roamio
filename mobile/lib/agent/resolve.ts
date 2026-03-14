/**
 * Place Resolver Agent
 *
 * Resolves a free-form place name into:
 * - A Google Places Text Search query string
 * - A classified activity type
 * - An energy cost estimate (1-10)
 *
 * Then performs the actual Google Places Text Search to fetch place_id + coordinates.
 */

import { callGemini } from '../gemini';
import { buildPlaceResolverPrompt } from './prompts';
import { validatePlaceResolverOutput } from './validate';
import type { PlaceResolverInput, PlaceResolverOutput } from './types';

export type { PlaceResolverInput, PlaceResolverOutput };

export interface ResolvedPlaceDetails {
  google_places_query: string;
  activity_type: PlaceResolverOutput['activity_type'];
  energy_cost_estimate: number;
  /** Google Place ID, null if Places API not configured or returned no results */
  resolved_place_id: string | null;
  resolved_place_name: string | null;
  resolved_lat: number | null;
  resolved_lng: number | null;
}

interface PlacesTextSearchResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  }>;
}

/**
 * Step 1: Call Gemini to classify the place and get a search query.
 * Step 2: Run Google Places Text Search with that query to get real coordinates.
 */
export async function resolvePlace(
  input: PlaceResolverInput
): Promise<ResolvedPlaceDetails> {
  const prompt = buildPlaceResolverPrompt(input);
  const raw = await callGemini<unknown>(prompt);
  const geminiOut = validatePlaceResolverOutput(raw);

  // Step 2: Google Places Text Search
  const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  if (!googleKey) {
    console.warn('[resolvePlace] EXPO_PUBLIC_GOOGLE_MAPS_KEY not set — skipping place lookup');
    return {
      ...geminiOut,
      resolved_place_id: null,
      resolved_place_name: null,
      resolved_lat: null,
      resolved_lng: null,
    };
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.location',
      },
      body: JSON.stringify({
        textQuery: geminiOut.google_places_query,
        maxResultCount: 1,
        languageCode: 'en',
      }),
    });

    if (!res.ok) {
      console.warn('[resolvePlace] Places Text Search failed:', res.status);
      return {
        ...geminiOut,
        resolved_place_id: null,
        resolved_place_name: null,
        resolved_lat: null,
        resolved_lng: null,
      };
    }

    const data = (await res.json()) as PlacesTextSearchResponse;
    const place = data.places?.[0];

    if (!place?.id) {
      return {
        ...geminiOut,
        resolved_place_id: null,
        resolved_place_name: null,
        resolved_lat: null,
        resolved_lng: null,
      };
    }

    return {
      ...geminiOut,
      resolved_place_id: place.id,
      resolved_place_name: place.displayName?.text ?? null,
      resolved_lat: place.location?.latitude ?? null,
      resolved_lng: place.location?.longitude ?? null,
    };
  } catch (err) {
    console.warn('[resolvePlace] Places Text Search error:', err);
    return {
      ...geminiOut,
      resolved_place_id: null,
      resolved_place_name: null,
      resolved_lat: null,
      resolved_lng: null,
    };
  }
}
