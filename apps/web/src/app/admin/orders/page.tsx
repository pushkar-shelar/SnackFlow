'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Inbox,
  CheckCircle,
  XCircle,
  PauseCircle,
  FileText,
  Truck,
  Share2,
  QrCode,
  MessageSquare,
  Search,
  Store,
  MapPin,
  Phone,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';

export default function AdminOrdersPage() {
  const [activeAdminTab, setActiveAdminTab] = useState<'ORDERS' | 'STORES'>('ORDERS');
  const [storeApplications, setStoreApplications] = useState<any[]>([]);
  const [approvalForms, setApprovalForms] = useState<Record<string, { creditLimit: number; creditDays: number }>>({});
  const [approvingAppId, setApprovingAppId] = useState<string | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [_invoicePreview, setInvoicePreview] = useState<any | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiFetch('/orders');
      setOrders(data);
      if (data.length > 0 && !selectedOrderId) {
        setSelectedOrderId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to load orders', e);
    }
  }, [selectedOrderId]);

  const loadOrderDetails = useCallback(async (id: string) => {
    try {
      const data = await apiFetch(`/orders/${id}`);
      setSelectedOrder(data);
    } catch (e) {
      console.error('Failed to load order details', e);
    }
  }, []);

  const loadStoreApplications = useCallback(async () => {
    try {
      const data = await apiFetch<any[]>('/parties/applications');
      setStoreApplications(data);
      setApprovalForms((prev) => {
        const initial = { ...prev };
        for (const app of data) {
          if (!initial[app.id]) {
            initial[app.id] = { creditLimit: 15000, creditDays: 30 };
          }
        }
        return initial;
      });
    } catch (e) {
      console.warn('Failed to load store applications', e);
    }
  }, []);

  const handleApproveStore = async (appId: string) => {
    setApprovingAppId(appId);
    try {
      const form = approvalForms[appId] || { creditLimit: 15000, creditDays: 30 };
      await apiFetch(`/parties/applications/${appId}/approve`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      alert('Store approved and added to active customer master!');
      loadStoreApplications();
    } catch (e: any) {
      alert(e.message || 'Failed to approve store application');
    } finally {
      setApprovingAppId(null);
    }
  };

  useEffect(() => {
    loadOrders();
    loadStoreApplications();
  }, [loadOrders, loadStoreApplications]);

  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetails(selectedOrderId);
    }
  }, [selectedOrderId, loadOrderDetails]);

  // Keyboard shortcuts: A -> approve, R -> reject, H -> hold
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (!selectedOrder || selectedOrder.status !== 'SUBMITTED') return;

      if (e.key === 'a' || e.key === 'A') {
        handleApproveOrder('APPROVE_FULL');
      } else if (e.key === 'r' || e.key === 'R') {
        handleRejectOrder();
      } else if (e.key === 'h' || e.key === 'H') {
        handleHoldOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder]);

  const handleApproveOrder = async (action: 'APPROVE_FULL' | 'APPROVE_AVAILABLE_BACKORDER') => {
    if (!selectedOrderId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/orders/${selectedOrderId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await loadOrders();
      await loadOrderDetails(selectedOrderId);
    } catch (e: any) {
      alert(`Approval error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!selectedOrderId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/orders/${selectedOrderId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'REJECT' }),
      });
      await loadOrders();
      await loadOrderDetails(selectedOrderId);
    } catch (e: any) {
      alert(`Reject error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleHoldOrder = async () => {
    if (!selectedOrderId) return;
    setActionLoading(true);
    try {
      await apiFetch(`/orders/${selectedOrderId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'HOLD' }),
      });
      await loadOrders();
      await loadOrderDetails(selectedOrderId);
    } catch (e: any) {
      alert(`Hold error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostInvoice = async () => {
    if (!selectedOrderId) return;
    setActionLoading(true);
    try {
      const inv = await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify({ orderId: selectedOrderId }),
      });
      setInvoicePreview(inv);
      await loadOrders();
      await loadOrderDetails(selectedOrderId);
    } catch (e: any) {
      alert(`Invoice error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatch = async (invoiceId: string) => {
    setActionLoading(true);
    try {
      await apiFetch('/dispatches', {
        method: 'POST',
        body: JSON.stringify({ invoiceId }),
      });
      alert('Dispatch confirmed! FEFO batches consumed and recorded in stock ledger.');
      await loadOrders();
      await loadOrderDetails(selectedOrderId!);
    } catch (e: any) {
      alert(`Dispatch error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    const matchesStatus = statusFilter === 'ALL' || ord.status === statusFilter;
    const matchesSearch =
      ord.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.party?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingStoreCount = storeApplications.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner with Quick Actions and Keyboard Hint */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-stone-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-amber-600" />
            Admin Order Management & Store Onboarding
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Review salesmen store registrations, approve credit limits, allocate stock, and dispatch FEFO snack batches
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Navigation Tabs Pill */}
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
            <button
              onClick={() => setActiveAdminTab('ORDERS')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeAdminTab === 'ORDERS' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-600'
              }`}
            >
              Orders Inbox
            </button>
            <button
              onClick={() => setActiveAdminTab('STORES')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeAdminTab === 'STORES' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-600'
              }`}
            >
              <span>Store Approvals</span>
              {pendingStoreCount > 0 && (
                <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {pendingStoreCount}
                </span>
              )}
            </button>
          </div>

          {/* Keyboard hints pill */}
          {activeAdminTab === 'ORDERS' && (
            <div className="hidden sm:flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-600">
              <span className="font-semibold text-stone-800">Shortcuts:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 font-mono text-[11px] shadow-xs">A</kbd> Approve
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 font-mono text-[11px] shadow-xs">R</kbd> Reject
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 font-mono text-[11px] shadow-xs">H</kbd> Hold
            </div>
          )}
        </div>
      </div>

      {activeAdminTab === 'STORES' ? (
        /* Store Applications Approvals View */
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-bold text-stone-900">
                Salesmen Store Onboarding Queue ({storeApplications.length})
              </h2>
            </div>
            <button
              onClick={loadStoreApplications}
              className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition-all"
            >
              Refresh Queue
            </button>
          </div>

          {storeApplications.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs">
              No store applications submitted yet by field sales representatives.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeApplications.map((app) => {
                const isPending = app.status === 'PENDING';
                const form = approvalForms[app.id] || { creditLimit: 15000, creditDays: 30 };
                const isApproving = approvingAppId === app.id;

                return (
                  <div
                    key={app.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs transition-all space-y-3.5 ${
                      isPending ? 'border-amber-300/80 ring-1 ring-amber-400/20' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-stone-900">{app.storeName}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              app.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : app.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {app.status === 'APPROVED' ? '✓ Approved & Active' : app.status === 'REJECTED' ? '✕ Rejected' : '⏳ Pending Approval'}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-stone-400" />
                          <span>Submitted by: <strong>{app.salesman?.name || 'Salesman'}</strong></span>
                          <span>• {new Date(app.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Contact Person:</span>
                        <span className="font-semibold text-stone-900">{app.contactPerson}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Phone Number:</span>
                        <a href={`tel:${app.phone}`} className="font-semibold text-amber-700 hover:underline flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {app.phone}
                        </a>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Street Address:</span>
                        <span className="font-medium text-stone-700 text-right max-w-[220px] truncate">{app.address}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">GSTIN:</span>
                        <span className="font-mono text-stone-700">{app.gstin || 'Unregistered Composite'}</span>
                      </div>
                      {app.geoLat && app.geoLng && (
                        <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                          <span className="text-stone-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            GPS Tagged:
                          </span>
                          <a
                            href={`https://maps.google.com/?q=${app.geoLat},${app.geoLng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 font-semibold hover:underline text-[11px]"
                          >
                            View on Google Maps ↗
                          </a>
                        </div>
                      )}
                    </div>

                    {isPending ? (
                      <div className="pt-2 border-t border-stone-100 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                              Credit Limit (₹)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={form.creditLimit}
                              onChange={(e) =>
                                setApprovalForms({
                                  ...approvalForms,
                                  [app.id]: { ...form, creditLimit: Number(e.target.value) },
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold focus:outline-amber-600"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                              Credit Days
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={90}
                              value={form.creditDays}
                              onChange={(e) =>
                                setApprovalForms({
                                  ...approvalForms,
                                  [app.id]: { ...form, creditDays: Number(e.target.value) },
                                })
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold focus:outline-amber-600"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleApproveStore(app.id)}
                          disabled={isApproving}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          {isApproving ? 'Approving Store...' : 'Approve & Onboard Store'}
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-[11px] font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Store is onboarded and active in salesman's assigned portfolio.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      /* Split View Container */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Orders Inbox List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search & Status Filter */}
          <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order number, customer..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
              {['ALL', 'SUBMITTED', 'APPROVED', 'INVOICED', 'DISPATCHED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                    statusFilter === st
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* List of Orders */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs">
                No orders match your filter.
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = selectedOrderId === ord.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-600 bg-amber-50/40 shadow-xs ring-2 ring-amber-500/10'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-stone-900">{ord.number}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ord.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'INVOICED'
                            ? 'bg-blue-100 text-blue-800'
                            : ord.status === 'DISPATCHED'
                            ? 'bg-purple-100 text-purple-800'
                            : ord.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-stone-800">{ord.party?.name}</div>

                    <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-stone-100">
                      <span className="text-[10px] text-stone-400">
                        {ord.lines?.length || 1} line item(s) • Sales: {ord.salesman?.name}
                      </span>
                      <span className="font-extrabold text-stone-900">
                        ₹{Number(ord.grandTotal).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Order Inspection & Action Panel (7 cols) */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-5">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-stone-900">{selectedOrder.number}</span>
                    <span className="text-xs bg-stone-100 text-stone-600 font-mono px-2 py-0.5 rounded-md">
                      Client UUID: {selectedOrder.clientUuid.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    Customer: <span className="font-bold text-stone-800">{selectedOrder.party?.name}</span> • State Code: {selectedOrder.party?.stateCode}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Grand Total</div>
                  <div className="text-2xl font-black text-stone-900">
                    ₹{Number(selectedOrder.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Line Items Table with Coverage Chips */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2.5">
                  Ordered Line Items & Stock Coverage
                </h3>

                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[10px] border-b border-stone-200">
                      <tr>
                        <th className="p-3">Product / SKU</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Taxable</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 text-center">Stock Coverage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {selectedOrder.lines?.map((line: any) => (
                        <tr key={line.id} className="hover:bg-stone-50/60">
                          <td className="p-3">
                            <div className="font-bold text-stone-900">{line.item?.name}</div>
                            <div className="text-[10px] text-stone-400 font-mono">{line.item?.sku}</div>
                          </td>
                          <td className="p-3 text-right font-bold text-stone-900">
                            {Number(line.qty)} {line.uom}
                          </td>
                          <td className="p-3 text-right text-stone-600">
                            ₹{Number(line.rate).toFixed(2)}
                          </td>
                          <td className="p-3 text-right text-stone-600">
                            ₹{Number(line.taxable).toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-bold text-stone-900">
                            ₹{Number(line.total).toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            {/* Line coverage chip */}
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              Covered
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax Summary Breakdown */}
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500 font-medium">Place of Supply: </span>
                  <span className="font-bold text-stone-800">{selectedOrder.party?.stateCode === '33' ? 'Intra-State (Tamil Nadu 33)' : 'Inter-State'}</span>
                </div>
                <div className="flex items-center gap-4 text-stone-700">
                  <span>Taxable: <b>₹{Number(selectedOrder.taxableTotal).toFixed(2)}</b></span>
                  <span>GST: <b>₹{Number(selectedOrder.taxTotal).toFixed(2)}</b></span>
                </div>
              </div>

              {/* Workflow Actions depending on Order Status */}
              <div className="pt-2 border-t border-stone-100">
                {selectedOrder.status === 'SUBMITTED' && (
                  <div className="flex items-center gap-2.5 justify-end">
                    <button
                      onClick={handleRejectOrder}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Reject (R)
                    </button>
                    <button
                      onClick={handleHoldOrder}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      <PauseCircle className="w-4 h-4 text-amber-600" />
                      Hold (H)
                    </button>
                    <button
                      onClick={() => handleApproveOrder('APPROVE_FULL')}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve Full (A)
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'APPROVED' && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Order Approved. Ready for Invoicing.
                    </span>
                    <button
                      onClick={handlePostInvoice}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/25 active:scale-95 transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      Post Invoice (INV/2627/...)
                    </button>
                  </div>
                )}

                {(selectedOrder.status === 'INVOICED' || selectedOrder.invoices?.length > 0) && (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-blue-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Generated Invoice: {selectedOrder.invoices?.[0]?.number || 'Posted'}
                        </span>
                        <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded">
                          POSTED
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-blue-800 text-xs">
                        <span>Invoice Total: <b>₹{Number(selectedOrder.invoices?.[0]?.total || selectedOrder.grandTotal).toLocaleString('en-IN')}</b></span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShareModalOpen(true)}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share (WhatsApp/QR)
                          </button>

                          {selectedOrder.status !== 'DISPATCHED' && (
                            <button
                              onClick={() => handleDispatch(selectedOrder.invoices[0].id)}
                              disabled={actionLoading}
                              className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-xs"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Dispatch via FEFO
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedOrder.status === 'DISPATCHED' && (
                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-purple-600" />
                      Dispatched! Finished goods batches allocated & stock ledger updated.
                    </span>
                    <button
                      onClick={() => setShareModalOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white border border-purple-300 text-purple-800 rounded-lg shadow-xs hover:bg-purple-100/50"
                    >
                      <Share2 className="w-3.5 h-3.5 text-purple-600" />
                      Share Delivery Slip
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400 text-xs">
              Select an order from the inbox to review coverage and dispatch.
            </div>
          )}
        </div>
      </div>
      )}

      {/* Share Invoice & UPI QR Modal */}
      {shareModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-600" />
                Share Invoice & Payment QR
              </h3>
              <button
                onClick={() => setShareModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* UPI QR Display Mock */}
            <div className="text-center p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <div className="w-32 h-32 mx-auto bg-white p-2 rounded-xl border border-stone-300 shadow-xs flex items-center justify-center">
                <QrCode className="w-28 h-28 text-stone-800" />
              </div>
              <div className="text-xs font-bold text-stone-900">
                UPI Pay: ₹{Number(selectedOrder.grandTotal).toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] text-stone-500 font-mono">
                upi://pay?pa=srimurugan@okaxis&am={selectedOrder.grandTotal}&pn=SriMuruganSnacks
              </p>
            </div>

            {/* Share Buttons */}
            <div className="space-y-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Invoice from Sri Murugan Snacks for Order ${selectedOrder.number}. Total: ₹${selectedOrder.grandTotal}. Pay UPI: upi://pay?pa=srimurugan@okaxis&am=${selectedOrder.grandTotal}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Share on WhatsApp (wa.me)
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://snackflow.local/invoice/${selectedOrder.invoices?.[0]?.id || selectedOrder.id}`);
                  alert('Signed invoice link copied to clipboard!');
                }}
                className="w-full flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs py-2.5 rounded-xl border border-stone-200 transition-colors"
              >
                Copy 7-Day HMAC Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
