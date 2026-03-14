'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTripStore } from '@/store/trip-store';
import {
  BatteryWarning,
  Battery,
  BatteryMedium,
  BatteryFull,
  Zap,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

function getEnergyIcon(level: number) {
  const size = 48;
  const strokeWidth = 1.5;
  if (level <= 2) return <BatteryWarning size={size} strokeWidth={strokeWidth} className="text-[#c47a6e]" />;
  if (level <= 4) return <Battery size={size} strokeWidth={strokeWidth} className="text-[#b8906a]" />;
  if (level <= 6) return <BatteryMedium size={size} strokeWidth={strokeWidth} className="text-[#b8a06a]" />;
  if (level <= 8) return <BatteryFull size={size} strokeWidth={strokeWidth} className="text-[#8B9A7B]" />;
  return <Zap size={size} strokeWidth={strokeWidth} className="text-[#6B7A5E]" />;
}

function getEnergyDescription(level: number): string {
  if (level <= 2) return 'Running on empty';
  if (level <= 4) return 'Feeling a bit tired';
  if (level <= 6) return 'Doing okay';
  if (level <= 8) return 'Feeling energized';
  return 'Absolutely crushing it';
}

function getSliderColor(level: number): string {
  if (level <= 3) return '#c47a6e';
  if (level <= 6) return '#b8a06a';
  return '#8B9A7B';
}

export default function CheckInPage() {
  const router = useRouter();
  const params = useParams();
  const blockId = params.blockId as string;

  const { activityBlocks, setEnergyLevel, submitCheckIn, user } = useTripStore();
  const [energy, setEnergy] = useState(5.0);
  const [loading, setLoading] = useState(false);
  const [affirmed, setAffirmed] = useState(false);

  const block = Object.values(activityBlocks)
    .flat()
    .find((b) => b.id === blockId);

  const updateEnergy = useCallback((val: number) => {
    setEnergy(val);
    setEnergyLevel(Math.round(val));
  }, [setEnergyLevel]);

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

    const rounded = Math.round(energy);

    if (block) {
      submitCheckIn({
        id: `checkin-${Date.now()}`,
        activity_block_id: block.id,
        user_id: user.id,
        energy_level: rounded,
        current_lat: block.resolved_lat ?? 51.1784,
        current_lng: block.resolved_lng ?? -115.5708,
        agent_outcome: rounded <= 6 ? 'rerouted' : 'affirmed',
        selected_place_id: null,
        selected_place_name: null,
        timestamp: new Date().toISOString(),
      });
    }

    setLoading(false);

    if (rounded <= 6) {
      router.push(`/checkin/suggestions?blockId=${blockId}`);
    } else {
      setAffirmed(true);
    }
  };

  const displayValue = energy.toFixed(1);
  const rounded = Math.round(energy);
  const description = getEnergyDescription(rounded);
  const sliderColor = getSliderColor(energy);
  const pct = ((energy - 1) / 9) * 100;

  const energyTextColor =
    energy <= 3 ? 'text-[#8a4a40]' : energy <= 6 ? 'text-[#8a7340]' : 'text-[#5a6b4e]';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-6 pb-2 max-w-md mx-auto w-full">
        <Link
          href="/dashboard"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F0EDE7] transition-colors"
        >
          <ArrowLeft size={18} className="text-[#6B6B6B]" />
        </Link>
        <p className="text-sm font-semibold text-[#6B6B6B]">Energy Check-In</p>
        <div className="w-9" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md mx-auto w-full">
        {/* Activity name card */}
        <div className="w-full bg-[#FAF8F5] rounded-2xl px-5 py-4 mb-12 text-center">
          <p className="text-[#ADADAD] text-xs font-medium mb-1 uppercase tracking-wider">Current activity</p>
          <h1 className="text-lg font-bold text-[#1A1A1A] leading-tight">
            {block?.place_name ?? 'Your Activity'}
          </h1>
        </div>

        {affirmed ? (
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <CheckCircle2 size={64} strokeWidth={1.5} className="text-[#8B9A7B]" />
            </div>
            <h2 className="text-2xl font-bold text-[#5a6b4e] mb-2">You&apos;re all set</h2>
            <p className="text-[#6B6B6B] text-base">Enjoy your activity</p>
            <p className="text-[#ADADAD] text-sm mt-3">Returning to dashboard...</p>
          </div>
        ) : (
          <>
            {/* Energy icon */}
            <div className="mb-4 transition-all duration-300 select-none">
              {getEnergyIcon(rounded)}
            </div>

            {/* Energy level display */}
            <div className="mb-10 text-center">
              <p className={`text-5xl font-bold ${energyTextColor} transition-colors duration-300 tabular-nums`}>
                {displayValue}
                <span className="text-2xl text-[#ADADAD] font-medium"> / 10</span>
              </p>
              <p className={`text-sm font-medium mt-2 ${energyTextColor} transition-colors duration-300`}>
                {description}
              </p>
            </div>

            {/* Slider */}
            <div className="w-full mb-12">
              <div className="flex items-center justify-between text-xs text-[#ADADAD] mb-3 font-medium">
                <div className="flex items-center gap-1.5">
                  <BatteryWarning size={14} />
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>High</span>
                  <Zap size={14} />
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={0.1}
                value={energy}
                onChange={(e) => updateEnergy(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, ${sliderColor} 0%, ${sliderColor} ${pct}%, #E5E0D8 ${pct}%, #E5E0D8 100%)`,
                }}
                className="w-full h-2 rounded-full cursor-pointer"
              />
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 bg-[#2C2C2C] text-white font-semibold text-base rounded-full shadow-sm hover:bg-[#1A1A1A] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
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
              className="mt-4 text-sm text-[#ADADAD] hover:text-[#6B6B6B] transition-colors font-medium"
            >
              Cancel
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
