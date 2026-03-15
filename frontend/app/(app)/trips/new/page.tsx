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
    <div className="max-w-md mx-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/trips"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow-md transition-all"
        >
          <ArrowLeft size={18} className="text-[#1A1A1A]" />
        </Link>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Plan a New Trip</h1>
      </div>

      <div className="bg-white rounded-3xl shadow-sm p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-[#f5ddd4] border border-[#e8c4b8] rounded-2xl text-[#8a4a40] text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
              Destination
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ADADAD]" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Banff, Alberta"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#E5E0D8] bg-[#FAF8F5] text-[#1A1A1A] placeholder-[#ADADAD] focus:outline-none focus:ring-2 focus:ring-[#8B9A7B]/40 focus:border-[#8B9A7B] transition-all text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                Start Date
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#ADADAD]" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-3.5 rounded-2xl border border-[#E5E0D8] bg-[#FAF8F5] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#8B9A7B]/40 focus:border-[#8B9A7B] transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                End Date
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#ADADAD]" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="w-full pl-10 pr-3 py-3.5 rounded-2xl border border-[#E5E0D8] bg-[#FAF8F5] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#8B9A7B]/40 focus:border-[#8B9A7B] transition-all text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* AI hint */}
          <div className="bg-[#e8ede4] rounded-2xl p-4">
            <p className="text-[#5a6b4e] text-sm leading-relaxed">
              After creating your trip, you can add activities. Roamio will automatically estimate energy costs and adapt your itinerary in real time.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#2C2C2C] text-white font-semibold rounded-full shadow-sm hover:bg-[#1A1A1A] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
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
