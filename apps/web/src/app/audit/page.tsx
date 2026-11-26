'use client';

import React, { useState, useEffect } from 'react';
import { downloadReport, apiFetch, getStoredSession } from '@/lib/api';
import { RbacGate } from '@/components/common/RbacGate';
import {
  FileCheck2,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  RefreshCw,
} from 'lucide-react';

const EXPORT_TYPE_MAP: Record<string, string> = {
  'stock-summary': 'stock-summary',
  'stock-ledger': 'stock-ledger',
  'gst-summary': 'gst-summary',
  'sales-register': 'sales-register',
  'purchase-register': 'purchase-register',
  'production-report': 'production',
  'costing-comparison': 'costing-comparison',
  'collections-report': 'collections',
  'ageing-report': 'outstanding-ageing',
};

function getPresetDates(range: string): { startDate: string; endDate: string } {
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (range === 'LAST_MONTH') {
    return {
      startDate: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      endDate: fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (range === 'FY_2026_27') {
    return {
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    };
  }
  return {
    startDate: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export default function AuditorReportsPage() {
  const initialRange = getPresetDates('THIS_MONTH');
  const [selectedReport, setSelectedReport] = useState<string>('stock-summary');
  const [dateRange, setDateRange] = useState<string>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>(initialRange.startDate);
  const [customEndDate, setCustomEndDate] = useState<string>(initialRange.endDate);
  const [stockKindFilter, setStockKindFilter] = useState<'ALL' | 'RAW' | 'PACKAGING' | 'FINISHED'>('ALL');
  const [stockSummaryView, setStockSummaryView] = useState<'BATCH' | 'MOVEMENT'>('BATCH');
  const [salesSubTab, setSalesSubTab] = useState<'REGISTER' | 'CUSTOMER' | 'PRODUCT'>('REGISTER');
  const [stockBalances, setStockBalances] = useState<any[]>([]);
  const [stockPeriodSummary, setStockPeriodSummary] = useState<any[]>([]);
  const [stockLedger, setStockLedger] = useState<any[]>([]);
  const [salesRegister, setSalesRegister] = useState<any[]>([]);
  const [salesRegisterSummary, setSalesRegisterSummary] = useState<any | null>(null);
  const [salesByCustomer, setSalesByCustomer] = useState<any[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<any[]>([]);
  const [purchaseRegister, setPurchaseRegister] = useState<any[]>([]);
  const [productionReport, setProductionReport] = useState<any[]>([]);
  const [costingComparison, setCostingComparison] = useState<any[]>([]);
  const [ageingReport, setAgeingReport] = useState<any[]>([]);
  const [collectionsReport, setCollectionsReport] = useState<any | null>(null);
  const [gstSummary, setGstSummary] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [exportError, setExportError] = useState<string | null>(null);

  const getDateQueryParams = (range: string): { startDate: string; endDate: string } => {
    if (range === 'CUSTOM') {
      return {
        startDate: customStartDate || initialRange.startDate,
        endDate: customEndDate || initialRange.endDate,
      };
    }
    return getPresetDates(range);
  };

  const handleSelectPreset = (range: string) => {
    const preset = getPresetDates(range);
    setCustomStartDate(preset.startDate);
    setCustomEndDate(preset.endDate);
    setDateRange(range);
  };

  const loadAuditData = async (range = dateRange) => {
    setIsLoading(true);
    const { startDate, endDate } = getDateQueryParams(range);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isHistoricalCutoff = Boolean(endDate && endDate < todayStr);
    const qs = `?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    try {
      const [
        balancesData,
        stockSummaryPeriodData,
        ledgerData,
        salesData,
        salesCustData,
        salesProdData,
        purchaseData,
        prodData,
        costingData,
        ageingData,
        collectionsData,
        gstData,
      ] = await Promise.all([
        isHistoricalCutoff ? Promise.resolve(null) : apiFetch<any[]>('/inventory/balances'),
        apiFetch<any>(`/reports/stock-summary${qs}`),
        apiFetch<any[]>(`/inventory/ledger${qs}`),
        apiFetch<any>(`/reports/sales-register${qs}`),
        apiFetch<any[]>(`/reports/sales-by-customer${qs}`),
        apiFetch<any[]>(`/reports/sales-by-product${qs}`),
        apiFetch<any>(`/reports/purchase-register${qs}`),
        apiFetch<any>(`/reports/production${qs}`),
        apiFetch<any>(`/reports/costing-comparison${qs}`),
        apiFetch<any>(`/reports/outstanding-ageing${qs}`),
        apiFetch<any>(`/reports/collections${qs}`),
        apiFetch<any>(`/reports/gst-summary${qs}`),
      ]);
      if (Array.isArray(stockSummaryPeriodData?.rows)) {
        setStockPeriodSummary(stockSummaryPeriodData.rows);
      }
      if (isHistoricalCutoff && Array.isArray(stockSummaryPeriodData?.rows)) {
        setStockBalances(
          stockSummaryPeriodData.rows.map((r: any) => ({
            id: r.id,
            sku: r.code,
            name: r.name,
            kind: r.kind,
            uom: r.uom,
            qty: r.currentQty,
            value: r.currentValue,
            wac: r.wac,
            openingQty: r.openingQty,
            receiptsQty: r.receiptsQty,
            issuesQty: r.issuesQty,
          })),
        );
      } else if (Array.isArray(balancesData)) {
        setStockBalances(balancesData);
      }
      if (Array.isArray(ledgerData)) setStockLedger(ledgerData);
      if (Array.isArray(salesData?.rows)) setSalesRegister(salesData.rows);
      setSalesRegisterSummary(salesData?.summary || null);
      if (Array.isArray(salesCustData)) setSalesByCustomer(salesCustData);
      if (Array.isArray(salesProdData)) setSalesByProduct(salesProdData);
      if (Array.isArray(purchaseData?.rows)) setPurchaseRegister(purchaseData.rows);
      if (Array.isArray(prodData?.rows)) setProductionReport(prodData.rows);
      if (Array.isArray(costingData?.rows)) setCostingComparison(costingData.rows);
      if (Array.isArray(ageingData?.rows)) setAgeingReport(ageingData.rows);
      if (collectionsData) setCollectionsReport(collectionsData);
      if (gstData) setGstSummary(gstData);
    } catch (e) {
      console.warn('Failed to fetch live audit data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const session = getStoredSession();
    if (!session || !['AUDITOR', 'ADMIN', 'OWNER'].includes(session.role)) {
      setIsLoading(false);
      return;
    }
    loadAuditData(dateRange);
  }, [dateRange, customStartDate, customEndDate]);

  const reportList = [
    { id: 'stock-summary', name: 'Stock Summary (விற்பனை சரக்கு விவரம்)', category: 'Inventory' },
    { id: 'stock-ledger', name: 'Stock Movement Ledger (Append-Only Audit)', category: 'Inventory' },
    { id: 'gst-summary', name: 'GST Summary (GSTR-1 / GSTR-3B Split)', category: 'Compliance' },
    { id: 'sales-register', name: 'Sales Register (Invoices, Customer & Product)', category: 'Sales' },
    { id: 'purchase-register', name: 'Purchase Register (Vendor Inward & GRN)', category: 'Procurement' },
    { id: 'production-report', name: 'Production & Yield Variance Report', category: 'Manufacturing' },
    { id: 'costing-comparison', name: 'Costing Sensitivity (WAC vs FIFO)', category: 'Costing' },
    { id: 'collections-report', name: 'Collections & Payments Report', category: 'Finance' },
    { id: 'ageing-report', name: 'Debtor Receivables Ageing Report', category: 'Finance' },
  ];

  const handleExportTallyXml = async () => {
    setExportError(null);
    const { startDate, endDate } = getDateQueryParams(dateRange);
    const session = getStoredSession();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    try {
      const res = await fetch(
        `${apiBase}/reports/tally-xml?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
        {
          headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
          credentials: 'include',
        },
      );
      if (!res.ok) {
        throw new Error(`Tally XML export failed (${res.status})`);
      }
      const xmlText = await res.text();
      const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tally-vouchers-${startDate}-to-${endDate}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setExportError(e?.message || 'Tally XML export failed');
    }
  };

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    setExportError(null);
    let reportKey = EXPORT_TYPE_MAP[selectedReport] || selectedReport;
    if (selectedReport === 'sales-register') {
      reportKey =
        salesSubTab === 'CUSTOMER'
          ? 'sales-by-customer'
          : salesSubTab === 'PRODUCT'
          ? 'sales-by-product'
          : 'sales-register';
    }
    try {
      await downloadReport(reportKey, format, getDateQueryParams(dateRange));
    } catch (e: any) {
      setExportError(e.message || `Export failed for ${reportKey}`);
    }
  };

  return (
    <RbacGate
      allowedRoles={['AUDITOR', 'ADMIN', 'OWNER']}
      portalName="Statutory Auditor Compliance Hub"
      requiredPermission="AUDIT_READ"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
              {['THIS_MONTH', 'LAST_MONTH', 'FY_2026_27'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleSelectPreset(d)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dateRange === d ? 'bg-white shadow-xs text-stone-900' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {d === 'THIS_MONTH' ? 'This Month' : d === 'LAST_MONTH' ? 'Last Month' : 'FY 26-27'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
              <input
                type="date"
                aria-label="From date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setDateRange('CUSTOM');
                }}
                className="px-2 py-1 rounded-lg bg-white border border-stone-200 text-xs font-mono text-stone-700"
              />
              <span className="text-stone-400 font-bold px-0.5">→</span>
              <input
                type="date"
                aria-label="To date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setDateRange('CUSTOM');
                }}
                className="px-2 py-1 rounded-lg bg-white border border-stone-200 text-xs font-mono text-stone-700"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                onClick={handleExportTallyXml}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Tally XML
              </button>
            </div>
          </div>
        </div>

        {exportError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
            {exportError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
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

          <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  {reportList.find((r) => r.id === selectedReport)?.name}
                  <button
                    onClick={() => loadAuditData(dateRange)}
                    title="Refresh Audit Data"
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {(() => {
                    const { startDate, endDate } = getDateQueryParams(dateRange);
                    if (selectedReport === 'ageing-report') {
                      return 'Live Receivables Snapshot (As of Now) • Company: Murukku Delights Private Limited (GSTIN: 33AAAAA0000A1Z5)';
                    }
                    return `Period: ${startDate} to ${endDate} • Company: Murukku Delights Private Limited (GSTIN: 33AAAAA0000A1Z5)`;
                  })()}
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
                Verified Read-Only
              </span>
            </div>

            {selectedReport === 'stock-summary' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold gap-1">
                    {[
                      { id: 'ALL', label: 'All Stock' },
                      { id: 'RAW', label: 'Raw Materials' },
                      { id: 'PACKAGING', label: 'Packaging' },
                      { id: 'FINISHED', label: 'Finished Goods' },
                    ].map((k) => (
                      <button
                        key={k.id}
                        onClick={() => setStockKindFilter(k.id as any)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          stockKindFilter === k.id ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-500'
                        }`}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold gap-1">
                    <button
                      onClick={() => setStockSummaryView('BATCH')}
                      className={`px-2.5 py-1 rounded-lg ${
                        stockSummaryView === 'BATCH' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-500'
                      }`}
                    >
                      Batch FEFO View
                    </button>
                    <button
                      onClick={() => setStockSummaryView('MOVEMENT')}
                      className={`px-2.5 py-1 rounded-lg ${
                        stockSummaryView === 'MOVEMENT' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-500'
                      }`}
                    >
                      Opening / In / Out / Closing
                    </button>
                  </div>
                </div>

                {stockSummaryView === 'MOVEMENT' ? (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                        <tr>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Item</th>
                          <th className="p-3">Category</th>
                          <th className="p-3 text-right">Opening</th>
                          <th className="p-3 text-right">Receipts (In)</th>
                          <th className="p-3 text-right">Issues (Out)</th>
                          <th className="p-3 text-right">Closing</th>
                          <th className="p-3 text-right">Closing Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {stockPeriodSummary
                          .filter((r) => stockKindFilter === 'ALL' || r.kind === stockKindFilter)
                          .map((r) => (
                            <tr key={r.id}>
                              <td className="p-3 font-mono font-bold">{r.code}</td>
                              <td className="p-3 font-medium">{r.name}</td>
                              <td className="p-3 text-[10px] font-bold text-stone-500">{r.kind}</td>
                              <td className="p-3 text-right font-mono">{Number(r.openingQty ?? 0).toFixed(2)} {r.uom}</td>
                              <td className="p-3 text-right font-mono text-emerald-700">+{Number(r.receiptsQty ?? 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono text-rose-600">-{Number(r.issuesQty ?? 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono font-bold">{Number(r.currentQty ?? 0).toFixed(2)} {r.uom}</td>
                              <td className="p-3 text-right font-bold">₹{Number(r.currentValue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                        <tr>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Item / Batch</th>
                          <th className="p-3 text-right">Closing Qty</th>
                          <th className="p-3 text-right">Valuation (WAC)</th>
                          <th className="p-3 text-right">Closing Value</th>
                          <th className="p-3 text-center">Audit Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {stockBalances.filter((row) => stockKindFilter === 'ALL' || (row.kind || row.item?.kind) === stockKindFilter).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-stone-400">
                              No stock balance rows found.
                            </td>
                          </tr>
                        ) : (
                          stockBalances
                            .filter((row) => stockKindFilter === 'ALL' || (row.kind || row.item?.kind) === stockKindFilter)
                            .map((row, idx) => {
                              const sku = row.sku || row.item?.sku || '-';
                              const name = row.name || row.item?.name || 'Item';
                              const batchNo = row.batch?.batchNo;
                              const kind = row.kind || row.item?.kind;
                              const uom = row.uom || row.item?.baseUom || 'UOM';
                              const qty = Number(row.qty ?? 0);
                              const wac = Number(row.wac ?? 0);
                              const val = Number(row.value ?? 0);
                              const uniqueKey = row.id || `${row.itemId || sku}-${row.batchId || 'nobatch'}-${idx}`;
                              return (
                                <tr key={uniqueKey} className={kind === 'FINISHED' ? 'bg-amber-50/40' : ''}>
                                  <td className="p-3 font-mono font-bold">{sku}</td>
                                  <td className="p-3 font-medium">
                                    {name}
                                    {batchNo && (
                                      <span className="ml-1.5 text-[10px] font-mono text-stone-400">({batchNo})</span>
                                    )}
                                  </td>
                                  <td className={`p-3 text-right font-black ${qty <= 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                    {qty.toFixed(2)} {uom}
                                  </td>
                                  <td className="p-3 text-right">₹{wac.toFixed(3)}</td>
                                  <td className="p-3 text-right font-bold text-stone-900">
                                    ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        qty <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {qty <= 0 ? 'Zero / Stockout' : kind === 'FINISHED' ? 'FEFO Matched' : 'Exact'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'stock-ledger' && (
              <div className="space-y-3">
                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold gap-1 w-fit">
                  {[
                    { id: 'ALL', label: 'All Categories' },
                    { id: 'RAW', label: 'Raw Materials' },
                    { id: 'PACKAGING', label: 'Packaging' },
                    { id: 'FINISHED', label: 'Finished Goods' },
                  ].map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setStockKindFilter(k.id as any)}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        stockKindFilter === k.id ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-500'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">Txn Date</th>
                        <th className="p-3">Item / SKU</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Total Value</th>
                        <th className="p-3 text-center">Source Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono">
                      {stockLedger.filter((r) => stockKindFilter === 'ALL' || (r.item?.kind || r.kind) === stockKindFilter).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center font-sans text-stone-400">
                            No stock ledger entries recorded in this period/category.
                          </td>
                        </tr>
                      ) : (
                        stockLedger
                          .filter((r) => stockKindFilter === 'ALL' || (r.item?.kind || r.kind) === stockKindFilter)
                          .map((row) => {
                            const sku = row.sku || row.item?.sku || row.itemCode || '-';
                            const itemName = row.item?.name || row.itemName || `${sku} (${row.movementType})`;
                            const qtyIn = Number(row.qtyIn ?? 0);
                            const qtyOut = Number(row.qtyOut ?? 0);
                            const signedQty = row.qty !== undefined ? Number(row.qty) : qtyIn > 0 ? qtyIn : -qtyOut;
                            const rate = Number(row.unitCost ?? row.rate ?? 0);
                            const rawVal = Number(row.value ?? row.totalValue ?? 0);
                            const signedVal = signedQty < 0 && rawVal > 0 ? -rawVal : rawVal;
                            return (
                              <tr key={row.id}>
                                <td className="p-3 text-stone-500 font-sans text-[11px]">
                                  {row.txnAt
                                    ? new Date(row.txnAt).toLocaleString('en-IN', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '-'}
                                </td>
                                <td className="p-3 font-bold text-stone-900 font-sans">
                                  {itemName} <span className="text-[10px] font-mono text-stone-400">({sku})</span>
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      signedQty < 0
                                        ? 'bg-rose-100 text-rose-800'
                                        : row.movementType === 'PRODUCE' || row.movementType === 'PROD_IN'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {row.movementType}
                                  </span>
                                </td>
                                <td className={`p-3 text-right font-bold ${signedQty < 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                  {signedQty > 0 ? `+${signedQty.toFixed(2)}` : signedQty.toFixed(2)}
                                </td>
                                <td className="p-3 text-right">₹{rate.toFixed(2)}</td>
                                <td className={`p-3 text-right font-bold ${signedVal < 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                  {signedVal < 0
                                    ? `-₹${Math.abs(signedVal).toFixed(2)}`
                                    : `₹${signedVal.toFixed(2)}`}
                                </td>
                                <td className="p-3 text-center text-[10px] text-stone-400 font-mono">
                                  {row.sourceType || row.auditHash || '#verified'}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedReport === 'sales-register' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold gap-1">
                    <button
                      onClick={() => setSalesSubTab('REGISTER')}
                      className={`px-3 py-1 rounded-lg ${salesSubTab === 'REGISTER' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-500'}`}
                    >
                      Invoice Register
                    </button>
                    <button
                      onClick={() => setSalesSubTab('CUSTOMER')}
                      className={`px-3 py-1 rounded-lg ${salesSubTab === 'CUSTOMER' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-500'}`}
                    >
                      Customer-wise Sales ({salesByCustomer.length})
                    </button>
                    <button
                      onClick={() => setSalesSubTab('PRODUCT')}
                      className={`px-3 py-1 rounded-lg ${salesSubTab === 'PRODUCT' ? 'bg-white shadow-xs text-stone-900 font-bold' : 'text-stone-500'}`}
                    >
                      Product-wise Sales ({salesByProduct.length})
                    </button>
                  </div>
                  {salesRegisterSummary && (
                    <div className="text-xs font-semibold text-stone-600">
                      Invoices: <span className="font-bold text-stone-900">{salesRegisterSummary.totalInvoices}</span> •
                      Taxable: <span className="font-bold text-stone-900">₹{salesRegisterSummary.totalTaxable}</span> •
                      Total: <span className="font-bold text-emerald-700">₹{salesRegisterSummary.totalGrand}</span>
                    </div>
                  )}
                </div>

                {salesSubTab === 'REGISTER' && (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                        <tr>
                          <th className="p-3">Invoice No</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">GSTIN</th>
                          <th className="p-3 text-right">Taxable</th>
                          <th className="p-3 text-right">CGST</th>
                          <th className="p-3 text-right">SGST</th>
                          <th className="p-3 text-right">IGST</th>
                          <th className="p-3 text-right">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {salesRegister.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-6 text-center text-stone-400">
                              No posted invoices in this period.
                            </td>
                          </tr>
                        ) : (
                          salesRegister.map((row) => (
                            <tr key={row.id || row.invoiceNumber}>
                              <td className="p-3 font-mono font-bold text-stone-900">{row.invoiceNumber}</td>
                              <td className="p-3 text-stone-500">{row.invoiceDate}</td>
                              <td className="p-3 font-semibold">{row.customerName}</td>
                              <td className="p-3 font-mono text-[11px] text-stone-500">{row.customerGstin}</td>
                              <td className="p-3 text-right font-mono">₹{Number(row.taxableTotal || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono">₹{Number(row.cgstTotal || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono">₹{Number(row.sgstTotal || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono">₹{Number(row.igstTotal || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono font-bold text-stone-900">
                                ₹{Number(row.grandTotal || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {salesSubTab === 'CUSTOMER' && (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                        <tr>
                          <th className="p-3">Customer</th>
                          <th className="p-3">GSTIN</th>
                          <th className="p-3 text-right">Invoices</th>
                          <th className="p-3 text-right">Taxable Value</th>
                          <th className="p-3 text-right">Grand Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {salesByCustomer.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-stone-400">
                              No customer sales in this period.
                            </td>
                          </tr>
                        ) : (
                          salesByCustomer.map((c) => (
                            <tr key={c.customerName}>
                              <td className="p-3 font-semibold text-stone-900">{c.customerName}</td>
                              <td className="p-3 font-mono text-[11px] text-stone-500">{c.gstin}</td>
                              <td className="p-3 text-right font-mono">{c.invoiceCount}</td>
                              <td className="p-3 text-right font-mono">₹{Number(c.taxableTotal || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono font-bold text-stone-900">₹{Number(c.grandTotal || 0).toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {salesSubTab === 'PRODUCT' && (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                        <tr>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Product</th>
                          <th className="p-3 text-right">Sold Qty</th>
                          <th className="p-3 text-right">Taxable Value</th>
                          <th className="p-3 text-right">GST</th>
                          <th className="p-3 text-right">Total Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {salesByProduct.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-stone-400">
                              No product sales in this period.
                            </td>
                          </tr>
                        ) : (
                          salesByProduct.map((p) => (
                            <tr key={p.itemCode}>
                              <td className="p-3 font-mono font-bold text-stone-900">{p.itemCode}</td>
                              <td className="p-3 font-semibold text-stone-900">{p.itemName}</td>
                              <td className="p-3 text-right font-mono font-bold">{p.totalQty} {p.uom}</td>
                              <td className="p-3 text-right font-mono">₹{Number(p.totalTaxable || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono">₹{Number(p.totalTax || 0).toFixed(2)}</td>
                              <td className="p-3 text-right font-mono font-bold text-stone-900">₹{Number(p.totalGrand || 0).toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {selectedReport === 'purchase-register' && (
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                    <tr>
                      <th className="p-3">Purchase #</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">GSTIN</th>
                      <th className="p-3">Items</th>
                      <th className="p-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {purchaseRegister.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-stone-400">
                          No purchase receipts recorded yet.
                        </td>
                      </tr>
                    ) : (
                      purchaseRegister.map((p) => (
                        <tr key={p.id || p.purchaseNumber}>
                          <td className="p-3 font-mono font-bold text-stone-900">{p.purchaseNumber}</td>
                          <td className="p-3 text-stone-500">{p.purchaseDate}</td>
                          <td className="p-3 font-semibold text-stone-800">{p.supplierName}</td>
                          <td className="p-3 font-mono text-[11px] text-stone-500">{p.supplierGstin}</td>
                          <td className="p-3">{p.items}</td>
                          <td className="p-3 text-right font-mono font-bold text-stone-900">
                            ₹{Number(p.grandTotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReport === 'production-report' && (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">Run #</th>
                        <th className="p-3">Batch #</th>
                        <th className="p-3 text-right">Planned</th>
                        <th className="p-3 text-right">Actual</th>
                        <th className="p-3 text-right">Yield Variance</th>
                        <th className="p-3">Wastage</th>
                        <th className="p-3 text-right">Unit Cost</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {productionReport.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-stone-400">
                            No production runs recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        productionReport.map((r) => (
                          <tr key={r.id || r.runNumber}>
                            <td className="p-3 font-mono font-bold text-stone-900">{r.runNumber}</td>
                            <td className="p-3 font-mono">{r.batchNumber}</td>
                            <td className="p-3 text-right font-mono">{r.plannedYield} PKT</td>
                            <td className="p-3 text-right font-mono font-bold">{r.actualYield} PKT</td>
                            <td
                              className={`p-3 text-right font-mono font-bold ${
                                r.isYieldFlagged ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              {Number(r.yieldVariancePct).toFixed(2)}%
                            </td>
                            <td className="p-3 text-[11px] text-rose-700 font-medium">{r.wastageSummary || 'None'}</td>
                            <td className="p-3 text-right font-mono">₹{Number(r.unitCost || 0).toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {productionReport.map((r) => (
                  <div key={`${r.id || r.runNumber}-inputs`} className="border border-stone-200 rounded-xl p-4 space-y-2 bg-stone-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-stone-900">
                        {r.runNumber} ({r.batchNumber}) — Planned vs Actual Input Consumption
                      </span>
                      <span className="text-stone-500">
                        Material ₹{r.totalMaterialCost} • Overhead ₹{r.totalOverheadCost} • Wastage: {r.wastageSummary || 'None'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(r.inputConsumptions || []).map((ic: any, idx: number) => (
                        <div key={idx} className={`p-2.5 rounded-lg border text-xs bg-white ${ic.isFlagged ? 'border-amber-300' : 'border-stone-200'}`}>
                          <div className="font-semibold text-stone-900">{ic.item}</div>
                          <div className="font-mono text-[11px] text-stone-600 mt-0.5">
                            Planned: {ic.planned} {ic.uom || ''} • Actual: <span className="font-bold text-stone-900">{ic.actual}</span>{' '}
                            <span className={ic.isFlagged ? 'text-amber-700 font-bold' : 'text-emerald-700'}>
                              ({ic.variancePct > 0 ? '+' : ''}{ic.variancePct}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedReport === 'costing-comparison' && (
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                    <tr>
                      <th className="p-3">Run #</th>
                      <th className="p-3">Batch #</th>
                      <th className="p-3 text-right">WAC Unit Cost</th>
                      <th className="p-3 text-right">FIFO Sensitivity</th>
                      <th className="p-3 text-right">Margin / Unit</th>
                      <th className="p-3 text-right">Gross Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {costingComparison.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-stone-400">
                          No completed costing runs yet.
                        </td>
                      </tr>
                    ) : (
                      costingComparison.map((c) => (
                        <tr key={c.runNumber}>
                          <td className="p-3 font-mono font-bold text-stone-900">{c.runNumber}</td>
                          <td className="p-3 font-mono">{c.batchNumber}</td>
                          <td className="p-3 text-right font-mono font-bold">₹{c.wacUnitCost}</td>
                          <td className="p-3 text-right font-mono text-stone-600">₹{c.fifoUnitCost}</td>
                          <td className="p-3 text-right font-mono text-emerald-700">₹{c.grossMarginPerUnit}</td>
                          <td className="p-3 text-right font-mono font-bold">{c.grossMarginPct}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {selectedReport === 'collections-report' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Total Collected in Period</div>
                    <div className="text-xl font-bold text-emerald-900 mt-1">
                      ₹{Number(collectionsReport?.totalCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-500 uppercase">Payment Receipts</div>
                    <div className="text-xl font-bold text-stone-900 mt-1">
                      {collectionsReport?.totalCollections ?? (collectionsReport?.rows?.length || 0)}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">Payment #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Mode</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Allocated Invoices</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(collectionsReport?.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-stone-400">
                            No payments collected in this period.
                          </td>
                        </tr>
                      ) : (
                        (collectionsReport?.rows || []).map((c: any) => (
                          <tr key={c.paymentNumber || c.id}>
                            <td className="p-3 font-mono font-bold text-stone-900">{c.paymentNumber}</td>
                            <td className="p-3 text-stone-500">{c.paymentDate}</td>
                            <td className="p-3 font-semibold text-stone-800">{c.customerName}</td>
                            <td className="p-3 font-semibold text-stone-600">{c.paymentMode || c.mode}</td>
                            <td className="p-3 font-mono text-stone-500">{c.referenceNo || c.reference || '-'}</td>
                            <td className="p-3 text-[11px] text-stone-600">{c.allocatedInvoices || '-'}</td>
                            <td className="p-3 text-right font-bold text-emerald-700">₹{c.amount}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedReport === 'ageing-report' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-400 uppercase">0–30 Days</div>
                    <div className="text-sm font-bold text-stone-900 mt-0.5">
                      ₹{ageingReport.reduce((s, a) => s + Number(a.bucket0To30 || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-400 uppercase">31–60 Days</div>
                    <div className="text-sm font-bold text-stone-900 mt-0.5">
                      ₹{ageingReport.reduce((s, a) => s + Number(a.bucket31To60 || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-400 uppercase">61–90 Days</div>
                    <div className="text-sm font-bold text-stone-900 mt-0.5">
                      ₹{ageingReport.reduce((s, a) => s + Number(a.bucket61To90 || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-400 uppercase">90+ Days</div>
                    <div className="text-sm font-bold text-rose-700 mt-0.5">
                      ₹{ageingReport.reduce((s, a) => s + Number(a.bucket90Plus || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-700 uppercase">Total Receivables</div>
                    <div className="text-sm font-bold text-rose-900 mt-0.5">
                      ₹{ageingReport.reduce((s, a) => s + Number(a.totalOutstanding || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">Customer / Debtor</th>
                        <th className="p-3 text-right">0-30 Days</th>
                        <th className="p-3 text-right">31-60 Days</th>
                        <th className="p-3 text-right">61-90 Days</th>
                        <th className="p-3 text-right">90+ Days</th>
                        <th className="p-3 text-right">Total Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {ageingReport.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-stone-400">
                            No customer receivables data available.
                          </td>
                        </tr>
                      ) : (
                        ageingReport.map((a) => (
                          <tr key={a.customerId || a.customerName}>
                            <td className="p-3 font-semibold text-stone-900">{a.customerName}</td>
                            <td className="p-3 text-right font-mono">₹{a.bucket0To30}</td>
                            <td className="p-3 text-right font-mono">₹{a.bucket31To60}</td>
                            <td className="p-3 text-right font-mono">₹{a.bucket61To90}</td>
                            <td className="p-3 text-right font-mono">₹{a.bucket90Plus}</td>
                            <td className="p-3 text-right font-mono font-bold text-stone-900">
                              ₹{a.totalOutstanding}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedReport === 'gst-summary' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-400 uppercase">Taxable Outward Supplies</div>
                    <div className="text-xl font-bold text-stone-900 mt-1">
                      ₹{Number(gstSummary?.gstr3b?.taxableValue || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">GSTR-3B Table 3.1(a)</div>
                  </div>
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-400 uppercase">CGST + SGST + IGST</div>
                    <div className="text-xl font-bold text-stone-900 mt-1">
                      ₹
                      {(
                        Number(gstSummary?.gstr3b?.centralTax || 0) +
                        Number(gstSummary?.gstr3b?.stateTax || 0) +
                        Number(gstSummary?.gstr3b?.integratedTax || 0)
                      ).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      CGST ₹{gstSummary?.gstr3b?.centralTax || '0.00'} • SGST ₹{gstSummary?.gstr3b?.stateTax || '0.00'} • IGST ₹{gstSummary?.gstr3b?.integratedTax || '0.00'}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                    <div className="text-[10px] font-bold text-stone-400 uppercase">HSN Line Groups</div>
                    <div className="text-xl font-bold text-amber-800 mt-1">
                      {gstSummary?.gstr1?.hsnSummary?.length ?? 0}
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      B2B: {gstSummary?.gstr1?.b2b?.length ?? 0} • B2CS: {gstSummary?.gstr1?.b2cs?.length ?? 0}
                    </div>
                  </div>
                </div>

                {/* GSTR-3B Summary Table */}
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-700">
                    GSTR-3B Table 3.1(a) — Outward Taxable Supplies
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50/70 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">Nature of Supplies</th>
                        <th className="p-3 text-right">Taxable Value</th>
                        <th className="p-3 text-right">IGST</th>
                        <th className="p-3 text-right">CGST</th>
                        <th className="p-3 text-right">SGST / UTGST</th>
                        <th className="p-3 text-right">Cess</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-3 text-stone-800">{gstSummary?.gstr3b?.table || '3.1(a) Outward taxable supplies'}</td>
                        <td className="p-3 text-right font-mono font-bold">₹{gstSummary?.gstr3b?.taxableValue || '0.00'}</td>
                        <td className="p-3 text-right font-mono">₹{gstSummary?.gstr3b?.integratedTax || '0.00'}</td>
                        <td className="p-3 text-right font-mono">₹{gstSummary?.gstr3b?.centralTax || '0.00'}</td>
                        <td className="p-3 text-right font-mono">₹{gstSummary?.gstr3b?.stateTax || '0.00'}</td>
                        <td className="p-3 text-right font-mono">₹{gstSummary?.gstr3b?.cess || '0.00'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* GSTR-1 Table 12 HSN Summary */}
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-700">
                    GSTR-1 Table 12 — HSN-wise Summary of Outward Supplies
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50/70 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">HSN</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">UQC</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Taxable</th>
                        <th className="p-3 text-right">CGST</th>
                        <th className="p-3 text-right">SGST</th>
                        <th className="p-3 text-right">IGST</th>
                        <th className="p-3 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(gstSummary?.gstr1?.hsnSummary || []).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-5 text-center text-stone-400">
                            No outward supplies in this period.
                          </td>
                        </tr>
                      ) : (
                        (gstSummary?.gstr1?.hsnSummary || []).map((h: any) => (
                          <tr key={h.hsnCode}>
                            <td className="p-3 font-mono font-bold text-stone-900">{h.hsnCode}</td>
                            <td className="p-3 font-medium">{h.description}</td>
                            <td className="p-3 font-mono text-stone-500">{h.uqc}</td>
                            <td className="p-3 text-right font-mono">{h.totalQty}</td>
                            <td className="p-3 text-right font-mono">₹{h.taxableValue}</td>
                            <td className="p-3 text-right font-mono">₹{h.cgstAmount}</td>
                            <td className="p-3 text-right font-mono">₹{h.sgstAmount}</td>
                            <td className="p-3 text-right font-mono">₹{h.igstAmount}</td>
                            <td className="p-3 text-right font-mono font-bold">₹{h.totalTax}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* GSTR-1 Table 4 (B2B) & Table 7 (B2CS) */}
                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-bold text-stone-700">
                    GSTR-1 B2B ({gstSummary?.gstr1?.b2b?.length ?? 0}) &amp; B2CS ({gstSummary?.gstr1?.b2cs?.length ?? 0}) Invoices
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50/70 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">Bucket</th>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">GSTIN</th>
                        <th className="p-3">POS</th>
                        <th className="p-3 text-right">Taxable</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {[
                        ...(gstSummary?.gstr1?.b2b || []).map((r: any) => ({ ...r, bucket: 'B2B' })),
                        ...(gstSummary?.gstr1?.b2cs || []).map((r: any) => ({ ...r, bucket: 'B2CS' })),
                      ].length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-5 text-center text-stone-400">
                            No B2B or B2CS invoices in this period.
                          </td>
                        </tr>
                      ) : (
                        [
                          ...(gstSummary?.gstr1?.b2b || []).map((r: any) => ({ ...r, bucket: 'B2B' })),
                          ...(gstSummary?.gstr1?.b2cs || []).map((r: any) => ({ ...r, bucket: 'B2CS' })),
                        ].map((inv: any) => (
                          <tr key={inv.id || inv.invoiceNumber}>
                            <td className="p-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inv.bucket === 'B2B' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                {inv.bucket}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-bold text-stone-900">{inv.invoiceNumber}</td>
                            <td className="p-3 font-semibold">{inv.customerName}</td>
                            <td className="p-3 font-mono text-[11px] text-stone-500">{inv.customerGstin}</td>
                            <td className="p-3 font-mono">{inv.customerState}</td>
                            <td className="p-3 text-right font-mono">₹{inv.taxableTotal}</td>
                            <td className="p-3 text-right font-mono font-bold">₹{inv.grandTotal}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </RbacGate>
  );
}
