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
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'
        },
        body: JSON.stringify({
        input,
        languageCode: 'en',
        regionCode: 'CA'
        })
    });

    if (!response.ok) {
        return [];
    }

    const data = (await response.json()) as GoogleAutocompleteResponse;
    const rawItems = data.suggestions ?? [];

    return rawItems
        .map((item) => {
        const prediction = item.placePrediction;
        if (!prediction?.placeId) {
            return null;
        }

        const primaryText = prediction.structuredFormat?.mainText?.text?.trim() || prediction.text?.text?.trim() || '';
        const secondaryText = prediction.structuredFormat?.secondaryText?.text?.trim();
        const fullText = prediction.text?.text?.trim() || [primaryText, secondaryText].filter(Boolean).join(', ');

        if (!fullText) {
            return null;
        }

        return {
            placeId: prediction.placeId,
            primaryText: primaryText || fullText,
            secondaryText,
            fullText
        } satisfies PlaceAutocompleteItem;
    })
    .filter((item): item is PlaceAutocompleteItem => Boolean(item));
}
