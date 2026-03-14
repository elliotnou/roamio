'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTripStore } from '@/store/trip-store';
import { X } from 'lucide-react';

function getEnergyEmoji(level: number): string {
  if (level <= 2) return '😴';
  if (level <= 4) return '😓';
  if (level <= 6) return '😊';
  if (level <= 8) return '💪';
  return '🔥';
}

function getEnergyDescription(level: number): string {
  if (level <= 2) return 'Running on empty';
  if (level <= 4) return 'Feeling a bit tired';
  if (level <= 6) return 'Doing okay';
  if (level <= 8) return 'Feeling energized';
  return 'Absolutely crushing it!';
}

function getSliderGradient(level: number): string {
  const pct = ((level - 1) / 9) * 100;
  if (pct < 33) return `linear-gradient(to right, #ef4444 0%, #ef4444 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
  if (pct < 66) return `linear-gradient(to right, #f59e0b 0%, #f59e0b ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
  return `linear-gradient(to right, #10b981 0%, #10b981 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
}

export default function CheckInPage() {
  const router = useRouter();
  const params = useParams();
  const blockId = params.blockId as string;

  const { activityBlocks, trips, setEnergyLevel, submitCheckIn, user } = useTripStore();
  const [energy, setEnergy] = useState(7);
  const [loading, setLoading] = useState(false);
  const [affirmed, setAffirmed] = useState(false);

  // Find the block across all trips
  const block = Object.values(activityBlocks)
    .flat()
    .find((b) => b.id === blockId);

  useEffect(() => {
    setEnergyLevel(energy);
  }, [energy, setEnergyLevel]);

  // Auto-navigate after affirmation
  useEffect(() => {
    if (affirmed) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [affirmed, router]);

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    if (block) {
      submitCheckIn({
        id: `checkin-${Date.now()}`,
        activity_block_id: block.id,
        user_id: user.id,
        energy_level: energy,
        current_lat: block.resolved_lat ?? 51.1784,
        current_lng: block.resolved_lng ?? -115.5708,
        agent_outcome: energy <= 6 ? 'rerouted' : 'affirmed',
        selected_place_id: null,
        selected_place_name: null,
        timestamp: new Date().toISOString(),
      });
    }

    setLoading(false);

    if (energy <= 6) {
      router.push(`/checkin/suggestions?blockId=${blockId}`);
    } else {
      setAffirmed(true);
    }
  };

  const emoji = getEnergyEmoji(energy);
  const description = getEnergyDescription(energy);

  const energyColor =
    energy <= 3 ? 'text-red-500' : energy <= 6 ? 'text-amber-500' : 'text-emerald-500';

  const energyBg =
    energy <= 3 ? 'bg-red-50' : energy <= 6 ? 'bg-amber-50' : 'bg-emerald-50';

  const energyBorder =
    energy <= 3 ? 'border-red-100' : energy <= 6 ? 'border-amber-100' : 'border-emerald-100';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2 max-w-md mx-auto w-full">
        <div className="w-9" />
        <p className="text-sm font-semibold text-slate-500">Energy Check-In</p>
        <Link
          href="/dashboard"
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
        >
          <X size={18} className="text-slate-500" />
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        {/* Activity name */}
        <div className="text-center mb-8">
          <p className="text-slate-500 text-sm font-medium mb-1">You&apos;re at</p>
          <h1 className="text-2xl font-black text-slate-800 leading-tight">
            {block?.place_name ?? 'Your Activity'}
          </h1>
        </div>

        {/* Affirmation message */}
        {affirmed ? (
          <div className="text-center">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-2xl font-black text-emerald-600 mb-2">You&apos;re crushing it!</h2>
            <p className="text-slate-500 text-base">Enjoy the {block?.activity_type ?? 'activity'}!</p>
            <p className="text-slate-400 text-sm mt-3">Returning to dashboard...</p>
          </div>
        ) : (
          <>
            {/* Emoji */}
            <div className="text-8xl mb-4 transition-all duration-300 select-none">{emoji}</div>

            {/* Energy level display */}
            <div className={`${energyBg} border ${energyBorder} rounded-2xl px-8 py-4 mb-6 text-center transition-all duration-300`}>
              <p className={`text-5xl font-black ${energyColor} transition-colors duration-300`}>
                {energy}
                <span className="text-2xl text-slate-400 font-medium"> / 10</span>
              </p>
              <p className={`text-sm font-semibold mt-1 ${energyColor} transition-colors duration-300`}>
                {description}
              </p>
            </div>

            {/* Slider */}
            <div className="w-full mb-8">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3 font-medium">
                <span>😴 Exhausted</span>
                <span>🔥 Energized</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                style={{ background: getSliderGradient(energy) }}
                className="w-full h-3 rounded-full cursor-pointer"
              />
              <div className="flex justify-between mt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEnergy(n)}
                    className={`text-xs font-bold transition-all ${
                      n === energy ? energyColor + ' scale-125' : 'text-slate-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Context */}
            <div className="w-full bg-slate-50 rounded-xl p-4 mb-8 border border-slate-100">
              <p className="text-slate-500 text-sm text-center">
                {energy <= 4
                  ? "💡 That's okay — we'll find you something gentler nearby."
                  : energy <= 7
                  ? "👍 Good to know — staying on your current plan looks right."
                  : "⚡ Amazing! You have the energy to make the most of this activity."}
              </p>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:from-indigo-700 hover:to-violet-700 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                'Submit Check-In'
              )}
            </button>

            <Link
              href="/dashboard"
              className="mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors font-medium"
            >
              Cancel — back to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
