export type ActivityType =
  | 'hiking' | 'walking' | 'cycling'
  | 'museum' | 'gallery' | 'landmark'
  | 'restaurant' | 'cafe'
  | 'shopping' | 'market'
  | 'spa' | 'park' | 'beach'
  | 'other';

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  created_at: string;
  destination_image?: string;
}

export interface ActivityBlock {
  id: string;
  trip_id: string;
  day_index: number;
  place_name: string;
  resolved_place_id: string | null;
  resolved_place_name: string | null;
  resolved_lat: number | null;
  resolved_lng: number | null;
  activity_type: ActivityType;
  energy_cost_estimate: number;
  start_time: string;
  end_time: string;
  end_time: string;
}

export interface CheckIn {
  id: string;
  activity_block_id: string;
  user_id: string;
  energy_level: number;
  current_lat: number;
  current_lng: number;
  agent_outcome: 'affirmed' | 'rerouted' | 'dismissed';
  selected_place_id: string | null;
  selected_place_name: string | null;
  timestamp: string;
}

export interface ActivitySuggestion {
  place_id: string;
  place_name: string;
  address: string;
  maps_url: string;
  energy_cost_label: 'very low' | 'low' | 'moderate';
  why_it_fits: string;
  distance_km: number;
  estimated_duration_minutes: number;
  image_url?: string;
}