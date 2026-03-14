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
} from '../lib/backend';
import { resolvePlace } from '../lib/agent/resolve';
import { classifyCheckIn } from '../lib/agent/classifier';
import { rankAlternatives } from '../lib/agent/ranker';
import { fetchNearbyPlaces } from '../lib/places';

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
  deleteTrip: (tripId: string) => Promise<boolean>;
  addActivityBlock: (block: Omit<ActivityBlock, 'id'>) => Promise<ActivityBlock | null>;
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
      const { data: blocks } = await supabase.from('activity_blocks').select('*').in('trip_id', tripIds);
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
        set((state) => {
          const newBlocks = { ...state.activityBlocks };
          for (const tid of Object.keys(newBlocks)) {
            const idx = newBlocks[tid].findIndex(b => b.id === blockId);
            if (idx !== -1) {
              newBlocks[tid] = [...newBlocks[tid].slice(0, idx), data, ...newBlocks[tid].slice(idx + 1)];
              break;
            }
          }
          return { activityBlocks: newBlocks };
        });
        return data as ActivityBlock;
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
    let resolvedBlock = { ...block };
    if (trip && block.place_name) {
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
            [resolvedBlock.trip_id]: [...existing, normalized],
          },
        };
      });
      return normalized;
    } catch (backendError) {
      console.warn('Backend activity creation failed, falling back to direct Supabase:', backendError);
      try {
        const { data, error } = await supabase
          .from('activity_blocks')
          .insert([resolvedBlock])
          .select()
          .single();
        if (data && !error) {
          const normalized = normalizeActivityBlock(data);
          set((state) => {
            const existing = state.activityBlocks[resolvedBlock.trip_id] || [];
            return {
              activityBlocks: {
                ...state.activityBlocks,
                [resolvedBlock.trip_id]: [...existing, normalized],
              },
            };
          });
          return normalized;
        }
      } catch (fallbackError) {
        console.error('Direct Supabase activity creation failed:', fallbackError);
      }
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
    const allTripBlocks = activityBlocks[activityBlock.trip_id] || [];
    const remainingBlocks = allTripBlocks.filter(
      (b) =>
        b.id !== activityBlock.id &&
        b.start_time > activityBlock.start_time
    );

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

        const suggestions = (suggestionResponse.suggestions || []).map(mapSuggestion);
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

      const rankerResult = await rankAlternatives({
        current_activity_type: mapUiTypeToAgentType(activityBlock.activity_type),
        energy_level: energyLevel,
        energy_gap: classifierResult.energy_gap,
        time_remaining_minutes: timeRemainingMinutes,
        destination: trip?.destination || '',
        candidates,
      });

      // Convert ranked suggestions to ActivitySuggestion format
      const suggestions: ActivitySuggestion[] = rankerResult.suggestions.map((s) => {
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
}));
