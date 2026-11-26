'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch, getStoredSession } from '@/lib/api';
import { RbacGate } from '@/components/common/RbacGate';
import {
  PieChart,
  TrendingUp,
  Percent,
  AlertTriangle,
  Wallet,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export default function OwnerDashboardPage() {
  const [salesSummary, setSalesSummary] = useState<any | null>(null);
  const [collections, setCollections] = useState<any | null>(null);
  const [production, setProduction] = useState<any | null>(null);
  const [costing, setCosting] = useState<any | null>(null);
  const [ageing, setAgeing] = useState<any | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadOwnerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesRes, colRes, prodRes, costRes, ageRes, alertsRes, eqRes] = await Promise.all([
        apiFetch<any>('/reports/sales-register'),
        apiFetch<any>('/reports/collections'),
        apiFetch<any>('/reports/production'),
        apiFetch<any>('/reports/costing-comparison'),
        apiFetch<any>('/reports/outstanding-ageing'),
        apiFetch<any[]>('/alerts'),
        apiFetch<any[]>('/production/equipment'),
      ]);
      setSalesSummary(salesRes);
      setCollections(colRes);
      setProduction(prodRes);
      setCosting(costRes);
      setAgeing(ageRes);
      if (Array.isArray(alertsRes)) setAlerts(alertsRes);
      if (Array.isArray(eqRes)) setEquipment(eqRes);
    } catch (e: any) {
      setError(e.message || 'Could not load owner analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const session = getStoredSession();
    if (!session || !['OWNER', 'ADMIN'].includes(session.role)) {
      setLoading(false);
      return;
    }
    loadOwnerData();
  }, []);

  const totalGrand = Number(salesSummary?.summary?.totalGrand ?? 0);
  const totalCollected = Number(collections?.totalCollected ?? 0);
  const totalOutstanding = Number(ageing?.grandTotalOutstanding ?? 0);
  const latestCost = costing?.rows?.[0];
  const latestProd = production?.rows?.[0];
  const ageingRows = ageing?.rows ?? [];

  const bucketTotals = ageingRows.reduce(
    (acc: any, r: any) => ({
      b0: acc.b0 + Number(r.bucket0To30 || 0),
      b31: acc.b31 + Number(r.bucket31To60 || 0),
      b61: acc.b61 + Number(r.bucket61To90 || 0),
      b90: acc.b90 + Number(r.bucket90Plus || 0),
    }),
    { b0: 0, b31: 0, b61: 0, b90: 0 },
  );

  return (
    <RbacGate
      allowedRoles={['OWNER', 'ADMIN']}
      portalName="Owner Business Intelligence & Margin Control"
      requiredPermission="DASHBOARD_READ"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-200 gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-2">
              <PieChart className="w-3.5 h-3.5 text-amber-600" />
              Executive Overview • நிர்வாக இயக்குநர் பார்வை
            </div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">
              Owner Business Intelligence & Margin Control
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Real-time gross margins, plant yield variances, debtor ageing, and collection health.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOwnerData}
              disabled={loading}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Live Plant Data ({equipment.length} Machines)
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
            {error}
          </div>
        )}

        {/* 4 Core Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
              <span>Invoiced Sales</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-stone-900">
              ₹{totalGrand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-700 font-semibold">
              {salesSummary?.summary?.totalInvoices ?? 0} Posted Invoices
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
              <span>Gross Margin (WAC)</span>
              <Percent className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700">
              {latestCost ? `${latestCost.grossMarginPct}%` : '—'}
            </div>
            <div className="text-xs text-stone-500">
              {latestCost
                ? `₹${latestCost.grossMarginPerUnit} margin / pkt (WAC ₹${latestCost.wacUnitCost})`
                : 'No completed costing runs yet'}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
              <span>Plant Yield Variance</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div
              className={`text-2xl font-black ${
                latestProd?.isYieldFlagged ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {latestProd ? `${Number(latestProd.yieldVariancePct).toFixed(1)}%` : '0.0%'}
            </div>
            <div className="text-xs text-stone-500 font-semibold">
              {latestProd
                ? `${latestProd.actualYield} vs ${latestProd.plannedYield} std (${latestProd.runNumber})`
                : 'No production runs recorded yet'}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
              <span>UPI & Cash Receipts</span>
              <Wallet className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-900">
              ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-stone-500">
              {collections?.totalCollections ?? 0} Recorded Receipts
            </div>
          </div>
        </div>

        {/* Live Alerts Banner */}
        {alerts.length > 0 && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Active Operational Alerts ({alerts.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {alerts.slice(0, 4).map((al) => (
                <div key={al.id} className="bg-white p-3 rounded-xl border border-amber-200 text-xs">
                  <div className="font-bold text-stone-900">{al.title}</div>
                  <div className="text-stone-600 mt-0.5">{al.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Costing Sensitivity Comparison Table */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h2 className="text-sm font-bold text-stone-900">Costing Sensitivity Analysis</h2>
                <p className="text-xs text-stone-500">
                  Live WAC vs FIFO comparison across production batches
                </p>
              </div>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                Ind AS 2 Compliant
              </span>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 font-bold uppercase text-[10px] text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="p-3">Run / Batch</th>
                    <th className="p-3 text-right">WAC Unit</th>
                    <th className="p-3 text-right">FIFO Unit</th>
                    <th className="p-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(costing?.rows?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-stone-400">
                        No production costing runs posted yet.
                      </td>
                    </tr>
                  ) : (
                    costing.rows.map((row: any) => (
                      <tr key={row.runNumber}>
                        <td className="p-3 font-mono font-bold text-stone-900">
                          {row.runNumber} ({row.actualYield} PKT)
                        </td>
                        <td className="p-3 text-right font-medium">₹{row.wacUnitCost}</td>
                        <td className="p-3 text-right text-stone-500">₹{row.fifoUnitCost}</td>
                        <td className="p-3 text-right font-bold text-amber-800">{row.grossMarginPct}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receivables Ageing Analysis */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h2 className="text-sm font-bold text-stone-900">Receivables Ageing Analysis</h2>
                <p className="text-xs text-stone-500">Outstanding customer balances by bucket</p>
              </div>
              <span className="text-xs font-bold text-stone-900">
                Total Outstanding: <b className="text-amber-800">₹{totalOutstanding.toFixed(2)}</b>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-800">0 - 30 Days</div>
                <div className="text-sm font-extrabold text-emerald-900 mt-1">₹{bucketTotals.b0.toFixed(0)}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-500">31 - 60 Days</div>
                <div className="text-sm font-extrabold text-stone-800 mt-1">₹{bucketTotals.b31.toFixed(0)}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-500">61 - 90 Days</div>
                <div className="text-sm font-extrabold text-stone-800 mt-1">₹{bucketTotals.b61.toFixed(0)}</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] font-bold text-stone-500">&gt; 90 Days</div>
                <div className="text-sm font-extrabold text-stone-800 mt-1">₹{bucketTotals.b90.toFixed(0)}</div>
              </div>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden mt-2">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 font-bold uppercase text-[10px] text-stone-500 border-b border-stone-200">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3 text-right">0-30 Days</th>
                    <th className="p-3 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {ageingRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-stone-400">
                        No open customer balances.
                      </td>
                    </tr>
                  ) : (
                    ageingRows.map((c: any) => (
                      <tr key={c.customerId || c.customerName}>
                        <td className="p-3 font-bold text-stone-900">{c.customerName}</td>
                        <td className="p-3 text-right font-mono">₹{c.bucket0To30}</td>
                        <td className="p-3 text-right font-black text-amber-900">₹{c.totalOutstanding}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </RbacGate>
  );
}
