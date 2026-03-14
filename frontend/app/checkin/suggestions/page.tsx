'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTripStore } from '@/store/trip-store';
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Clock,
  ExternalLink,
} from 'lucide-react';

function getEnergyBadgeStyle(label: 'very low' | 'low' | 'moderate') {
  switch (label) {
    case 'very low':
      return 'bg-[#8B9A7B] text-white';
    case 'low':
      return 'bg-[#a8b89a] text-white';
    case 'moderate':
      return 'bg-[#b8a06a] text-white';
  }
}

export default function SuggestionsPage() {
  const router = useRouter();
  const { suggestions } = useTripStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<number | null>(null);

  const handleChoose = (placeId: string) => {
    setChosenId(placeId);
    setShowToast(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 1800);
  };

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % suggestions.length);
  }, [suggestions.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
  }, [suggestions.length]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const delta = e.clientX - dragStart.current;
    setDragX(delta);
  };

  const handlePointerUp = () => {
    if (dragStart.current === null) return;
    if (dragX > 80) goPrev();
    else if (dragX < -80) goNext();
    setDragX(0);
    setIsDragging(false);
    dragStart.current = null;
  };

  const current = suggestions[currentIndex];

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#5a6b4e] text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-2 whitespace-nowrap">
            <CheckCircle2 size={18} />
            <span className="font-semibold text-sm">Plan updated</span>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/dashboard"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow-md transition-all"
          >
            <ChevronLeft size={18} className="text-[#1A1A1A]" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#1A1A1A]">Gentler alternatives</h1>
            <p className="text-xs text-[#ADADAD]">Swipe or tap arrows to browse</p>
          </div>
        </div>

        {/* Card Stack */}
        <div
          className="relative mb-6 touch-none select-none"
          style={{ height: '440px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {suggestions.map((suggestion, idx) => {
            const offset = ((idx - currentIndex) + suggestions.length) % suggestions.length;
            const isVisible = offset <= 2;
            if (!isVisible) return null;

            const scale = 1 - offset * 0.04;
            const translateY = offset * 10;
            const zIndex = suggestions.length - offset;
            const opacity = offset === 0 ? 1 : 0.6;
            const rotateZ = offset === 0 && isDragging ? dragX * 0.04 : 0;
            const translateX = offset === 0 ? dragX * 0.5 : 0;

            return (
              <div
                key={suggestion.place_id}
                className={`absolute inset-x-0 top-0 ${isDragging && offset === 0 ? '' : 'transition-all duration-300 ease-out'}`}
                style={{
                  transform: `scale(${scale}) translateY(${translateY}px) translateX(${translateX}px) rotate(${rotateZ}deg)`,
                  zIndex,
                  opacity,
                  pointerEvents: offset === 0 ? 'auto' : 'none',
                }}
              >
                <div className="relative w-full h-[420px] rounded-3xl overflow-hidden shadow-md">
                  {/* Background image */}
                  {suggestion.image_url ? (
                    <Image
                      src={suggestion.image_url}
                      alt={suggestion.place_name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 448px) 100vw, 448px"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#8B9A7B]" />
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  {/* Heart icon */}
                  <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors">
                    <Heart size={18} className="text-white" />
                  </button>

                  {/* Energy badge */}
                  <div className="absolute top-4 left-4">
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getEnergyBadgeStyle(suggestion.energy_cost_label)}`}>
                      {suggestion.energy_cost_label} energy
                    </span>
                  </div>

                  {/* Bottom content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-white text-xl font-bold mb-2">
                      {suggestion.place_name}
                    </h3>
                    <p className="text-white/80 text-sm leading-relaxed mb-4">
                      {suggestion.why_it_fits}
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-white/70 text-xs font-medium">
                        <MapPin size={12} />
                        {suggestion.distance_km} km
                      </span>
                      <span className="flex items-center gap-1 text-white/70 text-xs font-medium">
                        <Clock size={12} />
                        {suggestion.estimated_duration_minutes} min
                      </span>
                      {suggestion.maps_url && (
                        <a
                          href={suggestion.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-white/70 text-xs font-medium hover:text-white transition-colors ml-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={12} />
                          Maps
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation arrows and dots */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={goPrev}
            className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-all"
          >
            <ChevronLeft size={20} className="text-[#1A1A1A]" />
          </button>

          <div className="flex items-center gap-2">
            {suggestions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  idx === currentIndex ? 'bg-[#8B9A7B] w-6' : 'bg-[#E5E0D8] w-2'
                }`}
              />
            ))}
          </div>

          <button
            onClick={goNext}
            className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-all"
          >
            <ChevronRight size={20} className="text-[#1A1A1A]" />
          </button>
        </div>

        {/* Choose / Skip */}
        <button
          onClick={() => handleChoose(current.place_id)}
          disabled={!!chosenId}
          className={`w-full py-3.5 font-semibold text-sm rounded-full transition-all duration-200 mb-3 ${
            chosenId === current.place_id
              ? 'bg-[#5a6b4e] text-white'
              : chosenId
              ? 'bg-[#E5E0D8] text-[#ADADAD] cursor-not-allowed'
              : 'bg-[#2C2C2C] text-white hover:bg-[#1A1A1A]'
          }`}
        >
          {chosenId === current.place_id ? 'Chosen' : 'Choose this'}
        </button>

        <Link
          href="/dashboard"
          className="block text-center text-sm text-[#6B6B6B] font-medium hover:text-[#1A1A1A] transition-colors"
        >
          Skip — keep my current plan
        </Link>
      </div>
    </div>
  );
}
