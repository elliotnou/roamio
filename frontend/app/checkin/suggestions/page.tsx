'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTripStore } from '@/store/trip-store';
import { ExternalLink, ArrowLeft, CheckCircle2 } from 'lucide-react';

function getEnergyBadgeStyle(label: 'very low' | 'low' | 'moderate') {
  switch (label) {
    case 'very low':
      return 'bg-emerald-100 text-emerald-700';
    case 'low':
      return 'bg-yellow-100 text-yellow-700';
    case 'moderate':
      return 'bg-orange-100 text-orange-700';
  }
}

function getEnergyDotColor(label: 'very low' | 'low' | 'moderate') {
  switch (label) {
    case 'very low':
      return 'bg-emerald-500';
    case 'low':
      return 'bg-yellow-500';
    case 'moderate':
      return 'bg-orange-500';
  }
}

export default function SuggestionsPage() {
  const router = useRouter();
  const { suggestions, energyLevel } = useTripStore();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const handleChoose = (placeId: string, placeName: string) => {
    setChosenId(placeId);
    setShowToast(true);
    setTimeout(() => {
      router.push('/dashboard');
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 whitespace-nowrap">
            <CheckCircle2 size={18} />
            <span className="font-semibold text-sm">Plan updated! Heading there now.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </Link>
          <div>
            <p className="text-sm font-bold text-slate-800">Gentler Alternatives</p>
            <p className="text-xs text-slate-400">
              Based on your energy: {energyLevel ?? '?'}/10
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {/* Hero text */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✨</div>
          <h1 className="text-xl font-black text-slate-800 mb-1">
            We&apos;ve found some gentler alternatives
          </h1>
          <p className="text-slate-500 text-sm">
            Swipe or tap to explore options that match your energy
          </p>
        </div>

        {/* Energy context pill */}
        <div className="flex justify-center mb-6">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-lg">😓</span>
            <p className="text-amber-700 text-sm font-medium">
              Your energy: <span className="font-bold">{energyLevel ?? 4}/10</span> — let&apos;s take it easy
            </p>
          </div>
        </div>

        {/* Suggestion cards */}
        <div className="space-y-4 mb-6">
          {suggestions.map((suggestion) => {
            const isChosen = chosenId === suggestion.place_id;

            return (
              <div
                key={suggestion.place_id}
                className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 overflow-hidden ${
                  isChosen
                    ? 'border-emerald-300 shadow-md shadow-emerald-100 ring-1 ring-emerald-200'
                    : 'border-slate-100 hover:shadow-md hover:border-indigo-100'
                }`}
              >
                <div className="p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-base leading-tight">
                        {suggestion.place_name}
                      </h3>
                      <p className="text-slate-400 text-xs mt-0.5">{suggestion.address}</p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${getEnergyBadgeStyle(suggestion.energy_cost_label)}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${getEnergyDotColor(suggestion.energy_cost_label)}`} />
                      {suggestion.energy_cost_label}
                    </span>
                  </div>

                  {/* Why it fits */}
                  <p className="text-slate-500 text-sm italic leading-relaxed mb-4">
                    &ldquo;{suggestion.why_it_fits}&rdquo;
                  </p>

                  {/* Meta info */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs">📍</span>
                      <span className="text-xs text-slate-600 font-semibold">{suggestion.distance_km} km away</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs">⏱️</span>
                      <span className="text-xs text-slate-600 font-semibold">~{suggestion.estimated_duration_minutes} min</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <a
                      href={suggestion.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 flex-1 py-2.5 bg-slate-100 text-slate-600 font-semibold text-sm rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <ExternalLink size={13} />
                      Open in Maps
                    </a>

                    <button
                      onClick={() => handleChoose(suggestion.place_id, suggestion.place_name)}
                      disabled={!!chosenId}
                      className={`flex-1 py-2.5 font-semibold text-sm rounded-xl transition-all duration-200 disabled:cursor-not-allowed ${
                        isChosen
                          ? 'bg-emerald-500 text-white'
                          : chosenId
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200 hover:shadow-lg hover:from-indigo-700 hover:to-violet-700'
                      }`}
                    >
                      {isChosen ? '✓ Chosen!' : 'Choose this'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skip button */}
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-full py-3.5 bg-white border border-slate-200 text-slate-500 font-semibold text-sm rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
        >
          Skip — I&apos;ll stick with my plan
        </Link>
      </div>
    </div>
  );
}
