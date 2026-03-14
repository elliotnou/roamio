'use client';

import Link from 'next/link';
import { useTripStore } from '@/store/trip-store';
import { formatDate, getDayCount } from '@/lib/utils';
import { Plus, Calendar, MapPin, ChevronRight } from 'lucide-react';

export default function TripsPage() {
  const { trips, activityBlocks } = useTripStore();

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Trips</h1>
          <p className="text-slate-500 text-sm mt-0.5">{trips.length} adventures planned</p>
        </div>
        <Link
          href="/trips/new"
          className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:from-indigo-700 hover:to-violet-700 transition-all duration-200"
        >
          <Plus size={16} />
          New Trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No trips yet</h3>
          <p className="text-slate-500 text-sm mb-5">
            Start by creating your first wellness travel plan
          </p>
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={16} />
            Create Trip
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const blocks = activityBlocks[trip.id] || [];
            const days = getDayCount(trip.start_date, trip.end_date);
            const isUpcoming = new Date(trip.start_date) >= new Date('2026-03-14');

            return (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition-all duration-200 group cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isUpcoming && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">
                        {trip.destination}
                      </h3>

                      <div className="flex items-center gap-1.5 mt-2 text-slate-500 text-sm">
                        <Calendar size={13} className="shrink-0" />
                        <span>
                          {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                          <MapPin size={13} className="shrink-0" />
                          <span>{days} {days === 1 ? 'day' : 'days'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                          <span className="text-base">🎯</span>
                          <span>{blocks.length} {blocks.length === 1 ? 'activity' : 'activities'}</span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      size={18}
                      className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all mt-1 shrink-0"
                    />
                  </div>

                  {/* Progress bar for active trip */}
                  {isUpcoming && (
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span>Day 1 of {days}</span>
                        <span className="text-indigo-600 font-semibold">In Progress</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full h-1.5 transition-all"
                          style={{ width: `${Math.round((1 / days) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
