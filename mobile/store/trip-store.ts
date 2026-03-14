import { create } from 'zustand';
import type { User, Trip, ActivityBlock, CheckIn, ActivitySuggestion } from '../types';
import { supabase } from '../lib/supabase';

// Mock suggestions are kept for Gemini integration later
import { MOCK_SUGGESTIONS } from '../lib/mock-data';

interface TripStore {
  user: User;
  trips: Trip[];
  activeTrip: Trip | null;
  activityBlocks: Record<string, ActivityBlock[]>;
  checkIns: CheckIn[];
  energyLevel: number | null;
  suggestions: ActivitySuggestion[];
  isLoading: boolean;

  // Actions
  fetchData: () => Promise<void>;
  setUser: (user: User | null) => void;
  setActiveTrip: (trip: Trip | null) => void;
  setEnergyLevel: (level: number) => void;
  addTrip: (trip: Omit<Trip, 'id' | 'created_at'>) => Promise<Trip | null>;
  addActivityBlock: (block: Omit<ActivityBlock, 'id' | 'created_at'>) => Promise<ActivityBlock | null>;
  submitCheckIn: (checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => Promise<void>;
}

export const useTripStore = create<TripStore>((set, get) => ({
  user: null as any, // populated via fetchData
  trips: [],
  activeTrip: null,
  activityBlocks: {},
  checkIns: [],
  energyLevel: null,
  suggestions: MOCK_SUGGESTIONS,
  isLoading: true,

  setUser: (user) => set({ user: user as any }),

  fetchData: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { set({ isLoading: false }); return; }

      const userId = session.user.id;
      set({ user: { id: userId, email: session.user.email || '', display_name: session.user.user_metadata?.display_name || '', created_at: new Date().toISOString() } });

      const { data: trips } = await supabase.from('trips').select('*').eq('user_id', userId).order('start_date', { ascending: true });
      if (!trips) return;
      
      const tripIds = trips.map(t => t.id);
      
      let blocks: any[] = [];
      if (tripIds.length > 0) {
        const { data } = await supabase.from('activity_blocks').select('*').in('trip_id', tripIds);
        if (data) blocks = data;
      }

      const { data: checkIns } = await supabase.from('check_ins').select('*').eq('user_id', userId);

      const blocksMap: Record<string, ActivityBlock[]> = {};
      trips.forEach(t => { blocksMap[t.id] = [] });
      
      blocks.forEach(b => {
        if (!blocksMap[b.trip_id]) blocksMap[b.trip_id] = [];
        blocksMap[b.trip_id].push(b);
      });

      set({
        trips,
        activeTrip: trips.length > 0 ? trips[0] : null,
        activityBlocks: blocksMap,
        checkIns: checkIns || [],
      });
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveTrip: (trip) => set({ activeTrip: trip }),

  setEnergyLevel: (level) => set({ energyLevel: level }),

  addTrip: async (trip) => {
    let userId = get().user?.id;
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
        return data;
      }
    } catch {}
    // Fallback: create locally if Supabase fails (dev mode)
    const localTrip = { ...dbTrip, id: 'local-' + Date.now(), created_at: new Date().toISOString() } as any;
    set((state) => ({
      trips: [...state.trips, localTrip],
      activityBlocks: { ...state.activityBlocks, [localTrip.id]: [] },
      activeTrip: state.activeTrip || localTrip,
    }));
    return localTrip;
  },

  addActivityBlock: async (block) => {
    try {
      const { data, error } = await supabase.from('activity_blocks').insert([block]).select().single();
      if (data && !error) {
        set((state) => {
          const existing = state.activityBlocks[block.trip_id] || [];
          return {
            activityBlocks: {
              ...state.activityBlocks,
              [block.trip_id]: [...existing, data],
            },
          };
        });
        return data;
      } else if (error) {
        console.error("Supabase insert error for activity_blocks:", error);
      }
    } catch (e) {
      console.error("Supabase insert exception for activity_blocks:", e);
    }
    // Fallback: create locally
    const localBlock = { ...block, id: 'local-' + Date.now(), created_at: new Date().toISOString() } as any;
    set((state) => {
      const existing = state.activityBlocks[block.trip_id] || [];
      return {
        activityBlocks: {
          ...state.activityBlocks,
          [block.trip_id]: [...existing, localBlock],
        },
      };
    });
    return localBlock;
  },

  submitCheckIn: async (checkIn) => {
    let userId = get().user?.id;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) userId = session.user.id;
    } catch {}
    if (!userId) return;
    
    const dbCheckIn = { 
      activity_block_id: checkIn.activity_block_id,
      user_id: userId,
      energy_level: checkIn.energy_level,
      current_lat: checkIn.current_lat,
      current_lng: checkIn.current_lng,
      agent_outcome: checkIn.agent_outcome,
      selected_place_id: checkIn.selected_place_id || null,
      selected_place_name: checkIn.selected_place_name || null 
    };

    try {
      const { data, error } = await supabase.from('check_ins').insert([dbCheckIn]).select().single();
      if (data && !error) {
        set((state) => ({
          checkIns: [...state.checkIns, data],
          energyLevel: null,
        }));
        return;
      } else {
        console.error("Supabase insert error for check_ins:", error);
      }
    } catch (err) {
      console.error("Supabase insert exception for check_ins:", err);
    }
    // Fallback: store locally
    const localCheckIn = { ...dbCheckIn, id: 'local-' + Date.now(), timestamp: new Date().toISOString() } as any;
    set((state) => ({
      checkIns: [...state.checkIns, localCheckIn],
      energyLevel: null,
    }));
  },
}));