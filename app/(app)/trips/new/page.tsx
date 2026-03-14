'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTripStore } from '@/store/trip-store';
import { ArrowLeft, MapPin, Calendar } from 'lucide-react';

export default function NewTripPage() {
  const router = useRouter();
  const { addTrip, user } = useTripStore();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be on or after start date');
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    const newTrip = {
      id: `trip-${Date.now()}`,
      user_id: user.id,
      destination,
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString(),
    };

    addTrip(newTrip);
    router.push(`/trips/${newTrip.id}`);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/trips"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Plan a New Trip</h1>
          <p className="text-slate-500 text-xs mt-0.5">Let&apos;s map your next adventure</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Destination */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Destination
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Banff, Alberta"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                required
              />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* AI hint */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-indigo-700 text-sm font-medium mb-1">✨ AI-powered planning</p>
            <p className="text-indigo-600 text-xs leading-relaxed">
              After creating your trip, you can add activities. TripPulse will automatically estimate energy costs and adapt your itinerary in real time based on how you feel.
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
                Creating trip...
              </span>
            ) : (
              'Create Trip'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
