'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTripStore } from '@/store/trip-store';
import {
  formatDate,
  getDayCount,
  formatTimeRange,
  getActivityEmoji,
  getEnergyColor,
  getEnergyLabel,
} from '@/lib/utils';
import { ArrowLeft, Plus, Calendar, MapPin } from 'lucide-react';

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trips, activityBlocks, checkIns } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);
  const blocks = activityBlocks[tripId] || [];
  const checkedInIds = new Set(checkIns.map((c) => c.activity_block_id));

  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 0;
  const [selectedDay, setSelectedDay] = useState(0);

  const dayBlocks = blocks
    .filter((b) => b.day_index === selectedDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (!trip) {
    return (
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Trip not found</h2>
          <Link href="/trips" className="text-indigo-600 font-semibold hover:underline">
            Back to My Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/trips"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 truncate">{trip.destination}</h1>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
            <Calendar size={11} />
            <span>{formatDate(trip.start_date)} – {formatDate(trip.end_date)}</span>
          </div>
        </div>
      </div>

      {/* Trip hero card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 shadow-lg shadow-indigo-200 text-white mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-indigo-200 text-sm mb-1">
              <MapPin size={13} />
              <span>{trip.destination}</span>
            </div>
            <div className="text-2xl font-black">{dayCount} Days</div>
            <div className="text-indigo-200 text-sm">{blocks.length} activities planned</div>
          </div>
          <div className="text-5xl opacity-80">🏔️</div>
        </div>
      </div>

      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {Array.from({ length: dayCount }, (_, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              selectedDay === i
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-600 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            Day {i + 1}
          </button>
        ))}
      </div>

      {/* Activity blocks */}
      {dayBlocks.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-base font-bold text-slate-700 mb-1.5">Nothing planned yet</h3>
          <p className="text-slate-500 text-sm mb-4">Add activities to fill Day {selectedDay + 1}</p>
          <Link
            href={`/trips/${tripId}/itinerary`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={15} />
            Add Activity
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-slate-100" />
            <div className="space-y-3">
              {dayBlocks.map((block, idx) => {
                const isCheckedIn = checkedInIds.has(block.id);

                return (
                  <div key={block.id} className="flex gap-3">
                    {/* Timeline dot */}
                    <div className="relative z-10 shrink-0 w-10 h-10 flex items-center justify-center">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm ${
                          isCheckedIn ? 'bg-emerald-50 ring-2 ring-emerald-200' : 'bg-white ring-1 ring-slate-100'
                        }`}
                      >
                        {getActivityEmoji(block.activity_type)}
                      </div>
                    </div>

                    {/* Card */}
                    <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{block.place_name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {formatTimeRange(block.start_time, block.end_time)}
                          </p>
                          {block.resolved_place_name && block.resolved_place_name !== block.place_name && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin size={10} className="text-slate-300 shrink-0" />
                              <p className="text-xs text-slate-400 truncate">{block.resolved_place_name}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getEnergyColor(block.energy_cost_estimate)}`}>
                            {getEnergyLabel(block.energy_cost_estimate)}
                          </span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            <span className="text-[10px] text-slate-400">
                              {isCheckedIn ? 'Done' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Energy cost bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Energy demand</span>
                          <span className="text-[10px] font-bold text-slate-600">{block.energy_cost_estimate}/10</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-1.5">
                          <div
                            className={`rounded-full h-1.5 transition-all ${
                              block.energy_cost_estimate <= 3
                                ? 'bg-emerald-400'
                                : block.energy_cost_estimate <= 6
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                            }`}
                            style={{ width: `${(block.energy_cost_estimate / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add activity button */}
      <div className="mt-5">
        <Link
          href={`/trips/${tripId}/itinerary`}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-white border-2 border-dashed border-slate-200 text-slate-500 font-semibold rounded-2xl hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 text-sm"
        >
          <Plus size={16} />
          Add Activity to Day {selectedDay + 1}
        </Link>
      </div>
    </div>
  );
}
