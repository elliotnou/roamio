'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTripStore } from '@/store/trip-store';
import { getDayCount } from '@/lib/utils';
import { ArrowLeft, MapPin, Clock, Sparkles } from 'lucide-react';
import type { ActivityBlock } from '@/types';

export default function ItineraryPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const { trips, addActivityBlock } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);
  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 1;

  const [dayIndex, setDayIndex] = useState(0);
  const [placeName, setPlaceName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const newBlock: ActivityBlock = {
      id: `block-${Date.now()}`,
      trip_id: tripId,
      day_index: dayIndex,
      place_name: placeName,
      resolved_place_id: null,
      resolved_place_name: placeName,
      resolved_lat: null,
      resolved_lng: null,
      activity_type: 'other',
      energy_cost_estimate: 5,
      start_time: startTime,
      end_time: endTime,
    };

    addActivityBlock(newBlock);
    router.push(`/trips/${tripId}`);
  };

  if (!trip) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 text-center">
        <p className="text-slate-500">Trip not found.</p>
        <Link href="/trips" className="text-indigo-600 font-semibold">Back to Trips</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/trips/${tripId}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Add Activity</h1>
          <p className="text-slate-500 text-xs mt-0.5">{trip.destination}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Day selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Which Day?
            </label>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: dayCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDayIndex(i)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    dayIndex === i
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
                >
                  Day {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Place name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Place Name
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="e.g. Banff Upper Hot Springs"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                required
              />
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Time
              </label>
              <div className="relative">
                <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                End Time
              </label>
              <div className="relative">
                <Clock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* AI note */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 flex gap-3">
            <Sparkles size={18} className="text-violet-500 shrink-0 mt-0.5" />
            <p className="text-violet-700 text-sm leading-relaxed">
              Our AI will automatically classify this activity and estimate its energy demand — so TripPulse can adapt your day in real time.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 hover:from-indigo-700 hover:to-violet-700 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Adding activity...
              </span>
            ) : (
              'Add to Itinerary'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
