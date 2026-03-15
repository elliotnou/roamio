import { create } from 'zustand';
import type {
  User,
  Trip,
  ActivityBlock,
  CheckIn,
  ActivitySuggestion,
  ActivityType,
  AgentActivityType,
} from '../types';
import type { NearbyPlaceCandidate } from '../types';
import { supabase } from '../lib/supabase';
import {
  createActivityBlockViaBackend,
  createCheckInViaBackend,
  requestSuggestionsFromBackend,
  updateCheckInOutcomeViaBackend,
  curateTripItineraryViaBackend,
} from '../lib/backend';
import { callGemini } from '../lib/gemini';
import { resolvePlace } from '../lib/agent/resolve';
import { classifyCheckIn } from '../lib/agent/classifier';
import { rankAlternatives } from '../lib/agent/ranker';
import { fetchNearbyPlaces, fetchPlacePrimaryPhotoUrl } from '../lib/places';

function normalizeTime(value: string): string {
  if (!value) return value;
  if (value.includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
    }
  }
  return value.slice(0, 5);
}

function normalizeActivityBlock(block: any): ActivityBlock {
  return {
    ...block,
    start_time: normalizeTime(block.start_time),
    end_time: normalizeTime(block.end_time),
  };
}

function toClockMinutes(value: string): number {
  if (!value) return 0;
  const raw = String(value).trim();
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      return h * 60 + m;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

function sortActivityBlocks(blocks: ActivityBlock[]): ActivityBlock[] {
  return [...blocks].sort((a, b) => {
    const dayDiff = (a.day_index ?? 0) - (b.day_index ?? 0);
    if (dayDiff !== 0) return dayDiff;

    const startDiff = toClockMinutes(a.start_time) - toClockMinutes(b.start_time);
    if (startDiff !== 0) return startDiff;

    return a.place_name.localeCompare(b.place_name);
  });
}

const CURATED_TYPE: ActivityType = 'mindful';
const CURATED_TIME_SLOTS: ReadonlyArray<readonly [string, string]> = [
  ['08:00', '09:00'],
  ['09:30', '11:00'],
  ['11:30', '13:00'],
  ['13:30', '14:30'],
  ['15:00', '16:30'],
  ['17:00', '18:30'],
  ['19:00', '20:30'],
  ['20:30', '21:30'],
];

const MOBILE_CLOSED_STATUSES = new Set(['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']);
const VIBE_QUERY_TEMPLATES: Record<string, string[]> = {
  relaxing: [
    'quiet parks and gardens in {destination}',
    'wellness spa in {destination}',
    'calm tea house cafe in {destination}',
  ],
  adventure: [
    'hiking trail in {destination}',
    'outdoor viewpoint in {destination}',
    'walking tour attraction in {destination}',
  ],
  culture: [
    'museum in {destination}',
    'art gallery in {destination}',
    'historic landmark in {destination}',
  ],
  foodie: [
    'local restaurant in {destination}',
    'food market in {destination}',
    'popular cafe in {destination}',
  ],
};

interface DestinationCandidate {
  place_id: string;
  place_name: string;
  address: string;
  maps_url: string;
  rating: number | null;
  user_rating_count: number | null;
  types: string[];
  vibe_hint: string;
  resolved_lat: number | null;
  resolved_lng: number | null;
}

interface GeminiCuratedActivity {
  place_id?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  energy_cost_estimate?: number;
}

interface GeminiCuratedDay {
  day_index?: number;
  activities?: GeminiCuratedActivity[];
}

interface GeminiCuratedPlan {
  days?: GeminiCuratedDay[];
}

function getTripDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  if (Number.isNaN(diff)) return 1;
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeClock(timeValue: unknown, fallback: string): string {
  if (typeof timeValue !== 'string') return fallback;
  const match = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallback;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toTripTimestamp(baseDate: string, dayIndex: number, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  date.setHours(h || 0, m || 0, 0, 0);
  return date.toISOString();
}

function getSelectedVibes(trip: Trip): string[] {
  const selected = (trip.travel_vibes || []).filter((v) => !!VIBE_QUERY_TEMPLATES[v]);
  return selected.length > 0 ? selected : ['relaxing', 'culture', 'foodie'];
}

function buildVibeQueries(destination: string, vibes: string[]): Array<{ query: string; vibe_hint: string }> {
  const queries: Array<{ query: string; vibe_hint: string }> = [];
  for (const vibe of vibes) {
    const templates = VIBE_QUERY_TEMPLATES[vibe] || [];
    for (const template of templates) {
      queries.push({
        query: template.replace('{destination}', destination),
        vibe_hint: vibe,
      });
    }
  }
  return queries.slice(0, 8);
}

async function searchPlacesTextOnMobile(query: string, vibeHint: string): Promise<DestinationCandidate[]> {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return [];

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.businessStatus,places.googleMapsUri',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'en',
        maxResultCount: 12,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const json = (await response.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        userRatingCount?: number;
        types?: string[];
        businessStatus?: string;
        googleMapsUri?: string;
      }>;
    };

    const places = json.places || [];
    return places
      .filter((place) => {
        if (!place.id || !place.displayName?.text) return false;
        if (MOBILE_CLOSED_STATUSES.has(place.businessStatus || '')) return false;
        return true;
      })
      .map((place) => ({
        place_id: place.id || '',
        place_name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        maps_url: place.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(place.displayName?.text || '')}`,
        rating: typeof place.rating === 'number' ? place.rating : null,
        user_rating_count: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
        types: Array.isArray(place.types) ? place.types : [],
        vibe_hint: vibeHint,
        resolved_lat: typeof place.location?.latitude === 'number' ? place.location.latitude : null,
        resolved_lng: typeof place.location?.longitude === 'number' ? place.location.longitude : null,
      }));
  } catch {
    return [];
  }
}

async function fetchDestinationPlaceCandidates(trip: Trip): Promise<DestinationCandidate[]> {
  const vibes = getSelectedVibes(trip);
  const queries = buildVibeQueries(trip.destination, vibes);
  if (queries.length === 0) return [];

  const resultSets = await Promise.all(
    queries.map((item) => searchPlacesTextOnMobile(item.query, item.vibe_hint))
  );

  const byId = new Map<string, DestinationCandidate>();
  for (const candidate of resultSets.flat()) {
    if (!candidate.place_id) continue;
    const current = byId.get(candidate.place_id);
    if (!current || (candidate.rating || 0) >= (current.rating || 0)) {
      byId.set(candidate.place_id, candidate);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.user_rating_count || 0) - (a.user_rating_count || 0);
    })
    .slice(0, 36);
}

function buildCandidateDescription(candidate: DestinationCandidate): string {
  const shortAddress = candidate.address ? candidate.address.split(',').slice(0, 2).join(',').trim() : '';
  const ratingText =
    typeof candidate.rating === 'number'
      ? `Rated ${candidate.rating.toFixed(1)}`
      : 'Well-regarded locally';
  const locationText = shortAddress ? ` in ${shortAddress}` : '';
  return `${ratingText}${locationText}, chosen for a ${candidate.vibe_hint}-friendly pace.`.slice(0, 220);
}

function buildDeterministicCuratedRows(trip: Trip, candidates: DestinationCandidate[], targetDayIndex: number = 0, slotCount: number = 5): Omit<ActivityBlock, 'id'>[] {
  const vibes = getSelectedVibes(trip);
  const rows: Omit<ActivityBlock, 'id'>[] = [];
  let cursor = 0;
  const usedToday = new Set<string>();

  for (let slotIndex = 0; slotIndex < Math.min(slotCount, CURATED_TIME_SLOTS.length); slotIndex += 1) {
    const targetVibe = vibes[(targetDayIndex + slotIndex) % vibes.length];
    let selected: DestinationCandidate | null = null;

    for (let probe = 0; probe < candidates.length; probe += 1) {
      const candidate = candidates[(cursor + probe) % candidates.length];
      if (!candidate || usedToday.has(candidate.place_id)) continue;
      if (candidate.vibe_hint === targetVibe) {
        selected = candidate;
        cursor = (cursor + probe + 1) % candidates.length;
        break;
      }
    }

    if (!selected) {
      for (let probe = 0; probe < candidates.length; probe += 1) {
        const candidate = candidates[(cursor + probe) % candidates.length];
        if (candidate && !usedToday.has(candidate.place_id)) {
          selected = candidate;
          cursor = (cursor + probe + 1) % candidates.length;
          break;
        }
      }
    }

    if (!selected) break;
    usedToday.add(selected.place_id);
    const [start, end] = CURATED_TIME_SLOTS[slotIndex];

    rows.push({
      trip_id: trip.id,
      day_index: targetDayIndex,
      place_name: selected.place_name,
      resolved_place_id: selected.place_id,
      resolved_place_name: buildCandidateDescription(selected),
      resolved_lat: selected.resolved_lat,
      resolved_lng: selected.resolved_lng,
      activity_type: CURATED_TYPE,
      energy_cost_estimate: clampInt(estimateEnergyForAgentType(mapGoogleTypesToAgentType(selected.types)), 1, 10, 4),
      start_time: toTripTimestamp(trip.start_date, targetDayIndex, start),
      end_time: toTripTimestamp(trip.start_date, targetDayIndex, end),
    });
  }

  return rows;
}

function buildMobileCurationPrompt(trip: Trip, candidates: DestinationCandidate[], pace: 'light' | 'balanced' | 'packed' = 'balanced', dayIndex: number = 0): string {
  const vibeText = getSelectedVibes(trip).join(', ');
  const candidateLines = candidates
    .map((candidate) => {
      const rating = typeof candidate.rating === 'number' ? candidate.rating.toFixed(1) : 'N/A';
      const type = mapAgentTypeToActivityType(mapGoogleTypesToAgentType(candidate.types));
      return `- place_id="${candidate.place_id}", name="${candidate.place_name}", vibe="${candidate.vibe_hint}", type="${type}", rating="${rating}", address="${candidate.address}"`;
    })
    .join('\n');

  const paceConfig = {
    light: { min: 3, max: 4, energy: '1-4', meals: 1, desc: 'Relaxed — 3-4 activities, generous breaks, gentle energy.' },
    balanced: { min: 5, max: 6, energy: '2-6', meals: 2, desc: 'Comfortable mix — 5-6 activities with 2 meals, sightseeing, and buffer time.' },
    packed: { min: 7, max: 8, energy: '2-8', meals: 3, desc: 'Jam-packed — 7-8 activities filling the whole day: breakfast, lunch, dinner, major sights, hidden gems, and experiences.' },
  }[pace];

  return `You are building a SINGLE DAY itinerary for a traveler visiting ${trip.destination}. Use ONLY these real place_ids.

PACE: ${pace.toUpperCase()} — ${paceConfig.desc}

Return JSON only — a flat array of activities for this ONE day:
{
  "days": [
    {
      "day_index": ${dayIndex},
      "activities": [
        {
          "place_id": "string",
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "description": "short factual description",
          "energy_cost_estimate": 3
        }
      ]
    }
  ]
}

CRITICAL RULES:
- Generate EXACTLY ONE day with day_index ${dayIndex}.
- You MUST include ${paceConfig.min} to ${paceConfig.max} activities. Do NOT generate fewer.
- ${paceConfig.meals} meal(s) required — use restaurants/cafes from the list (breakfast ~08:00-09:00, lunch ~12:00-13:30, dinner ~19:00-20:30).
- Fill the day from 08:00 to 21:30 with varied durations: quick stops (30-45 min), medium visits (1-1.5h), longer experiences (2h).
- Mix activity TYPES: meals, museums, parks, landmarks, markets, cafes — real variety, not all the same category.
- Times in 24h HH:MM format, strictly non-overlapping, in chronological order.
- Activities should be geographically sensible — nearby each other, not zig-zagging.
- Energy costs: ${paceConfig.energy} range.
- Use ONLY listed place_ids. Each place_id used at most once.
- Vibes the traveler wants: ${vibeText}

Candidates (pick from these):
${candidateLines}`;
}

function normalizeGeminiCuratedRows(
  plan: GeminiCuratedPlan,
  trip: Trip,
  candidatesById: Map<string, DestinationCandidate>,
  targetDayIndex?: number
): Omit<ActivityBlock, 'id'>[] {
  const rows: Omit<ActivityBlock, 'id'>[] = [];
  const rawDays = Array.isArray(plan?.days) ? plan.days : [];
  const usedGlobal = new Set<string>();

  for (const day of rawDays) {
    const dayIndex = Number(day?.day_index ?? 0);
    if (targetDayIndex != null && dayIndex !== targetDayIndex) continue;

    const activities = Array.isArray(day?.activities) ? day.activities : [];

    activities.forEach((activity, slotIndex) => {
      const candidate = activity?.place_id ? candidatesById.get(activity.place_id) : null;
      if (!candidate || usedGlobal.has(candidate.place_id)) return;
      const fallbackSlot = CURATED_TIME_SLOTS[Math.min(slotIndex, CURATED_TIME_SLOTS.length - 1)];
      const start = normalizeClock(activity?.start_time, fallbackSlot[0]);
      const end = normalizeClock(activity?.end_time, fallbackSlot[1]);
      const description = buildCandidateDescription(candidate);
      usedGlobal.add(candidate.place_id);

      rows.push({
        trip_id: trip.id,
        day_index: dayIndex,
        place_name: candidate.place_name,
        resolved_place_id: candidate.place_id,
        resolved_place_name: description,
        resolved_lat: candidate.resolved_lat,
        resolved_lng: candidate.resolved_lng,
        activity_type: CURATED_TYPE,
        energy_cost_estimate: clampInt(
          activity?.energy_cost_estimate,
          1,
          10,
          estimateEnergyForAgentType(mapGoogleTypesToAgentType(candidate.types))
        ),
        start_time: toTripTimestamp(trip.start_date, dayIndex, start),
        end_time: toTripTimestamp(trip.start_date, dayIndex, end),
      });
    });
  }

  return rows;
}

function mapSuggestion(suggestion: any): ActivitySuggestion {
  return {
    place_id: suggestion.place_id,
    place_name: suggestion.place_name || '',
    address: suggestion.address || '',
    maps_url: suggestion.maps_url || '',
    energy_cost_label: suggestion.energy_cost_label || 'low',
    why_it_fits: suggestion.why_it_fits || '',
    distance_km: typeof suggestion.distance_km === 'number' ? suggestion.distance_km : 0,
    estimated_duration_minutes:
      typeof suggestion.estimated_duration_minutes === 'number'
        ? suggestion.estimated_duration_minutes
        : 0,
    image_url: suggestion.image_url,
  };
}

async function attachSuggestionImages(suggestions: ActivitySuggestion[]): Promise<ActivitySuggestion[]> {
  const enriched = await Promise.all(
    suggestions.map(async (suggestion) => {
      if (suggestion.image_url || !suggestion.place_id) {
        return suggestion;
      }

      try {
        const imageUrl = await fetchPlacePrimaryPhotoUrl(suggestion.place_id);
        return imageUrl ? { ...suggestion, image_url: imageUrl } : suggestion;
      } catch {
        return suggestion;
      }
    })
  );

  return enriched;
}

function mapAgentTypeToActivityType(type: AgentActivityType): ActivityType {
  switch (type) {
    case 'walking_tour':
      return 'walking';
    case 'dining':
      return 'restaurant';
    case 'spa_wellness':
      return 'spa';
    case 'sightseeing':
      return 'landmark';
    case 'relaxation':
      return 'park';
    default:
      if (
        type === 'hiking' ||
        type === 'museum' ||
        type === 'shopping' ||
        type === 'beach' ||
        type === 'park' ||
        type === 'cycling' ||
        type === 'other'
      ) {
        return type;
      }
      return 'other';
  }
}

function mapUiTypeToAgentType(type: ActivityType): AgentActivityType {
  switch (type) {
    case 'walking':
      return 'walking_tour';
    case 'restaurant':
    case 'cafe':
      return 'dining';
    case 'landmark':
      return 'sightseeing';
    case 'spa':
      return 'spa_wellness';
    case 'gallery':
      return 'cultural_event';
    default:
      if (
        type === 'hiking' ||
        type === 'museum' ||
        type === 'shopping' ||
        type === 'beach' ||
        type === 'park' ||
        type === 'cycling' ||
        type === 'other'
      ) {
        return type;
      }
      return 'other';
  }
}

function mapGoogleTypesToAgentType(types: string[]): AgentActivityType {
  const set = new Set(types);
  if (set.has('restaurant') || set.has('meal_takeaway') || set.has('meal_delivery') || set.has('cafe') || set.has('bakery')) return 'dining';
  if (set.has('spa')) return 'spa_wellness';
  if (set.has('park')) return 'park';
  if (set.has('museum') || set.has('art_gallery')) return 'museum';
  if (set.has('beach')) return 'beach';
  if (set.has('tourist_attraction')) return 'sightseeing';
  if (set.has('shopping_mall')) return 'shopping';
  return 'other';
}

function estimateEnergyForAgentType(type: AgentActivityType): number {
  switch (type) {
    case 'spa_wellness':
      return 2;
    case 'park':
    case 'museum':
    case 'cultural_event':
    case 'relaxation':
      return 3;
    case 'dining':
      return 4;
    case 'sightseeing':
    case 'shopping':
      return 5;
    default:
      return 4;
  }
}

function getNearbyIncludedTypesForActivity(type: ActivityType): string[] {
  if (type === 'restaurant' || type === 'cafe') {
    return ['restaurant', 'cafe', 'bakery', 'meal_takeaway'];
  }
  if (type === 'museum' || type === 'gallery' || type === 'landmark') {
    return ['museum', 'art_gallery', 'tourist_attraction', 'cafe'];
  }
  if (type === 'spa') {
    return ['spa', 'cafe', 'park'];
  }
  if (type === 'park' || type === 'beach') {
    return ['park', 'tourist_attraction', 'cafe'];
  }
  return ['park', 'museum', 'spa', 'cafe', 'tourist_attraction'];
}

interface CheckInFlowResult {
  needs_rerouting: boolean;
  affirmation_message: string | null;
  reasoning: string;
  suggestions: ActivitySuggestion[];
  places_available: boolean;
}

interface TripStore {
  user: User;
  trips: Trip[];
  activeTrip: Trip | null;
  activityBlocks: Record<string, ActivityBlock[]>;
  checkIns: CheckIn[];
  energyLevel: number | null;
  suggestions: ActivitySuggestion[];
  latestCheckInId: string | null;
  isLoading: boolean;

  fetchData: () => Promise<void>;
  setUser: (user: User | null) => void;
  setActiveTrip: (trip: Trip | null) => void;
  setEnergyLevel: (level: number) => void;
  clearSuggestions: () => void;
  addTrip: (trip: Omit<Trip, 'id' | 'created_at'>) => Promise<Trip | null>;
  setTripDestinationImage: (tripId: string, imageUrl: string) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<boolean>;
  addActivityBlock: (block: Omit<ActivityBlock, 'id'>) => Promise<ActivityBlock | null>;
  generateCuratedItinerary: (
    tripId: string,
    options?: { replaceExisting?: boolean; pace?: 'light' | 'balanced' | 'packed'; dayIndex?: number }
  ) => Promise<ActivityBlock[] | null>;
  deleteActivityBlock: (blockId: string, tripId: string) => Promise<boolean>;
  updateActivityBlock: (blockId: string, updates: Partial<Pick<ActivityBlock, 'place_name' | 'start_time' | 'end_time' | 'activity_type' | 'energy_cost_estimate'>>) => Promise<ActivityBlock | null>;
  startCheckIn: (params: {
    activityBlock: ActivityBlock;
    energyLevel: number;
    currentLat: number;
    currentLng: number;
  }) => Promise<CheckInFlowResult>;
  updateSuggestionOutcome: (payload: {
    agent_outcome: CheckIn['agent_outcome'];
    selected_place_id?: string | null;
    selected_place_name?: string | null;
  }) => Promise<void>;
  compactifyDay: (tripId: string, dayIndex: number) => Promise<CompactifyResult | null>;
}

export interface CompactifyItem {
  id: string;
  place_name: string;
  start_time: string;
  end_time: string;
  action: 'keep' | 'drop';
  reason: string;
}

export interface CompactifyResult {
  items: CompactifyItem[];
  summary: string;
}

export const useTripStore = create<TripStore>((set, get) => ({
  user: null as any,
  trips: [],
  activeTrip: null,
  activityBlocks: {},
  checkIns: [],
  energyLevel: null,
  suggestions: [],
  latestCheckInId: null,
  isLoading: true,

  setUser: (user) => set({ user: user as any }),
  setActiveTrip: (trip) => set({ activeTrip: trip }),
  setEnergyLevel: (level) => set({ energyLevel: level }),
  clearSuggestions: () => set({ suggestions: [], latestCheckInId: null }),

  fetchData: async () => {
    set({ isLoading: true });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        set({ isLoading: false });
        return;
      }

      const userId = session.user.id;
      set({
        user: {
          id: userId,
          email: session.user.email || '',
          display_name: session.user.user_metadata?.display_name || '',
          created_at: new Date().toISOString(),
        },
      });

      const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: true });

      if (!trips) return;

      const tripIds = trips.map((trip) => trip.id);
      const { data: blocks } = await supabase
        .from('activity_blocks')
        .select('*')
        .in('trip_id', tripIds)
        .order('trip_id', { ascending: true })
        .order('day_index', { ascending: true })
        .order('start_time', { ascending: true });
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      const blocksMap: Record<string, ActivityBlock[]> = {};
      trips.forEach((trip) => {
        blocksMap[trip.id] = [];
      });

      if (blocks) {
        blocks.forEach((block) => {
          if (!blocksMap[block.trip_id]) blocksMap[block.trip_id] = [];
          blocksMap[block.trip_id].push(normalizeActivityBlock(block));
        });

        Object.keys(blocksMap).forEach((tripIdKey) => {
          blocksMap[tripIdKey] = sortActivityBlocks(blocksMap[tripIdKey]);
        });
      }

      set({
        trips,
        activeTrip: trips.length > 0 ? trips[0] : null,
        activityBlocks: blocksMap,
        checkIns: (checkIns || []) as CheckIn[],
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addTrip: async (trip) => {
    let userId = get().user?.id;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) userId = session.user.id;
    } catch {}
    if (!userId) return null;

    const dbTrip = { ...trip, user_id: userId };
    try {
      const { data, error } = await supabase.from('trips').insert([dbTrip]).select().single();
      if (data && !error) {
        set((state) => ({
          trips: [...state.trips, data],
          activityBlocks: { ...state.activityBlocks, [data.id]: [] },
          activeTrip: state.activeTrip || data,
        }));
        return data as Trip;
      }
    } catch (error) {
      console.error('Error creating trip:', error);
    }
    return null;
  },

  setTripDestinationImage: async (tripId, imageUrl) => {
    try {
      const { error } = await supabase
        .from('trips')
        .update({ destination_image: imageUrl })
        .eq('id', tripId);

      if (error) {
        console.error('setTripDestinationImage update error:', error);
        return;
      }

      set((state) => ({
        trips: state.trips.map((trip) => (trip.id === tripId ? { ...trip, destination_image: imageUrl } : trip)),
        activeTrip:
          state.activeTrip?.id === tripId
            ? { ...state.activeTrip, destination_image: imageUrl }
            : state.activeTrip,
      }));
    } catch (error) {
      console.error('setTripDestinationImage exception:', error);
    }
  },

  deleteTrip: async (tripId: string) => {
    try {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) {
        console.error('Supabase delete error for trips:', error);
        return false;
      }
      set((state) => {
        const newTrips = state.trips.filter((t) => t.id !== tripId);
        const newActive = state.activeTrip?.id === tripId ? (newTrips.length > 0 ? newTrips[0] : null) : state.activeTrip;
        
        // Clean up blocks locally
        const newBlocks = { ...state.activityBlocks };
        delete newBlocks[tripId];
        
        return {
          trips: newTrips,
          activeTrip: newActive,
          activityBlocks: newBlocks,
        };
      });
      return true;
    } catch (e) {
      console.error('Supabase delete exception for trips:', e);
      return false;
    }
  },

  updateActivityBlock: async (blockId, updates) => {
    try {
      const { data, error } = await supabase
        .from('activity_blocks')
        .update(updates)
        .eq('id', blockId)
        .select()
        .single();
      if (data && !error) {
        const normalized = normalizeActivityBlock(data);
        set((state) => {
          const newBlocks = { ...state.activityBlocks };
          for (const tid of Object.keys(newBlocks)) {
            const idx = newBlocks[tid].findIndex(b => b.id === blockId);
            if (idx !== -1) {
              newBlocks[tid] = sortActivityBlocks([
                ...newBlocks[tid].slice(0, idx),
                normalized,
                ...newBlocks[tid].slice(idx + 1),
              ]);
              break;
            }
          }
          return { activityBlocks: newBlocks };
        });
        return normalized;
      }
      if (error) console.error('updateActivityBlock error:', error);
    } catch (e) {
      console.error('updateActivityBlock exception:', e);
    }
    return null;
  },

  deleteActivityBlock: async (blockId: string, tripId: string) => {
    try {
      const { error } = await supabase.from('activity_blocks').delete().eq('id', blockId);
      if (error) {
        console.error('Supabase delete error for activity_blocks:', error);
        return false;
      }
      set((state) => ({
        activityBlocks: {
          ...state.activityBlocks,
          [tripId]: (state.activityBlocks[tripId] || []).filter(b => b.id !== blockId),
        },
      }));
      return true;
    } catch (e) {
      console.error('Supabase delete exception for activity_blocks:', e);
      return false;
    }
  },

  addActivityBlock: async (block) => {
    const trip = get().trips.find((item) => item.id === block.trip_id);

    // ─── Step 1: Gemini place resolution + Google Places lookup ───
    // Skip if resolved_place_id already known (e.g. when inserting from suggestions)
    let resolvedBlock = { ...block };
    if (trip && block.place_name && !block.resolved_place_id) {
      try {
        const resolved = await resolvePlace({
          place_name: block.place_name,
          destination: trip.destination,
        });

        resolvedBlock = {
          ...resolvedBlock,
          resolved_place_id: resolved.resolved_place_id,
          resolved_place_name: resolved.resolved_place_name,
          resolved_lat: resolved.resolved_lat,
          resolved_lng: resolved.resolved_lng,
          activity_type: mapAgentTypeToActivityType(resolved.activity_type),
          // Override with Gemini's classification if not already set meaningfully
          energy_cost_estimate: resolved.energy_cost_estimate,
        };
      } catch (resolveErr) {
        console.warn('[addActivityBlock] Place resolution failed, continuing without:', resolveErr);
      }
    }

    // ─── Step 2: Persist via backend (falls back to direct Supabase) ───
    try {
      if (!trip) throw new Error('Trip not found for new activity block');
      const { activity_block } = await createActivityBlockViaBackend(resolvedBlock.trip_id, resolvedBlock);
      const normalized = normalizeActivityBlock(activity_block);
      set((state) => {
        const existing = state.activityBlocks[resolvedBlock.trip_id] || [];
        return {
          activityBlocks: {
            ...state.activityBlocks,
            [resolvedBlock.trip_id]: sortActivityBlocks([...existing, normalized]),
          },
        };
      });
      return normalized;
    } catch (backendError) {
      console.warn('Backend activity creation failed, falling back to direct Supabase:', backendError);
      const { data, error } = await supabase
        .from('activity_blocks')
        .insert([resolvedBlock])
        .select()
        .single();
      if (error) throw new Error(`Supabase insert failed: ${error.message} (code: ${error.code})`);
        if (data) {
          const normalized = normalizeActivityBlock(data);
          set((state) => {
            const existing = state.activityBlocks[resolvedBlock.trip_id] || [];
            return {
              activityBlocks: {
                ...state.activityBlocks,
                [resolvedBlock.trip_id]: sortActivityBlocks([...existing, normalized]),
              },
            };
          });
          return normalized;
      }
      return null;
    }
  },

  generateCuratedItinerary: async (tripId, options) => {
    const replaceExisting = !!options?.replaceExisting;
    const pace = options?.pace || 'balanced';
    const dayIndex = options?.dayIndex ?? 0;
    const slotCount = { light: 4, balanced: 6, packed: 8 }[pace];
    const trip = get().trips.find((item) => item.id === tripId);
    if (!trip) return null;

    const commitGeneratedBlocks = (blocks: any[]) => {
      const normalized = (blocks || []).map(normalizeActivityBlock);
      set((state) => {
        const currentTripBlocks = state.activityBlocks[tripId] || [];
        const existingIds = new Set(currentTripBlocks.map((item) => item.id));
        const merged = replaceExisting
          ? sortActivityBlocks(normalized)
          : sortActivityBlocks([...currentTripBlocks, ...normalized]);

        return {
          activityBlocks: {
            ...state.activityBlocks,
            [tripId]: merged,
          },
          checkIns: replaceExisting
            ? state.checkIns.filter((checkIn) => !existingIds.has(checkIn.activity_block_id))
            : state.checkIns,
        };
      });
      return normalized;
    };

    try {
      const { activity_blocks } = await curateTripItineraryViaBackend(tripId, {
        replace_existing: replaceExisting,
      });
      if (!Array.isArray(activity_blocks) || activity_blocks.length === 0) {
        throw new Error('No activities returned from backend curation');
      }
      return commitGeneratedBlocks(activity_blocks);
    } catch (backendError) {
      console.warn('Backend itinerary curation unavailable, using direct fallback:', backendError);
    }

    try {
      const candidates = await fetchDestinationPlaceCandidates(trip);
      if (candidates.length === 0) {
        throw new Error('No Google Places candidates found for this destination.');
      }
      let rowsToInsert = buildDeterministicCuratedRows(trip, candidates, dayIndex, slotCount);

      try {
        const geminiPlan = await callGemini<GeminiCuratedPlan>(buildMobileCurationPrompt(trip, candidates, pace, dayIndex));
        const geminiRows = normalizeGeminiCuratedRows(
          geminiPlan,
          trip,
          new Map(candidates.map((candidate) => [candidate.place_id, candidate])),
          dayIndex
        );
        if (geminiRows.length > 0) {
          rowsToInsert = geminiRows;
        }
      } catch (geminiError) {
        console.warn('Mobile Gemini candidate curation failed, using deterministic real-place plan:', geminiError);
      }

      if (replaceExisting) {
        const { error: deleteError } = await supabase
          .from('activity_blocks')
          .delete()
          .eq('trip_id', tripId);
        if (deleteError) {
          throw new Error(`Failed clearing existing blocks: ${deleteError.message}`);
        }
      } else {
        // Append mode: filter out duplicates and time overlaps with existing blocks
        const existingBlocks = get().activityBlocks[tripId] || [];
        const existingPlaceIds = new Set(existingBlocks.map((b) => b.resolved_place_id).filter(Boolean));
        rowsToInsert = rowsToInsert.filter((row) => {
          // Skip if same place already in itinerary
          if (row.resolved_place_id && existingPlaceIds.has(row.resolved_place_id)) return false;
          // Skip if time overlaps with an existing block on the same day
          const rowStart = toClockMinutes(row.start_time);
          const rowEnd = toClockMinutes(row.end_time);
          const sameDayExisting = existingBlocks.filter((b) => b.day_index === row.day_index);
          const overlaps = sameDayExisting.some((b) => {
            const bStart = toClockMinutes(b.start_time);
            const bEnd = toClockMinutes(b.end_time);
            return rowStart < bEnd && rowEnd > bStart;
          });
          return !overlaps;
        });
      }

      if (rowsToInsert.length === 0) {
        return commitGeneratedBlocks([]);
      }

      const { data, error } = await supabase
        .from('activity_blocks')
        .insert(rowsToInsert)
        .select('*');
      if (error) {
        throw new Error(`Fallback itinerary insert failed: ${error.message}`);
      }

      return commitGeneratedBlocks(data || []);
    } catch (fallbackError) {
      console.error('generateCuratedItinerary failed:', fallbackError);
      return null;
    }
  },

  startCheckIn: async ({ activityBlock, energyLevel, currentLat, currentLng }) => {
    const defaultFailure: CheckInFlowResult = {
      needs_rerouting: energyLevel <= 6,
      affirmation_message: energyLevel >= 7 ? "You're all set." : null,
      reasoning: '',
      suggestions: [],
      places_available: false,
    };

    // ─── Step 1: Create check-in record ───
    let checkInId: string | null = null;
    try {
      const { check_in } = await createCheckInViaBackend({
        activity_block_id: activityBlock.id,
        energy_level: energyLevel,
        current_lat: currentLat,
        current_lng: currentLng,
        agent_outcome: energyLevel >= 7 ? 'affirmed' : null,
        selected_place_id: null,
        selected_place_name: null,
      });

      set((state) => ({
        checkIns: [check_in, ...state.checkIns],
        energyLevel: null,
        latestCheckInId: check_in.id,
      }));
      checkInId = check_in.id;
    } catch (checkInErr) {
      console.warn('[startCheckIn] Backend check-in creation failed, trying direct Supabase:', checkInErr);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const { data: ci } = await supabase
            .from('check_ins')
            .insert([{
              activity_block_id: activityBlock.id,
              user_id: session.user.id,
              energy_level: energyLevel,
              current_lat: currentLat,
              current_lng: currentLng,
              agent_outcome: energyLevel >= 7 ? 'affirmed' : null,
              selected_place_id: null,
              selected_place_name: null,
            }])
            .select()
            .single();
          if (ci) {
            set((state) => ({
              checkIns: [ci as CheckIn, ...state.checkIns],
              energyLevel: null,
              latestCheckInId: ci.id,
            }));
            checkInId = ci.id;
          }
        }
      } catch (directErr) {
        console.error('[startCheckIn] Direct check-in creation also failed:', directErr);
      }
    }

    // ─── Step 2: Run Gemini classifier ───
    const { trips, activityBlocks, checkIns } = get();
    const trip = trips.find((t) => t.id === activityBlock.trip_id);

    // Gather today's remaining blocks for context
    const allTripBlocks = sortActivityBlocks(activityBlocks[activityBlock.trip_id] || []);
    const currentBlockIndex = allTripBlocks.findIndex((b) => b.id === activityBlock.id);
    const remainingBlocks =
      currentBlockIndex >= 0
        ? allTripBlocks.slice(currentBlockIndex + 1)
        : allTripBlocks.filter((b) => b.id !== activityBlock.id);

    const priorCheckins = checkIns.map((c) => ({
      activity_block_id: c.activity_block_id,
      energy_level: c.energy_level,
      timestamp: c.timestamp,
    }));

    let classifierResult;
    try {
      classifierResult = await classifyCheckIn({
        energy_level: energyLevel,
        current_time: new Date().toISOString(),
        current_block: {
          id: activityBlock.id,
          place_name: activityBlock.place_name,
          resolved_place_id: activityBlock.resolved_place_id,
          start_time: activityBlock.start_time,
          end_time: activityBlock.end_time,
        },
        remaining_blocks_today: remainingBlocks.map((b) => ({
          id: b.id,
          place_name: b.place_name,
          resolved_place_id: b.resolved_place_id,
          start_time: b.start_time,
          end_time: b.end_time,
        })),
        prior_checkins_this_trip: priorCheckins,
      });
    } catch (classifyErr) {
      console.warn('[startCheckIn] Classifier failed, using energy threshold:', classifyErr);
      classifierResult = {
        needs_rerouting: energyLevel <= 6,
        energy_gap: Math.max(0, 7 - energyLevel),
        affirmation_message: energyLevel >= 7 ? "You're doing great — enjoy your activity!" : null,
        reasoning: `Energy level ${energyLevel}/10`,
      };
    }

    // High energy — return affirmation
    if (!classifierResult.needs_rerouting) {
      return {
        needs_rerouting: false,
        affirmation_message: classifierResult.affirmation_message,
        reasoning: classifierResult.reasoning,
        suggestions: [],
        places_available: false,
      };
    }

    // ─── Step 3: Fetch nearby places + run ranker ───
    try {
      // First try backend suggestions endpoint
      try {
        const suggestionResponse = await requestSuggestionsFromBackend({
          activity_block_id: activityBlock.id,
          trip_id: activityBlock.trip_id,
          energy_level: energyLevel,
          current_lat: currentLat,
          current_lng: currentLng,
          current_time: new Date().toISOString(),
        });

        const baseSuggestions = (suggestionResponse.suggestions || []).map(mapSuggestion);
        const suggestions = await attachSuggestionImages(baseSuggestions);
        if (suggestions.length > 0) {
          set({ suggestions });
          return {
            needs_rerouting: suggestionResponse.needs_rerouting,
            affirmation_message: suggestionResponse.affirmation_message,
            reasoning: suggestionResponse.reasoning,
            suggestions,
            places_available: !!suggestionResponse._places_available,
          };
        }

        // If backend is reachable but has no candidates yet, continue to mobile fallback.
        console.warn('[startCheckIn] Backend returned no suggestions, falling back to mobile ranker path');
      } catch (backendSuggestErr) {
        console.warn('[startCheckIn] Backend suggestions failed, running mobile Gemini ranker:', backendSuggestErr);
      }

      // Fallback: fetch nearby places + run Gemini ranker directly on mobile
      const includedTypes = getNearbyIncludedTypesForActivity(activityBlock.activity_type);
      const nearbyPlaces = await fetchNearbyPlaces(currentLat, currentLng, 3000, includedTypes);
      const candidates: NearbyPlaceCandidate[] = nearbyPlaces.map((p) => {
        const mappedType = mapGoogleTypesToAgentType(p.types);
        return {
          place_id: p.placeId,
          name: p.name,
          activity_type: mappedType,
          estimated_energy: estimateEnergyForAgentType(mappedType),
          distance_meters: p.distanceMeters,
          rating: p.rating,
        };
      });

      if (candidates.length === 0) {
        return {
          needs_rerouting: true,
          affirmation_message: null,
          reasoning: classifierResult.reasoning,
          suggestions: [],
          places_available: false,
        };
      }

      // Calculate time remaining in current block
      const now = new Date();
      const blockEnd = new Date(activityBlock.end_time);
      const timeRemainingMinutes = Math.max(
        0,
        Math.round((blockEnd.getTime() - now.getTime()) / 60000)
      );

      // Find next block to compute available window
      const sortedRemaining = [...remainingBlocks].sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      );
      const nextBlock = sortedRemaining[0] ?? null;
      const blockEndHHMM = normalizeTime(activityBlock.end_time);
      const nextStartHHMM = nextBlock ? normalizeTime(nextBlock.start_time) : null;
      let available_window_minutes = 0;
      if (nextStartHHMM) {
        const [nh, nm] = nextStartHHMM.split(':').map(Number);
        const [eh, em] = blockEndHHMM.split(':').map(Number);
        available_window_minutes = Math.max(0, ((nh ?? 0) * 60 + (nm ?? 0)) - ((eh ?? 0) * 60 + (em ?? 0)));
      }

      const rankerResult = await rankAlternatives({
        current_activity_type: mapUiTypeToAgentType(activityBlock.activity_type),
        energy_level: energyLevel,
        energy_gap: classifierResult.energy_gap,
        time_remaining_minutes: timeRemainingMinutes,
        destination: trip?.destination || '',
        candidates,
        travel_vibes: trip?.travel_vibes ?? [],
        available_window_minutes,
        remaining_activities: remainingBlocks.map((b) => ({
          place_name: b.place_name,
          start_time: b.start_time,
          energy_cost_estimate: b.energy_cost_estimate ?? 5,
        })),
      });

      // Convert ranked suggestions to ActivitySuggestion format
      const baseSuggestions: ActivitySuggestion[] = rankerResult.suggestions.map((s) => {
        const nearbyMatch = nearbyPlaces.find((p) => p.placeId === s.place_id);
        return {
          place_id: s.place_id,
          place_name: s.name,
          address: nearbyMatch?.address || '',
          maps_url: nearbyMatch?.mapsUrl || `https://maps.google.com/search/?api=1&query=${encodeURIComponent(s.name)}`,
          energy_cost_label:
            s.estimated_energy <= 3 ? 'very low' : s.estimated_energy <= 5 ? 'low' : 'moderate',
          why_it_fits: s.reason,
          distance_km: Math.round((nearbyMatch?.distanceMeters ?? 0) / 100) / 10,
          estimated_duration_minutes: 60,
        };
      });

      const suggestions = await attachSuggestionImages(baseSuggestions);

      set({ suggestions });

      return {
        needs_rerouting: true,
        affirmation_message: null,
        reasoning: classifierResult.reasoning,
        suggestions,
        places_available: true,
      };
    } catch (error) {
      console.error('[startCheckIn] Full check-in flow error:', error);
      set({ suggestions: [] });
      return defaultFailure;
    }
  },

  updateSuggestionOutcome: async ({ agent_outcome, selected_place_id = null, selected_place_name = null }) => {
    const { latestCheckInId } = get();
    if (!latestCheckInId) {
      set({ suggestions: [] });
      return;
    }

    try {
      const { check_in } = await updateCheckInOutcomeViaBackend(latestCheckInId, {
        agent_outcome,
        selected_place_id,
        selected_place_name,
      });

      set((state) => ({
        checkIns: state.checkIns.map((item) => (item.id === check_in.id ? check_in : item)),
        suggestions: [],
        latestCheckInId: null,
      }));
    } catch (backendErr) {
      console.warn('[updateSuggestionOutcome] Backend update failed, trying direct Supabase:', backendErr);
      // Fallback: direct Supabase PATCH
      try {
        const { data } = await supabase
          .from('check_ins')
          .update({ agent_outcome, selected_place_id, selected_place_name })
          .eq('id', latestCheckInId)
          .select()
          .single();

        if (data) {
          set((state) => ({
            checkIns: state.checkIns.map((item) =>
              item.id === latestCheckInId ? (data as CheckIn) : item
            ),
          }));
        }
      } catch (directErr) {
        console.error('[updateSuggestionOutcome] Direct Supabase update failed:', directErr);
      }
      set({ suggestions: [], latestCheckInId: null });
    }

  },

  compactifyDay: async (tripId: string, dayIndex: number) => {
    const { activityBlocks, trips, checkIns } = get();
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return null;

    const allBlocks = sortActivityBlocks(activityBlocks[tripId] || []);
    const dayBlocks = allBlocks.filter((b) => b.day_index === dayIndex);
    if (dayBlocks.length <= 1) return null;

    const tripCheckIns = checkIns.filter((c) =>
      allBlocks.some((b) => b.id === c.activity_block_id)
    );
    const avgEnergy = tripCheckIns.length > 0
      ? tripCheckIns.reduce((sum, c) => sum + c.energy_level, 0) / tripCheckIns.length
      : 5;

    const activitiesJson = dayBlocks.map((b) => ({
      id: b.id,
      place_name: b.place_name,
      activity_type: b.activity_type,
      start_time: b.start_time,
      end_time: b.end_time,
      energy_cost_estimate: b.energy_cost_estimate ?? 5,
    }));

    const prompt = `You are Roamio AI, a travel wellness assistant helping an overwhelmed traveler simplify their day.

CONTEXT:
- Destination: ${trip.destination}
- Travel vibes: ${(trip.travel_vibes ?? []).join(', ') || 'not specified'}
- Day ${dayIndex + 1} of their trip
- Average energy level across check-ins: ${avgEnergy.toFixed(1)}/10
- Number of recent low-energy check-ins: ${tripCheckIns.filter((c) => c.energy_level <= 4).length}

TODAY'S ACTIVITIES (${dayBlocks.length} total):
${JSON.stringify(activitiesJson, null, 2)}

TASK:
The traveler is feeling overwhelmed. Simplify their day by deciding which activities to KEEP and which to DROP.

Rules:
- Keep the activities that best match their travel vibes and are most essential to the destination experience
- Drop activities that are high-energy, redundant, or less important
- Aim to keep roughly 50-70% of activities — enough to still have a great day without burnout
- Never drop ALL activities
- Be warm and human in your reasoning — this person is stressed in a foreign country

Return ONLY valid JSON in this exact format:
{
  "items": [
    { "id": "<activity id>", "place_name": "<name>", "action": "keep", "reason": "short reason" },
    { "id": "<activity id>", "place_name": "<name>", "action": "drop", "reason": "short reason" }
  ],
  "summary": "A warm 1-2 sentence message explaining the simplified day, with a touch of humor or reassurance"
}`;

    try {
      const result = await callGemini<CompactifyResult>(prompt);
      if (!result?.items || !Array.isArray(result.items)) return null;

      // Merge times from actual blocks
      const enriched: CompactifyItem[] = result.items.map((item) => {
        const block = dayBlocks.find((b) => b.id === item.id);
        return {
          ...item,
          start_time: block?.start_time ?? '',
          end_time: block?.end_time ?? '',
        };
      });

      return { items: enriched, summary: result.summary || '' };
    } catch (err) {
      console.error('[compactifyDay] Gemini failed:', err);
      // Fallback: drop the highest energy-cost activities
      const sorted = [...dayBlocks].sort(
        (a, b) => (b.energy_cost_estimate ?? 5) - (a.energy_cost_estimate ?? 5)
      );
      const dropCount = Math.max(1, Math.floor(sorted.length * 0.35));
      const dropIds = new Set(sorted.slice(0, dropCount).map((b) => b.id));

      const items: CompactifyItem[] = dayBlocks.map((b) => ({
        id: b.id,
        place_name: b.place_name,
        start_time: b.start_time,
        end_time: b.end_time,
        action: dropIds.has(b.id) ? 'drop' as const : 'keep' as const,
        reason: dropIds.has(b.id) ? 'High energy cost — save it for a better day' : 'Fits your vibe',
      }));

      return {
        items,
        summary: "We trimmed the most draining activities so you can breathe. You've still got a great day ahead.",
      };
    }
  },
}));
