'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, Heart, User } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home },
  { href: '/trips', icon: Map },
  { href: '/dashboard', icon: Heart },
  { href: '/profile', icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col">
      {/* Main content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom navigation - icon only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E5E0D8]/60">
        <div className="max-w-md mx-auto px-2">
          <div className="flex items-center justify-around h-16">
            {navItems.map(({ href, icon: Icon }, idx) => {
              const isActive =
                href === '/dashboard'
                  ? pathname === '/dashboard' && idx === 0
                  : pathname.startsWith(href);

              return (
                <Link
                  key={`${href}-${idx}`}
                  href={href}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
                    isActive
                      ? 'text-[#8B9A7B]'
                      : 'text-[#ADADAD] hover:text-[#6B6B6B]'
                  }`}
                >
                  <Icon
                    size={22}
                    className={isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
