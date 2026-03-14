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
  deleteTrip: (tripId: string) => Promise<boolean>;
  addActivityBlock: (block: Omit<ActivityBlock, 'id' | 'created_at'>) => Promise<ActivityBlock | null>;
  deleteActivityBlock: (blockId: string, tripId: string) => Promise<boolean>;
  updateActivityBlock: (blockId: string, updates: Partial<Pick<ActivityBlock, 'place_name' | 'start_time' | 'end_time' | 'activity_type' | 'energy_cost_estimate'>>) => Promise<ActivityBlock | null>;
  submitCheckIn: (checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => Promise<boolean>;
}

async function ensureUserProfile(sessionUser: { id: string; email?: string | null; user_metadata?: Record<string, any> }) {
  console.log('ensureUserProfile: ensuring user exists for', sessionUser.id);
  const payload = {
    id: sessionUser.id,
    email: sessionUser.email || '',
    display_name: sessionUser.user_metadata?.display_name || null,
  };

  try {
    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' }).select();
    if (error) {
      console.error('ensureUserProfile: failed to upsert user profile:', error.message);
      // We don't throw here because if RLS fails (e.g. they already exist but can't update),
      // we don't want to completely block login.
    } else {
      console.log('ensureUserProfile: user profile ensured.');
    }
  } catch (err) {
    console.error('ensureUserProfile: exception caught:', err);
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