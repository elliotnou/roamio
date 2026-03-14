export type PlaceAutocompleteItem = {
    placeId: string;
    primaryText: string;
    secondaryText?: string;
    fullText: string;
};

type GoogleAutocompleteResponse = {
    suggestions?: Array<{
        placePrediction?: {
            placeId?: string;
            text?: { text?: string };
            structuredFormat?: {
                mainText?: { text?: string };
                secondaryText?: { text?: string };
            };
        };
    }>;
};

export async function fetchPlaceAutocomplete(query: string): Promise<PlaceAutocompleteItem[]> {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
    const input = query.trim();

    if (!key || input.length < 2) {
        return [];
    }

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
        body: JSON.stringify({
            input,
            languageCode: 'en',
            regionCode: 'CA',
        }),
    });

    if (!response.ok) {
        return [];
    }

    const data = (await response.json()) as GoogleAutocompleteResponse;
    const rawItems = data.suggestions ?? [];

    const results: PlaceAutocompleteItem[] = [];
    for (const suggestion of rawItems) {
        const prediction = suggestion.placePrediction;
        if (!prediction?.placeId) continue;

        const primaryText =
            prediction.structuredFormat?.mainText?.text?.trim() ||
            prediction.text?.text?.trim() ||
            '';
        const secondaryText = prediction.structuredFormat?.secondaryText?.text?.trim();
        const fullText =
            prediction.text?.text?.trim() ||
            [primaryText, secondaryText].filter(Boolean).join(', ');

        if (!fullText) continue;

        results.push({
            placeId: prediction.placeId,
            primaryText: primaryText || fullText,
            secondaryText,
            fullText,
        });
    }

    return results;
<<<<<<< HEAD
=======
}

export async function fetchPlacePrimaryPhotoUrl(placeId: string): Promise<string | null> {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
    const normalizedPlaceId = placeId.trim();

    if (!key || !normalizedPlaceId) {
        return null;
    }

    const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${normalizedPlaceId}`, {
        method: 'GET',
        headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'photos',
        },
    });

    if (!detailsResponse.ok) {
        return null;
    }

    const detailsData = (await detailsResponse.json()) as GooglePlaceDetailsResponse;
    const firstPhotoName = detailsData.photos?.[0]?.name?.trim();

    if (!firstPhotoName) {
        return null;
    }

    return `https://places.googleapis.com/v1/${firstPhotoName}/media?maxWidthPx=1200&key=${encodeURIComponent(key)}`;
>>>>>>> d9ecba0c (merging)
}

// ─── Nearby Places (for check-in alternative suggestions) ───

export interface NearbyPlaceResult {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    rating: number | null;
    mapsUrl: string;
    distanceMeters: number;
}

type NearbySearchResponse = {
    places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        googleMapsUri?: string;
    }>;
};

/**
 * Fetch nearby places around a lat/lng using Places API v1 Nearby Search.
 * Returns enriched candidates suitable for the alternative ranker.
 */
export async function fetchNearbyPlaces(
    lat: number,
    lng: number,
    radiusMeters = 3000,
    includedTypes: string[] = ['park', 'museum', 'spa', 'cafe', 'tourist_attraction']
): Promise<NearbyPlaceResult[]> {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) return [];

    try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': key,
                'X-Goog-FieldMask':
                    'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri',
            },
            body: JSON.stringify({
                includedTypes,
                maxResultCount: 20,
                locationRestriction: {
                    circle: {
                        center: { latitude: lat, longitude: lng },
                        radius: radiusMeters,
                    },
                },
            }),
        });

        if (!response.ok) return [];

        const data = (await response.json()) as NearbySearchResponse;
        const places = data.places ?? [];

        const results: NearbyPlaceResult[] = [];
        for (const p of places) {
            if (!p.id || !p.displayName?.text) continue;

            const placeLat = p.location?.latitude ?? lat;
            const placeLng = p.location?.longitude ?? lng;

            // Haversine approximation for distance in metres
            const dx = (placeLng - lng) * Math.cos((lat * Math.PI) / 180) * 111111;
            const dy = (placeLat - lat) * 111111;
            const distanceMeters = Math.round(Math.sqrt(dx * dx + dy * dy));

            results.push({
                placeId: p.id,
                name: p.displayName.text,
                address: p.formattedAddress ?? '',
                lat: placeLat,
                lng: placeLng,
                rating: p.rating ?? null,
                mapsUrl: p.googleMapsUri ?? `https://maps.google.com/?q=${placeLat},${placeLng}`,
                distanceMeters,
            });
        }

        return results;
    } catch {
        return [];
    }
}
