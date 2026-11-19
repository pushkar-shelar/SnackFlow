'use client';

import React from 'react';
import {
  PieChart,
  TrendingUp,
  Percent,
  AlertTriangle,
  Wallet,
  ShieldCheck,
} from 'lucide-react';

export default function OwnerDashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
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
          <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Live Plant Data Reconciled
          </span>
        </div>
      </div>

      {/* 4 Core Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Invoiced Sales */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
            <span>Invoiced Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-stone-900">₹7,875.00</div>
          <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
            <span>150 PKT Murukku 200g (Retailer A)</span>
          </div>
        </div>

        {/* Gross Margin % */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
            <span>Gross Margin (WAC)</span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">37.7%</div>
          <div className="text-xs text-stone-500">
            ₹18.86 margin / packet on ₹50 selling price
          </div>
        </div>

        {/* Plant Yield Variance */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
            <span>Plant Yield Variance</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">-6.0%</div>
          <div className="text-xs text-rose-600 font-semibold">
            188 vs 200 std • Flagged &gt;3% tolerance
          </div>
        </div>

        {/* Collections */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider">
            <span>UPI & Cash Receipts</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900">₹4,000.00</div>
          <div className="text-xs text-stone-500">
            UPI/20260411/001 • Retailer A
          </div>
        </div>
      </div>

      {/* Grid: Left Costing Sensitivity (WAC vs FIFO), Right Debtor Receivables Ageing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Costing Engine Comparison Table (6 cols) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Costing Sensitivity Analysis</h2>
              <p className="text-xs text-stone-500">
                Authoritative WAC vs FIFO sensitivity for Murukku 200g run
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
                  <th className="p-3">Cost Component</th>
                  <th className="p-3 text-right">WAC (Primary)</th>
                  <th className="p-3 text-right">FIFO (Sensitivity)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="p-3">Flour (40 kg)</td>
                  <td className="p-3 text-right font-medium">₹1,725.00 (@ ₹43.125)</td>
                  <td className="p-3 text-right text-stone-500">₹1,680.00 (@ ₹42.00)</td>
                </tr>
                <tr>
                  <td className="p-3">Cooking Oil (10.5 L)</td>
                  <td className="p-3 text-right font-medium">₹1,470.00 (@ ₹140.00)</td>
                  <td className="p-3 text-right text-stone-500">₹1,470.00 (@ ₹140.00)</td>
                </tr>
                <tr>
                  <td className="p-3">Spice Mix (1.2 kg)</td>
                  <td className="p-3 text-right font-medium">₹240.00 (@ ₹200.00)</td>
                  <td className="p-3 text-right text-stone-500">₹240.00 (@ ₹200.00)</td>
                </tr>
                <tr>
                  <td className="p-3">Packaging (194 Pouches + 9 Boxes)</td>
                  <td className="p-3 text-right font-medium">₹620.00</td>
                  <td className="p-3 text-right text-stone-500">₹620.00</td>
                </tr>
                <tr>
                  <td className="p-3">Factory Overheads Allocation</td>
                  <td className="p-3 text-right font-medium">₹1,800.00</td>
                  <td className="p-3 text-right text-stone-500">₹1,800.00</td>
                </tr>
                <tr className="bg-amber-50/60 font-bold">
                  <td className="p-3 text-stone-900">Total Run Cost (188 pkts)</td>
                  <td className="p-3 text-right text-amber-900">₹5,855.00</td>
                  <td className="p-3 text-right text-stone-700">₹5,810.00</td>
                </tr>
                <tr className="bg-stone-50 font-black">
                  <td className="p-3 text-stone-900">Unit Cost per Packet</td>
                  <td className="p-3 text-right text-amber-800 text-sm">₹31.14</td>
                  <td className="p-3 text-right text-stone-800 text-sm">₹30.90</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Debtor Ageing & Outstanding Balance (6 cols) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900">Receivables Ageing Analysis</h2>
              <p className="text-xs text-stone-500">
                Outstanding balances by customer payment terms
              </p>
            </div>
            <span className="text-xs font-bold text-stone-900">
              Total Outstanding: <b className="text-amber-800">₹3,875.00</b>
            </span>
          </div>

          {/* Ageing Buckets */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-800">0 - 30 Days</div>
              <div className="text-base font-extrabold text-emerald-900 mt-1">₹3,875</div>
              <div className="text-[9px] text-emerald-700">Current (Retailer A)</div>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 opacity-60">
              <div className="text-[10px] font-bold text-stone-500">31 - 60 Days</div>
              <div className="text-base font-extrabold text-stone-800 mt-1">₹0</div>
              <div className="text-[9px] text-stone-400">Clear</div>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 opacity-60">
              <div className="text-[10px] font-bold text-stone-500">61 - 90 Days</div>
              <div className="text-base font-extrabold text-stone-800 mt-1">₹0</div>
              <div className="text-[9px] text-stone-400">Clear</div>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 opacity-60">
              <div className="text-[10px] font-bold text-stone-500">&gt; 90 Days</div>
              <div className="text-base font-extrabold text-stone-800 mt-1">₹0</div>
              <div className="text-[9px] text-stone-400">Clear</div>
            </div>
          </div>

          {/* Customer Outstanding Breakdown */}
          <div className="border border-stone-200 rounded-xl overflow-hidden mt-2">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 font-bold uppercase text-[10px] text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3 text-right">Invoiced</th>
                  <th className="p-3 text-right">Settled</th>
                  <th className="p-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="p-3">
                    <div className="font-bold text-stone-900">Sri Murugan Stores (Retailer A)</div>
                    <div className="text-[10px] text-stone-400">Madurai • 30 Day Credit</div>
                  </td>
                  <td className="p-3 text-right">₹7,875.00</td>
                  <td className="p-3 text-right text-emerald-700 font-medium">₹4,000.00</td>
                  <td className="p-3 text-right font-black text-amber-900">₹3,875.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
