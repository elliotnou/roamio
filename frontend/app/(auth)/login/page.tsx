'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Wordmark */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-[#8B9A7B] tracking-tight">
            Roamio
          </h1>
          <p className="text-[#6B6B6B] mt-3 text-sm">Your wellness travel companion</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-5 py-3.5 rounded-2xl border border-[#E5E0D8] bg-white text-[#1A1A1A] placeholder-[#ADADAD] focus:outline-none focus:ring-2 focus:ring-[#8B9A7B]/40 focus:border-[#8B9A7B] transition-all text-sm"
              required
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-5 py-3.5 rounded-2xl border border-[#E5E0D8] bg-white text-[#1A1A1A] placeholder-[#ADADAD] focus:outline-none focus:ring-2 focus:ring-[#8B9A7B]/40 focus:border-[#8B9A7B] transition-all text-sm"
              required
            />
          </div>

          <form onSubmit={handleSignIn}>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#2C2C2C] text-white font-semibold rounded-full shadow-sm hover:bg-[#1A1A1A] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[#6B6B6B] text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#6B7A5E] font-semibold hover:text-[#5a6b4e] transition-colors">
              Create one
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[#ADADAD] mt-6">
          Demo — enter any email and password to continue
        </p>
      </div>
    </div>
  );
}
