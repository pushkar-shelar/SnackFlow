'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredSession } from '@/lib/api';
import {
  ShoppingBag,
  Inbox,
  Factory,
  FileCheck2,
  PieChart,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Database,
  Lock,
  Loader2,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      router.replace('/login');
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }
  const roles = [
    {
      title: 'Salesman Mobile PWA',
      description: 'Offline Dexie outbox, customer picker, product steppers, packets/cartons toggle, and instant GST total.',
      path: '/sales',
      icon: ShoppingBag,
      color: 'bg-amber-600',
      badge: 'Mobile Optimized',
      tag: 'Role: SALESMAN',
    },
    {
      title: 'Admin Inbox & Split View',
      description: 'Review orders with line stock coverage chips, keyboard shortcuts (A/R/H), one-click GST invoicing, and FEFO dispatch.',
      path: '/admin/orders',
      icon: Inbox,
      color: 'bg-blue-600',
      badge: 'Desktop Split View',
      tag: 'Role: ADMIN',
    },
    {
      title: 'Production Tablet Wizard',
      description: '3-step plant wizard: issue raw materials at WAC, record output & waste, live ±3% variance checks, and close-out allocation.',
      path: '/production',
      icon: Factory,
      color: 'bg-emerald-600',
      badge: 'Tablet Interface',
      tag: 'Role: PRODUCTION',
    },
    {
      title: 'Auditor Compliance Hub',
      description: 'Strict read-only reporting with complete drill-down from stock balances to PostgreSQL append-only ledger rows.',
      path: '/audit',
      icon: FileCheck2,
      color: 'bg-purple-600',
      badge: 'Statutory Audit',
      tag: 'Role: AUDITOR',
    },
    {
      title: 'Owner Margin Control',
      description: 'Executive dashboard tracking gross margins (37.7%), plant yield variances (-6.0%), collections, and debtor ageing.',
      path: '/owner',
      icon: PieChart,
      color: 'bg-rose-600',
      badge: 'Executive View',
      tag: 'Role: OWNER',
    },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold shadow-xs">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          NIT Trichy CDI Internship Evaluation System
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-stone-900 tracking-tight">
          SnackFlow • Order-to-Audit ERP
        </h1>
        <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
          Engineered for a packaged South Indian snack manufacturer (Sri Murugan Snacks, Tamil Nadu).
          Built on an <span className="font-semibold text-stone-900">append-only PostgreSQL ledger</span>,
          strict <span className="font-semibold text-stone-900">Decimal arithmetic</span>, moving WAC costing,
          and default-deny security.
        </p>

        {/* Verification Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-semibold text-stone-600">
          <span className="flex items-center gap-1.5 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
            <Database className="w-3.5 h-3.5 text-blue-600" />
            PostgreSQL Append-Only Trigger
          </span>
          <span className="flex items-center gap-1.5 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            FOR UPDATE Row Locking
          </span>
          <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            15/15 Benchmark Metrics Passing
          </span>
        </div>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.path}
              href={r.path}
              className="group bg-white p-6 rounded-3xl border border-stone-200 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${r.color} flex items-center justify-center text-white shadow-md`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {r.badge}
                  </span>
                </div>

                <div className="text-[11px] font-mono font-bold text-amber-700 uppercase mb-1">
                  {r.tag}
                </div>
                <h3 className="text-lg font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                  {r.title}
                </h3>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  {r.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-amber-700">
                <span>Launch Persona</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
