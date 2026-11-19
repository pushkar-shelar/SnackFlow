'use client';

import React, { useState } from 'react';
import {
  FileCheck2,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  BarChart3,
} from 'lucide-react';

export default function AuditorReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>('stock-summary');
  const [dateRange, setDateRange] = useState<string>('THIS_MONTH');

  const reportList = [
    { id: 'stock-summary', name: 'Stock Summary (விற்பனை சரக்கு விவரம்)', category: 'Inventory' },
    { id: 'stock-ledger', name: 'Stock Movement Ledger (Append-Only Audit)', category: 'Inventory' },
    { id: 'gst-summary', name: 'GST Summary (GSTR-1 / GSTR-3B Split)', category: 'Compliance' },
    { id: 'sales-register', name: 'Sales Register (Invoice-wise Summary)', category: 'Sales' },
    { id: 'production-report', name: 'Production & Yield Variance Report', category: 'Manufacturing' },
    { id: 'costing-comparison', name: 'Costing Sensitivity (WAC vs FIFO)', category: 'Costing' },
    { id: 'ageing-report', name: 'Debtor Receivables Ageing Report', category: 'Finance' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-stone-200 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-xs font-bold mb-2">
            <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
            Statutory Auditor Hub • தணிக்கையாளர் பார்வை
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            Compliance & Financial Reports Hub
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Strict read-only verification hub with complete drill-down from stock balances to append-only ledger rows.
          </p>
        </div>

        {/* Date presets & Export buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
            {['THIS_MONTH', 'LAST_MONTH', 'FY_2026_27'].map((d) => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dateRange === d ? 'bg-white shadow-xs text-stone-900' : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {d === 'THIS_MONTH' ? 'This Month' : d === 'LAST_MONTH' ? 'Last Month' : 'FY 26-27'}
              </button>
            ))}
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => alert('Exporting Excel report...')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              onClick={() => alert('Exporting CSV report...')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={() => alert('Exporting PDF audit pack...')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Report Selector, Right Interactive Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Report Menu (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 px-2 mb-1">
            Available Reports
          </div>
          {reportList.map((rep) => {
            const isSelected = selectedReport === rep.id;
            return (
              <button
                key={rep.id}
                onClick={() => setSelectedReport(rep.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-500/10'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div>
                  <div className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-stone-900'}`}>
                    {rep.name}
                  </div>
                  <span className="text-[10px] text-stone-400 font-semibold">{rep.category}</span>
                </div>
                <Eye className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-stone-300'}`} />
              </button>
            );
          })}
        </div>

        {/* Right Report Preview Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {reportList.find((r) => r.id === selectedReport)?.name}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Period: FY 2026-27 • Company: Sri Murugan Snacks (GSTIN: 33AAAAA0000A1Z5)
              </p>
            </div>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
              Verified Reconciled
            </span>
          </div>

          {/* Section 14 Live Reconciled Benchmark Preview */}
          {selectedReport === 'stock-summary' && (
            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3 text-right">Closing Qty</th>
                    <th className="p-3 text-right">Valuation (WAC)</th>
                    <th className="p-3 text-right">Closing Value</th>
                    <th className="p-3 text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  <tr>
                    <td className="p-3 font-mono font-bold">RAW-FLOUR</td>
                    <td className="p-3 font-medium">Rice Flour (அரிசி மாவு)</td>
                    <td className="p-3 text-right font-bold text-stone-900">120.0000 KG</td>
                    <td className="p-3 text-right">₹43.125 / KG</td>
                    <td className="p-3 text-right font-bold text-stone-900">₹5,175.00</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Exact</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold">RAW-OIL</td>
                    <td className="p-3 font-medium">Cooking Oil (எண்ணெய்)</td>
                    <td className="p-3 text-right font-bold text-stone-900">19.5000 L</td>
                    <td className="p-3 text-right">₹140.000 / L</td>
                    <td className="p-3 text-right font-bold text-stone-900">₹2,730.00</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Exact</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold">RAW-SPICE</td>
                    <td className="p-3 font-medium">Spice Mix (மசாலா)</td>
                    <td className="p-3 text-right font-bold text-stone-900">3.8000 KG</td>
                    <td className="p-3 text-right">₹200.000 / KG</td>
                    <td className="p-3 text-right font-bold text-stone-900">₹760.00</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Exact</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold">PKG-POUCH-200G</td>
                    <td className="p-3 font-medium">Printed Pouches 200g</td>
                    <td className="p-3 text-right font-bold text-stone-900">306.0000 PCS</td>
                    <td className="p-3 text-right">₹2.500 / PCS</td>
                    <td className="p-3 text-right font-bold text-stone-900">₹765.00</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Exact</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold">PKG-CARTON-20PKT</td>
                    <td className="p-3 font-medium">Cartons (20 PKT)</td>
                    <td className="p-3 text-right font-bold text-stone-900">21.0000 PCS</td>
                    <td className="p-3 text-right">₹15.000 / PCS</td>
                    <td className="p-3 text-right font-bold text-stone-900">₹315.00</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Exact</span>
                    </td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="p-3 font-mono font-bold">FG-MUR-200G</td>
                    <td className="p-3 font-bold text-stone-900">Murukku 200g (Finished Good)</td>
                    <td className="p-3 text-right font-black text-amber-900">88.0000 PKT</td>
                    <td className="p-3 text-right font-bold">₹31.144 / PKT</td>
                    <td className="p-3 text-right font-black text-amber-900">₹2,740.67</td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">FEFO Matched</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {selectedReport === 'gst-summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[10px] font-bold text-stone-400 uppercase">Taxable Outward Supplies</div>
                  <div className="text-xl font-bold text-stone-900 mt-1">₹7,500.00</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">HSN 2106 90 99 (Namkeen)</div>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[10px] font-bold text-stone-400 uppercase">CGST (2.5%) + SGST (2.5%)</div>
                  <div className="text-xl font-bold text-stone-900 mt-1">₹375.00</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">₹187.50 + ₹187.50 Intra-State (TN)</div>
                </div>
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-[10px] font-bold text-stone-400 uppercase">Total Invoice Value</div>
                  <div className="text-xl font-bold text-amber-800 mt-1">₹7,875.00</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">GSTR-1 Ready Document</div>
                </div>
              </div>
            </div>
          )}

          {selectedReport !== 'stock-summary' && selectedReport !== 'gst-summary' && (
            <div className="p-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200 text-stone-500 text-xs">
              <BarChart3 className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              Previewing live data for {selectedReport}. Click Excel or PDF to export full official audit schedule.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
