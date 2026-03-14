'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTripStore } from '@/store/trip-store';
import {
  formatTimeRange,
  getEnergyColor,
  getEnergyLabel,
  isBlockActive,
  DEMO_CURRENT_MINUTES,
  DEMO_CURRENT_DAY,
} from '@/lib/utils';
import {
  Search,
  Heart,
  Star,
  Plus,
  Mountain,
  Footprints,
  Bike,
  Landmark,
  ImageIcon,
  MapPin,
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
  Store,
  Droplets,
  TreePine,
  Waves,
  Activity,
} from 'lucide-react';
import type { ActivityType } from '@/types';

function ActivityIcon({ type, size = 16, className = '' }: { type: ActivityType; size?: number; className?: string }) {
  const props = { size, className, strokeWidth: 1.5 };
  switch (type) {
    case 'hiking': return <Mountain {...props} />;
    case 'walking': return <Footprints {...props} />;
    case 'cycling': return <Bike {...props} />;
    case 'museum': return <Landmark {...props} />;
    case 'gallery': return <ImageIcon {...props} />;
    case 'landmark': return <MapPin {...props} />;
    case 'restaurant': return <UtensilsCrossed {...props} />;
    case 'cafe': return <Coffee {...props} />;
    case 'shopping': return <ShoppingBag {...props} />;
    case 'market': return <Store {...props} />;
    case 'spa': return <Droplets {...props} />;
    case 'park': return <TreePine {...props} />;
    case 'beach': return <Waves {...props} />;
    default: return <MapPin {...props} />;
  }
}

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
    <div className="max-w-md mx-auto px-5 py-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            Hello, {user.display_name}
          </h1>
          <p className="text-[#6B6B6B] text-sm mt-0.5">Good {getHour()}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#8B9A7B] flex items-center justify-center">
          <span className="text-white text-sm font-bold">
            {user.display_name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Search bar (decorative) */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ADADAD]" />
        <input
          type="text"
          placeholder="Search destinations..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-[#E5E0D8] text-sm text-[#1A1A1A] placeholder-[#ADADAD] focus:outline-none focus:ring-2 focus:ring-[#8B9A7B]/30"
          readOnly
        />
      </div>

      {/* Active trip hero card */}
      {activeTrip ? (
        <Link href={`/trips/${activeTrip.id}`}>
          <div className="relative w-full h-56 rounded-3xl overflow-hidden shadow-sm group cursor-pointer">
            {activeTrip.destination_image ? (
              <Image
                src={activeTrip.destination_image}
                alt={activeTrip.destination}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 448px) 100vw, 448px"
              />
            ) : (
              <div className="w-full h-full bg-[#8B9A7B]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors">
              <Heart size={18} className="text-white" />
            </button>
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="text-white text-xl font-bold">{activeTrip.destination}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-white/90 text-sm font-medium">4.8</span>
                </div>
                <span className="text-white/60 text-sm">(2.4k reviews)</span>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className="bg-white rounded-3xl p-8 shadow-sm text-center">
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">No active trip yet</h3>
          <p className="text-[#6B6B6B] text-sm mb-5">
            Start planning your next wellness adventure
          </p>
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-2 bg-[#2C2C2C] text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-[#1A1A1A] transition-all"
          >
            <Plus size={16} />
            Create your first trip
          </Link>
        </div>
      )}

      {/* Today's Plan */}
      {activeTrip && todayBlocks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Today&apos;s Plan</h2>
            <span className="text-xs text-[#6B6B6B] font-medium bg-[#F0EDE7] px-3 py-1 rounded-full">
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
                    className={`bg-white rounded-2xl p-4 shadow-sm transition-all duration-200 ${
                      isActive
                        ? 'border-l-4 border-l-[#8B9A7B] border border-[#E5E0D8]'
                        : 'border border-transparent hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-[#F0EDE7] flex items-center justify-center shrink-0 mt-0.5">
                        <ActivityIcon type={block.activity_type} size={18} className="text-[#6B6B6B]" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#1A1A1A] text-sm leading-tight">
                              {block.place_name}
                            </p>
                            <p className="text-[#ADADAD] text-xs mt-0.5">
                              {formatTimeRange(block.start_time, block.end_time)}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${getEnergyColor(block.energy_cost_estimate)}`}
                          >
                            {getEnergyLabel(block.energy_cost_estimate)}
                          </span>
                        </div>

                        {isCheckedIn && (
                          <span className="inline-flex items-center gap-1 text-xs text-[#5a6b4e] font-medium mt-2">
                            <span className="w-1.5 h-1.5 bg-[#8B9A7B] rounded-full" />
                            Done
                          </span>
                        )}

                        {isActive && !isCheckedIn && (
                          <Link
                            href={`/checkin/${block.id}`}
                            className="mt-3 flex items-center justify-center gap-2 bg-[#2C2C2C] text-white text-sm font-semibold py-2.5 px-4 rounded-full hover:bg-[#1A1A1A] transition-all duration-200"
                          >
                            <Activity size={14} />
                            Check In
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
    </div>
  );
}
