import { create } from 'zustand';
import type { User, Trip, ActivityBlock, CheckIn, ActivitySuggestion } from '../types';
import { supabase } from '../lib/supabase';
import {
  createActivityBlockViaBackend,
  createCheckInViaBackend,
  requestSuggestionsFromBackend,
  updateCheckInOutcomeViaBackend,
} from '../lib/backend';

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
  addActivityBlock: (block: Omit<ActivityBlock, 'id'>) => Promise<ActivityBlock | null>;
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

  addActivityBlock: async (block) => {
    const trip = get().trips.find((item) => item.id === block.trip_id);

    try {
      if (!trip) throw new Error('Trip not found for new activity block');
      const { activity_block } = await createActivityBlockViaBackend(block.trip_id, block);
      const normalized = normalizeActivityBlock(activity_block);
      set((state) => {
        const existing = state.activityBlocks[block.trip_id] || [];
        return {
          activityBlocks: {
            ...state.activityBlocks,
            [block.trip_id]: [...existing, normalized],
          },
        };
      });
      return normalized;
    } catch (backendError) {
      console.warn('Backend activity creation failed, falling back to direct Supabase:', backendError);
      try {
        const { data, error } = await supabase.from('activity_blocks').insert([block]).select().single();
        if (data && !error) {
          const normalized = normalizeActivityBlock(data);
          set((state) => {
            const existing = state.activityBlocks[block.trip_id] || [];
            return {
              activityBlocks: {
                ...state.activityBlocks,
                [block.trip_id]: [...existing, normalized],
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

      const suggestionResponse = await requestSuggestionsFromBackend({
        activity_block_id: activityBlock.id,
        trip_id: activityBlock.trip_id,
        energy_level: energyLevel,
        current_lat: currentLat,
        current_lng: currentLng,
        current_time: new Date().toISOString(),
      });

      const suggestions = (suggestionResponse.suggestions || []).map(mapSuggestion);
      set({ suggestions });

      return {
        needs_rerouting: suggestionResponse.needs_rerouting,
        affirmation_message: suggestionResponse.affirmation_message,
        reasoning: suggestionResponse.reasoning,
        suggestions,
        places_available: !!suggestionResponse._places_available,
      };
    } catch (error) {
      console.error('Check-in flow failed:', error);
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
    } catch (error) {
      console.error('Failed to update suggestion outcome:', error);
      set({ suggestions: [], latestCheckInId: null });
    }
  },
}));
