'use client';

import Link from 'next/link';
import { useTripStore } from '@/store/trip-store';
import {
  formatDate,
  getDayCount,
  formatTimeRange,
  getActivityEmoji,
  getEnergyColor,
  getEnergyLabel,
  isBlockActive,
  DEMO_CURRENT_MINUTES,
  DEMO_CURRENT_DAY,
} from '@/lib/utils';
import { Calendar, MapPin, ChevronRight, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { user, activeTrip, activityBlocks, checkIns } = useTripStore();

  const todayBlocks = activeTrip
    ? (activityBlocks[activeTrip.id] || []).filter((b) => b.day_index === DEMO_CURRENT_DAY)
    : [];

  const activeBlock = todayBlocks.find((b) =>
    isBlockActive(b.start_time, b.end_time, DEMO_CURRENT_MINUTES)
  );

  const getHour = () => {
    const h = Math.floor(DEMO_CURRENT_MINUTES / 60);
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  };

  const checkedInIds = new Set(checkIns.map((c) => c.activity_block_id));

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Good {getHour()}, {user.display_name} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">Here&apos;s your travel pulse for today</p>
      </div>

      {/* Active trip card */}
      {activeTrip ? (
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 shadow-lg shadow-indigo-200 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">Active Trip</p>
              <h2 className="text-xl font-bold">{activeTrip.destination}</h2>
              <div className="flex items-center gap-1.5 mt-2 text-indigo-200 text-sm">
                <Calendar size={13} />
                <span>
                  {formatDate(activeTrip.start_date)} – {formatDate(activeTrip.end_date)}
                </span>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 text-center">
              <p className="text-2xl font-black">{getDayCount(activeTrip.start_date, activeTrip.end_date)}</p>
              <p className="text-indigo-200 text-[10px] font-semibold uppercase tracking-wider">days</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 bg-white/10 rounded-full h-1.5">
              <div
                className="bg-white rounded-full h-1.5 transition-all"
                style={{
                  width: `${Math.round((1 / getDayCount(activeTrip.start_date, activeTrip.end_date)) * 100)}%`,
                }}
              />
            </div>
            <span className="text-indigo-200 text-xs font-medium">Day 1</span>
          </div>

          <Link
            href={`/trips/${activeTrip.id}`}
            className="mt-3 flex items-center gap-1 text-white text-sm font-semibold hover:text-indigo-200 transition-colors"
          >
            View full itinerary <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No active trip yet</h3>
          <p className="text-slate-500 text-sm mb-5">
            Start planning your next wellness adventure
          </p>
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={16} />
            Create your first trip
          </Link>
        </div>
      )}

      {/* Today's plan */}
      {activeTrip && todayBlocks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Today&apos;s Plan</h2>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
              {todayBlocks.length} activities
            </span>
          </div>

          <div className="space-y-3">
            {todayBlocks
              .slice()
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((block) => {
                const isActive = block.id === activeBlock?.id;
                const isCheckedIn = checkedInIds.has(block.id);

                return (
                  <div
                    key={block.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border transition-all duration-200 ${
                      isActive
                        ? 'border-indigo-300 shadow-md shadow-indigo-100 ring-1 ring-indigo-200'
                        : 'border-slate-100 hover:shadow-md hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Time & status column */}
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="relative">
                          {isActive && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full pulse-dot z-10 border border-white" />
                          )}
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                              isActive ? 'bg-indigo-50' : 'bg-slate-50'
                            }`}
                          >
                            {getActivityEmoji(block.activity_type)}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm leading-tight">
                              {block.place_name}
                            </p>
                            <p className="text-slate-400 text-xs mt-0.5">
                              {formatTimeRange(block.start_time, block.end_time)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getEnergyColor(block.energy_cost_estimate)}`}
                            >
                              {getEnergyLabel(block.energy_cost_estimate)} energy
                            </span>
                            {isCheckedIn && (
                              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                                Done
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Location */}
                        {block.resolved_place_name && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <p className="text-xs text-slate-400 truncate">{block.resolved_place_name}</p>
                          </div>
                        )}

                        {/* Check-in CTA for active block */}
                        {isActive && !isCheckedIn && (
                          <Link
                            href={`/checkin/${block.id}`}
                            className="mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold py-2 px-4 rounded-xl shadow-sm hover:shadow-md hover:from-indigo-700 hover:to-violet-700 transition-all duration-200"
                          >
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Check In Now
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Trips', value: '2', emoji: '✈️' },
          { label: 'Activities', value: '11', emoji: '🎯' },
          { label: 'Check-ins', value: '2', emoji: '✅' },
        ].map(({ label, value, emoji }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center">
            <div className="text-2xl mb-1">{emoji}</div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 font-medium">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
