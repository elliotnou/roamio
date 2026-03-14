'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTripStore } from '@/store/trip-store';
import { formatDate } from '@/lib/utils';
import { Plus, Heart } from 'lucide-react';

export default function TripsPage() {
  const { trips } = useTripStore();

  return (
    <div className="max-w-md mx-auto px-5 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">My Trips</h1>
        <Link
          href="/trips/new"
          className="w-10 h-10 flex items-center justify-center bg-[#2C2C2C] text-white rounded-full shadow-sm hover:bg-[#1A1A1A] transition-all"
        >
          <Plus size={20} />
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 shadow-sm text-center">
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">No trips yet</h3>
          <p className="text-[#6B6B6B] text-sm mb-5">
            Start by creating your first wellness travel plan
          </p>
          <Link
            href="/trips/new"
            className="inline-flex items-center gap-2 bg-[#2C2C2C] text-white font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-[#1A1A1A] transition-all"
          >
            <Plus size={16} />
            Create Trip
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <div className="relative w-full h-52 rounded-3xl overflow-hidden shadow-sm group cursor-pointer mb-1">
                {trip.destination_image ? (
                  <Image
                    src={trip.destination_image}
                    alt={trip.destination}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 448px) 100vw, 448px"
                  />
                ) : (
                  <div className="w-full h-full bg-[#8B9A7B]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                {/* Heart */}
                <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors">
                  <Heart size={18} className="text-white" />
                </button>
                {/* Bottom content */}
                <div className="absolute bottom-4 left-5 right-5">
                  <h3 className="text-white text-lg font-bold">{trip.destination}</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
