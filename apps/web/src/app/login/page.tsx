'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SEEDED_ACCOUNTS,
  getStoredSession,
  login,
} from '@/lib/api';
import {
  ShieldCheck,
  ShoppingBag,
  Inbox,
  Factory,
  FileCheck2,
  PieChart,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  const [email, setEmail] = useState<string>('salesman@snackflow.local');
  const [password, setPassword] = useState<string>('Password123!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect to intended target or default
  useEffect(() => {
    const existing = getStoredSession();
    if (existing) {
      const target = redirectUrl || getRoleDefaultPath(existing.role);
      router.push(target);
    }
  }, [redirectUrl, router]);

  const getRoleDefaultPath = (role: string): string => {
    switch (role) {
      case 'SALESMAN':
        return '/sales';
      case 'ADMIN':
        return '/admin/orders';
      case 'PRODUCTION':
        return '/production';
      case 'AUDITOR':
        return '/audit';
      case 'OWNER':
        return '/owner';
      default:
        return '/';
    }
  };

  const handleSignIn = async (
    targetEmail: string = email,
    targetPassword: string = password,
    targetPath?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const session = await login(targetEmail, targetPassword);
      const destination = targetPath || redirectUrl || getRoleDefaultPath(session.role);
      router.push(destination);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (acc: (typeof SEEDED_ACCOUNTS)[number]) => {
    setEmail(acc.email);
    setPassword('Password123!');
    handleSignIn(acc.email, 'Password123!', acc.path);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SALESMAN':
        return ShoppingBag;
      case 'ADMIN':
        return Inbox;
      case 'PRODUCTION':
        return Factory;
      case 'AUDITOR':
        return FileCheck2;
      case 'OWNER':
        return PieChart;
      default:
        return ShieldCheck;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SALESMAN':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PRODUCTION':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'AUDITOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'OWNER':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            Sri Murugan Snacks ERP
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Sign In to SnackFlow
          </h1>
          <p className="text-xs sm:text-sm text-stone-600">
            Enter credentials or select a pre-configured role account below
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium animate-fadeIn">
            {error}
          </div>
        )}

        {/* Manual Credentials Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSignIn();
          }}
          className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@snackflow.local"
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-stone-900 font-medium transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-stone-900 font-medium transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Default password for all demo accounts: <code className="bg-stone-100 px-1 py-0.5 rounded font-mono font-bold text-stone-700">Password123!</code>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Demo Accounts Quick Selector */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px bg-stone-200 flex-1" />
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
              Or Instant 1-Click Role Login
            </span>
            <div className="h-px bg-stone-200 flex-1" />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {SEEDED_ACCOUNTS.map((acc) => {
              const Icon = getRoleIcon(acc.role);
              const badgeClass = getRoleBadgeColor(acc.role);
              const isSelected = email === acc.email;

              return (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleQuickLogin(acc)}
                  disabled={loading}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-1 ring-amber-500'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-stone-100 text-stone-700">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-stone-900">{acc.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeClass}`}>
                          {acc.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate max-w-[220px]">
                        {acc.email}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
