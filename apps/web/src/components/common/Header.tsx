'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SEEDED_ACCOUNTS,
  getStoredSession,
  login,
  logout,
  UserSession,
} from '@/lib/api';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ShoppingBag,
  Inbox,
  Factory,
  FileCheck2,
  PieChart,
  Wifi,
  WifiOff,
  UserCheck,
  ChevronDown,
  LogOut,
  Lock,
} from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [currentLang, setCurrentLang] = useState<'ta' | 'en'>('ta');

  // Monitor Dexie queued orders count
  const queuedCount = useLiveQuery(
    () => db.queuedOrders.where('syncStatus').equals('QUEUED').count(),
    [],
    0,
  );

  useEffect(() => {
    const isPublic = pathname === '/login' || pathname.startsWith('/public');
    const current = getStoredSession();
    setSession(current);

    // If unauthenticated and trying to access a protected route, redirect to /login
    if (!current && !isPublic) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }

    const syncSession = () => {
      const s = getStoredSession();
      setSession(s);
      if (!s && !isPublic) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    };
    window.addEventListener('storage', syncSession);

    // Monitor online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pathname, router]);

  const handleRoleChange = async (email: string, targetPath: string) => {
    setIsSwitching(true);
    try {
      const newSession = await login(email, 'Password123!');
      setSession(newSession);
      router.push(targetPath);
    } catch (e: any) {
      alert(`Role switch failed: ${e.message}`);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleLogout = () => {
    logout();
    setSession(null);
    router.push('/login');
  };

  const navItems: Array<{
    label: string;
    path: string;
    icon: any;
    role: 'SALESMAN' | 'ADMIN' | 'PRODUCTION' | 'AUDITOR' | 'OWNER';
    allowedRoles: Array<'SALESMAN' | 'ADMIN' | 'PRODUCTION' | 'AUDITOR' | 'OWNER'>;
    email: string;
  }> = [
    { label: 'Salesman (PWA)', path: '/sales', icon: ShoppingBag, role: 'SALESMAN', allowedRoles: ['SALESMAN', 'ADMIN', 'OWNER'], email: 'salesman@snackflow.local' },
    { label: 'Admin Inbox', path: '/admin/orders', icon: Inbox, role: 'ADMIN', allowedRoles: ['ADMIN', 'OWNER'], email: 'admin@snackflow.local' },
    { label: 'Production Wizard', path: '/production', icon: Factory, role: 'PRODUCTION', allowedRoles: ['PRODUCTION', 'ADMIN', 'OWNER'], email: 'production@snackflow.local' },
    { label: 'Auditor Reports', path: '/audit', icon: FileCheck2, role: 'AUDITOR', allowedRoles: ['AUDITOR', 'ADMIN', 'OWNER'], email: 'auditor@snackflow.local' },
    { label: 'Owner Insights', path: '/owner', icon: PieChart, role: 'OWNER', allowedRoles: ['OWNER', 'ADMIN'], email: 'owner@snackflow.local' },
  ];

  // If on login page, display clean minimal header
  if (pathname === '/login') {
    return (
      <header className="sticky top-0 z-50 border-b border-amber-950/10 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-amber-600/20">
                மு
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-stone-900 tracking-tight text-lg">SnackFlow</span>
                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase tracking-wider">NIT-T CDI</span>
                </div>
                <p className="text-xs text-stone-500 font-medium">Sri Murugan Snacks • மதுரை</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const newLang = currentLang === 'ta' ? 'en' : 'ta';
                  setCurrentLang(newLang);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('snackflow_lang', newLang);
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
                title="Toggle Tamil / English (மொழி மாற்றம்)"
              >
                <span>{currentLang === 'ta' ? 'தமிழ்' : 'English'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-amber-950/10 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Company */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-amber-600/20 group-hover:scale-105 transition-transform">
                மு
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-stone-900 tracking-tight text-lg">SnackFlow</span>
                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase tracking-wider">NIT-T CDI</span>
                </div>
                <p className="text-xs text-stone-500 font-medium">Sri Murugan Snacks • மதுரை</p>
              </div>
            </Link>
          </div>

          {/* Persona Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100/80 p-1 rounded-xl border border-stone-200/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.path);
              const isRestricted = session && !item.allowedRoles.includes(session.role);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-amber-900 shadow-xs border border-stone-200/80'
                      : isRestricted
                      ? 'text-stone-400 hover:text-stone-700 hover:bg-stone-200/40'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
                  }`}
                  title={isRestricted ? `Restricted: Requires ${item.allowedRoles.join(' or ')} role` : undefined}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-600' : isRestricted ? 'text-stone-300' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                  {isRestricted && (
                    <Lock className="w-2.5 h-2.5 text-stone-400 shrink-0 ml-0.5 opacity-60" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Status & Persona Badge */}
          <div className="flex items-center gap-2.5">
            {/* Language Toggle (T4.10) */}
            <button
              onClick={() => {
                const newLang = currentLang === 'ta' ? 'en' : 'ta';
                setCurrentLang(newLang);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('snackflow_lang', newLang);
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors shadow-2xs"
              title="Toggle Tamil / English (மொழி மாற்றம்)"
            >
              <span>{currentLang === 'ta' ? 'தமிழ்' : 'English'}</span>
            </button>

            {/* Online / Outbox Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-stone-50 border-stone-200">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-stone-700 hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                  <span className="text-rose-700 font-semibold">Offline</span>
                </>
              )}
              {queuedCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {queuedCount} queued
                </span>
              )}
            </div>

            {/* Active User Pill with Dropdown */}
            {session ? (
              <div className="relative group">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200/70 border border-stone-200/80 text-xs font-medium text-stone-800 cursor-pointer transition">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline font-semibold">{session.name}</span>
                  <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {session.role}
                  </span>
                  <ChevronDown className="w-3 h-3 text-stone-400" />
                </div>

                {/* Dropdown for role switching & logout */}
                <div className="absolute right-0 mt-1 w-64 bg-white border border-stone-200 rounded-xl shadow-lg p-1.5 hidden group-hover:block z-50">
                  <div className="px-2 py-1.5 border-b border-stone-100 mb-1">
                    <p className="text-[11px] font-bold text-stone-900">{session.name}</p>
                    <p className="text-[10px] text-stone-500">{session.email}</p>
                  </div>

                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 py-1">
                    Switch User Account
                  </p>
                  {SEEDED_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      disabled={isSwitching}
                      onClick={() => {
                        const target = navItems.find((n) => n.role === acc.role)?.path || '/';
                        handleRoleChange(acc.email, target);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-amber-50 transition-colors ${
                        session.email === acc.email ? 'bg-amber-50/80 font-bold text-amber-900' : 'text-stone-700'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{acc.name}</div>
                        <div className="text-[10px] text-stone-400">{acc.email}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-stone-500">{acc.role}</span>
                    </button>
                  ))}

                  <div className="my-1 border-t border-stone-100" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-rose-600 hover:bg-rose-50 font-semibold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out / Log Out
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
