'use client';

import { useRouter } from 'next/navigation';
import { useTripStore } from '@/store/trip-store';
import { ChevronRight, Bell, Shield, HelpCircle, Star } from 'lucide-react';

const menuItems = [
  { icon: Bell, label: 'Notifications', hint: 'Manage alerts' },
  { icon: Shield, label: 'Privacy & Security', hint: 'Data & permissions' },
  { icon: Star, label: 'Rate Roamio', hint: 'Share your feedback' },
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
    <div className="max-w-md mx-auto px-5 py-8 space-y-6">
      {/* Avatar and name */}
      <div className="flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-[#8B9A7B] flex items-center justify-center mb-4">
          <span className="text-white text-2xl font-bold">{initials}</span>
        </div>
        <h2 className="text-xl font-bold text-[#1A1A1A]">{user.display_name}</h2>
        <p className="text-[#6B6B6B] text-sm mt-0.5">{user.email}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-8 py-4">
        {[
          { label: 'Trips', value: '2' },
          { label: 'Activities', value: '9' },
          { label: 'Check-ins', value: '2' },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-2xl font-bold text-[#1A1A1A]">{value}</p>
            <p className="text-xs text-[#6B6B6B] font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Menu */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {menuItems.map(({ icon: Icon, label, hint }, idx) => (
          <button
            key={label}
            className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-[#FAF8F5] transition-colors text-left ${
              idx < menuItems.length - 1 ? 'border-b border-[#F0EDE7]' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-[#F0EDE7] flex items-center justify-center shrink-0">
              <Icon size={17} className="text-[#6B6B6B]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
              <p className="text-xs text-[#ADADAD]">{hint}</p>
            </div>
            <ChevronRight size={16} className="text-[#ADADAD] shrink-0" />
          </button>
        ))}
      </div>

      {/* Sign out */}
      <div className="text-center pt-2">
        <button
          onClick={handleSignOut}
          className="text-[#6B6B6B] text-sm font-medium hover:text-[#1A1A1A] transition-colors"
        >
          Sign Out
        </button>
      </div>

      <p className="text-center text-xs text-[#ADADAD] pb-2">Roamio v1.0.0</p>
    </div>
  );
}
