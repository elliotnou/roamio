'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useTripStore } from '@/store/trip-store';
import {
  formatDate,
  getDayCount,
  formatTimeRange,
  getEnergyColor,
  getEnergyLabel,
} from '@/lib/utils';
import { ArrowLeft, Heart, Plus, ChevronDown, ChevronUp } from 'lucide-react';

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { trips, activityBlocks, checkIns } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);
  const blocks = activityBlocks[tripId] || [];
  const checkedInIds = new Set(checkIns.map((c) => c.activity_block_id));

  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 0;
  const [activeTab, setActiveTab] = useState<'itinerary' | 'activities' | 'details'>('itinerary');
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]));

  const toggleDay = (dayIndex: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) {
        next.delete(dayIndex);
      } else {
        next.add(dayIndex);
      }
      return next;
    });
  };

  const getTimeOfDay = (time: string): string => {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  if (!trip) {
    return (
      <div className="max-w-md mx-auto px-5 py-6">
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Trip not found</h2>
          <Link href="/trips" className="text-[#8B9A7B] font-semibold hover:underline">
            Back to My Trips
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Hero image */}
      <div className="relative w-full h-64">
        {trip.destination_image ? (
          <Image
            src={trip.destination_image}
            alt={trip.destination}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 100vw, 448px"
          />
        ) : (
          <div className="w-full h-full bg-[#8B9A7B]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        {/* Back arrow */}
        <Link
          href="/trips"
          className="absolute top-5 left-5 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors"
        >
          <ArrowLeft size={18} className="text-white" />
        </Link>
        {/* Heart */}
        <button className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors">
          <Heart size={18} className="text-white" />
        </button>
      </div>

      {/* Trip info */}
      <div className="px-5 pt-5 pb-2">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{trip.destination}</h1>
        <p className="text-[#6B6B6B] text-sm mt-1">
          {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
        </p>
      </div>

      {/* Tab pills */}
      <div className="px-5 py-3">
        <div className="flex gap-2">
          {(['itinerary', 'activities', 'details'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 capitalize ${
                activeTab === tab
                  ? 'bg-[#2C2C2C] text-white'
                  : 'bg-white text-[#6B6B6B] hover:bg-[#F0EDE7]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-8">
        {activeTab === 'itinerary' && (
          <div className="space-y-3 mt-2">
            {Array.from({ length: dayCount }, (_, dayIndex) => {
              const dayBlocks = blocks
                .filter((b) => b.day_index === dayIndex)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
              const isExpanded = expandedDays.has(dayIndex);

              // Group by time of day
              const groups: Record<string, typeof dayBlocks> = {};
              dayBlocks.forEach((block) => {
                const tod = getTimeOfDay(block.start_time);
                if (!groups[tod]) groups[tod] = [];
                groups[tod].push(block);
              });

              return (
                <div key={dayIndex} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Day header (accordion) */}
                  <button
                    onClick={() => toggleDay(dayIndex)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAF8F5] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-[#1A1A1A]">Day {dayIndex + 1}</span>
                      <span className="text-xs text-[#6B6B6B] bg-[#F0EDE7] px-2.5 py-0.5 rounded-full">
                        {dayBlocks.length} {dayBlocks.length === 1 ? 'activity' : 'activities'}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-[#ADADAD]" />
                    ) : (
                      <ChevronDown size={18} className="text-[#ADADAD]" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-5 pb-4">
                      {Object.entries(groups).map(([timeOfDay, groupBlocks]) => (
                        <div key={timeOfDay} className="mb-4 last:mb-0">
                          <p className="text-xs font-semibold text-[#ADADAD] uppercase tracking-wider mb-2">
                            {timeOfDay}
                          </p>
                          <div className="space-y-2">
                            {groupBlocks.map((block) => {
                              const isCheckedIn = checkedInIds.has(block.id);
                              return (
                                <div
                                  key={block.id}
                                  className="flex items-start gap-3 py-2"
                                >
                                  <div className="shrink-0 w-14 pt-0.5">
                                    <p className="text-xs text-[#6B6B6B] font-medium">
                                      {formatTimeRange(block.start_time, block.end_time).split(' – ')[0]}
                                    </p>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-semibold text-[#1A1A1A] leading-tight">
                                        {block.place_name}
                                      </p>
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${getEnergyColor(block.energy_cost_estimate)}`}>
                                        {getEnergyLabel(block.energy_cost_estimate)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#ADADAD] mt-0.5">
                                      {formatTimeRange(block.start_time, block.end_time)}
                                    </p>
                                    {isCheckedIn && (
                                      <span className="inline-flex items-center gap-1 text-xs text-[#5a6b4e] font-medium mt-1">
                                        <span className="w-1.5 h-1.5 bg-[#8B9A7B] rounded-full" />
                                        Done
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="mt-2 text-center py-10">
            <p className="text-[#6B6B6B] text-sm">
              {blocks.length} activities across {dayCount} days
            </p>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="mt-2 text-center py-10">
            <p className="text-[#6B6B6B] text-sm">Trip details coming soon</p>
          </div>
        )}

        {/* Add Activity button */}
        <Link
          href={`/trips/${tripId}/itinerary`}
          className="mt-5 flex items-center justify-center gap-2 w-full py-3.5 bg-[#2C2C2C] text-white font-semibold rounded-full hover:bg-[#1A1A1A] transition-all duration-200 text-sm"
        >
          <Plus size={16} />
          Add Activity
        </Link>
      </div>
    </div>
  );
}
