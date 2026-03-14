import { create } from 'zustand';
import type { User, Trip, ActivityBlock, CheckIn, ActivitySuggestion } from '../types';
import {
  MOCK_USER,
  MOCK_TRIPS,
  MOCK_ACTIVITY_BLOCKS,
  MOCK_CHECKINS,
  MOCK_SUGGESTIONS,
} from '../lib/mock-data';

interface TripStore {
  user: User;
  trips: Trip[];
  activeTrip: Trip | null;
  activityBlocks: Record<string, ActivityBlock[]>;
  checkIns: CheckIn[];
  energyLevel: number | null;
  suggestions: ActivitySuggestion[];

  // Actions
  setActiveTrip: (trip: Trip | null) => void;
  setEnergyLevel: (level: number) => void;
  addTrip: (trip: Trip) => void;
  addActivityBlock: (block: ActivityBlock) => void;
  submitCheckIn: (checkIn: CheckIn) => void;
}

export const useTripStore = create<TripStore>((set) => ({
  user: MOCK_USER,
  trips: MOCK_TRIPS,
  activeTrip: MOCK_TRIPS[0],
  activityBlocks: MOCK_ACTIVITY_BLOCKS,
  checkIns: MOCK_CHECKINS,
  energyLevel: null,
  suggestions: MOCK_SUGGESTIONS,

  setActiveTrip: (trip) => set({ activeTrip: trip }),

  setEnergyLevel: (level) => set({ energyLevel: level }),

  addTrip: (trip) =>
    set((state) => ({
      trips: [...state.trips, trip],
      activityBlocks: { ...state.activityBlocks, [trip.id]: [] },
    })),

  addActivityBlock: (block) =>
    set((state) => {
      const existing = state.activityBlocks[block.trip_id] || [];
      return {
        activityBlocks: {
          ...state.activityBlocks,
          [block.trip_id]: [...existing, block],
        },
      };
    }),

  submitCheckIn: (checkIn) =>
    set((state) => ({
      checkIns: [...state.checkIns, checkIn],
      energyLevel: null,
    })),
}));