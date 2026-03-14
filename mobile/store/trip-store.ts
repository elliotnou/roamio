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
  submitCheckIn: (checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => Promise<boolean>;
}

async function ensureUserProfile(sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any> }) {
  const payload = {
    id: sessionUser.id,
    email: sessionUser.email || '',
    display_name: sessionUser.user_metadata?.display_name || null,
  };

  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw new Error(`Failed to ensure user profile: ${error.message}`);
  }
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
      console.log('fetchData: getting session...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { 
        console.log('fetchData: no session, exiting.');
        set({ isLoading: false }); return; 
      }

      const userId = session.user.id;
      await ensureUserProfile(session.user);
      
      console.log('fetchData: session found API: ', userId);
      set({ user: { id: userId, email: session.user.email || '', display_name: session.user.user_metadata?.display_name || '', created_at: new Date().toISOString() } });

      console.log('fetchData: fetching trips...');
      const { data: trips, error: tripsError } = await supabase.from('trips').select('*').eq('user_id', userId).order('start_date', { ascending: true });
      if (tripsError) {
        console.error('fetchData: trips query error:', tripsError);
        throw new Error(`Failed to fetch trips: ${tripsError.message}`);
      }
      
      const safeTrips = trips || [];
      const tripIds = safeTrips.map(t => t.id);
      
      let blocks: any[] = [];
      if (tripIds.length > 0) {
        console.log('fetchData: fetching blocks...');
        const { data, error: blocksError } = await supabase.from('activity_blocks').select('*').in('trip_id', tripIds);
        if (blocksError) {
          console.error('fetchData: blocks query error:', blocksError);
          throw new Error(`Failed to fetch activity blocks: ${blocksError.message}`);
        }
        if (data) blocks = data;
      }

      console.log('fetchData: fetching checkins...');
      const { data: checkIns, error: checkInsError } = await supabase.from('check_ins').select('*').eq('user_id', userId);
      if (checkInsError) {
        console.error('fetchData: check_ins query error:', checkInsError);
        throw new Error(`Failed to fetch check-ins: ${checkInsError.message}`);
      }

      const blocksMap: Record<string, ActivityBlock[]> = {};
      safeTrips.forEach(t => { blocksMap[t.id] = [] });
      
      blocks.forEach(b => {
        if (!blocksMap[b.trip_id]) blocksMap[b.trip_id] = [];
        blocksMap[b.trip_id].push(b);
      });

      console.log('fetchData: updating state');
      set({
        trips: safeTrips,
        activeTrip: safeTrips.length > 0 ? safeTrips[0] : null,
        activityBlocks: blocksMap,
        checkIns: checkIns || [],
      });
      console.log('fetchData: success!');
    } catch (e) {
      console.error('fetchData: Error in fetchData exception:', e);
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
      if (session) {
        userId = session.user.id;
        await ensureUserProfile(session.user);
      }
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
      if (error) {
        console.error('Supabase insert error for trips:', error);
      }
    } catch (e) {
      console.error('Supabase insert exception for trips:', e);
    }
    return null;
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
    return null;
  },

  submitCheckIn: async (checkIn) => {
    let userId = get().user?.id;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        userId = session.user.id;
        await ensureUserProfile(session.user);
      }
    } catch {}
    if (!userId) return false;
    
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
        return true;
      } else {
        console.error("Supabase insert error for check_ins:", error);
      }
    } catch (err) {
      console.error("Supabase insert exception for check_ins:", err);
    }
    return false;
  },
}));