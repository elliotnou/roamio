import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { ActivityBlock, ActivitySuggestion, CheckIn } from '../types';

const DEFAULT_BACKEND_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No authenticated session available for backend request');
  }

  return session.access_token;
}

async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Backend request failed: ${response.status}`);
  }

  return payload as T;
}

export interface BackendCheckInResponse {
  check_in: CheckIn;
  battery_curve?: unknown;
}

export interface BackendSuggestionsResponse {
  needs_rerouting: boolean;
  energy_gap: number;
  affirmation_message: string | null;
  reasoning: string;
  suggestions: ActivitySuggestion[];
  _places_available?: boolean;
}

export async function createActivityBlockViaBackend(
  tripId: string,
  payload: Omit<ActivityBlock, 'id'>
) {
  return backendFetch<{ activity_block: ActivityBlock }>(`/trips/${tripId}/blocks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createCheckInViaBackend(
  payload: Omit<CheckIn, 'id' | 'timestamp' | 'user_id'>
) {
  return backendFetch<BackendCheckInResponse>('/checkins', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestSuggestionsFromBackend(payload: {
  activity_block_id: string;
  trip_id: string;
  energy_level: number;
  current_lat: number;
  current_lng: number;
  current_time?: string;
}) {
  return backendFetch<BackendSuggestionsResponse>('/suggestions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCheckInOutcomeViaBackend(
  checkInId: string,
  payload: Pick<CheckIn, 'agent_outcome' | 'selected_place_id' | 'selected_place_name'>
) {
  return backendFetch<{ check_in: CheckIn }>(`/checkins/${checkInId}/outcome`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
