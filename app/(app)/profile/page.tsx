'use client';

import { useRouter } from 'next/navigation';
import { useTripStore } from '@/store/trip-store';
import { LogOut, ChevronRight, Bell, Shield, HelpCircle, Star } from 'lucide-react';

const statItems = [
  { label: 'Total Trips', value: '2', emoji: '✈️' },
  { label: 'Activities Done', value: '9', emoji: '🎯' },
  { label: 'Check-ins', value: '2', emoji: '✅' },
];

const menuItems = [
  { icon: Bell, label: 'Notifications', hint: 'Manage alerts' },
  { icon: Shield, label: 'Privacy & Security', hint: 'Data & permissions' },
  { icon: Star, label: 'Rate TripPulse', hint: 'Share your feedback' },
  { icon: HelpCircle, label: 'Help & Support', hint: 'FAQs & contact' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useTripStore();

  const initials = user.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = () => {
    router.push('/login');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-5">
      {/* Profile header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
            <span className="text-white text-xl font-black">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-800">{user.display_name}</h2>
            <p className="text-slate-500 text-sm mt-0.5 truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-600 font-semibold">Active traveler</span>
            </div>
          </div>
        </div>

        {/* Member since */}
        <div className="mt-4 pt-4 border-t border-slate-50">
          <p className="text-xs text-slate-400 text-center">
            Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {statItems.map(({ label, value, emoji }) => (
          <div
            key={label}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-1">{emoji}</div>
            <p className="text-2xl font-black text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Wellness streak */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-2xl p-5 shadow-lg shadow-indigo-200 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">Wellness Streak</p>
            <p className="text-3xl font-black">3 days</p>
            <p className="text-indigo-200 text-sm mt-0.5">Keep checking in to grow your streak!</p>
          </div>
          <div className="text-5xl">🔥</div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <div
              key={i}
              className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                i < 3
                  ? 'bg-white text-indigo-700'
                  : 'bg-white/20 text-indigo-300'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {menuItems.map(({ icon: Icon, label, hint }, idx) => (
          <button
            key={label}
            className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left ${
              idx < menuItems.length - 1 ? 'border-b border-slate-50' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Icon size={17} className="text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700">{label}</p>
              <p className="text-xs text-slate-400">{hint}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 shrink-0" />
          </button>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-red-50 border border-red-100 text-red-600 font-semibold rounded-2xl hover:bg-red-100 hover:border-red-200 transition-all duration-200 text-sm"
      >
        <LogOut size={16} />
        Sign Out
      </button>

      <p className="text-center text-xs text-slate-400 pb-2">TripPulse v1.0.0 — Hackathon Demo</p>
    </div>
  );
}
