'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, getStoredSession } from '@/lib/api';
import { RbacGate } from '@/components/common/RbacGate';
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
  AlertTriangle,
  AlertCircle,
  Clock,
  Wallet,
} from 'lucide-react';

export default function AdminOrdersPage() {
  const [activeAdminTab, setActiveAdminTab] = useState<'ORDERS' | 'STORES' | 'PAYMENTS'>('ORDERS');
  const [partiesList, setPartiesList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [paymentPartyId, setPaymentPartyId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('4000');
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'NEFT' | 'CHEQUE'>('UPI');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [partyOutstanding, setPartyOutstanding] = useState<{ totalInvoiced: number; totalReceived: number; outstanding: number } | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState<boolean>(false);
  const [paymentMsg, setPaymentMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [storeApplications, setStoreApplications] = useState<any[]>([]);
  const [approvalForms, setApprovalForms] = useState<Record<string, { creditLimit: number; creditDays: number }>>({});
  const [approvingAppId, setApprovingAppId] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<'PENDING' | 'APPROVED' | 'ALL'>('PENDING');

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [shareData, setShareData] = useState<{
    publicUrl: string;
    whatsappUrl: string;
    upiUri: string;
    invoiceNumber: string;
    expiresAt: string;
  } | null>(null);
  const [shareLoading, setShareLoading] = useState<boolean>(false);
  const [stockByItem, setStockByItem] = useState<Record<string, number>>({});
  const [_invoicePreview, setInvoicePreview] = useState<any | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const [data, balances] = await Promise.all([
        apiFetch('/orders'),
        apiFetch<any[]>('/inventory/balances').catch(() => []),
      ]);
      if (Array.isArray(balances)) {
        const totals: Record<string, number> = {};
        for (const b of balances) {
          const itemKey = b.itemId || b.item?.id;
          if (itemKey) {
            totals[itemKey] = (totals[itemKey] || 0) + Number(b.qty ?? 0);
          }
        }
        setStockByItem(totals);
      }
      setOrders(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) {
        setSelectedOrderId((prev) => prev || data[0].id);
      }
    } catch (e) {
      console.error('Failed to load orders', e);
    }
  }, []);

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
      setStoreApplications((prev) =>
        prev.map((a) =>
          a.id === appId
            ? { ...a, status: 'APPROVED', creditLimit: form.creditLimit, creditDays: form.creditDays }
            : a
        )
      );
      alert('✓ Store approved and onboarded! It has been moved to the active customer master.');
      loadStoreApplications();
    } catch (e: any) {
      alert(e.message || 'Failed to approve store application');
    } finally {
      setApprovingAppId(null);
    }
  };

  const handleRejectStore = async (appId: string) => {
    setApprovingAppId(appId);
    try {
      await apiFetch(`/parties/applications/${appId}/reject`, {
        method: 'POST',
      });
      setStoreApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'REJECTED' } : a)),
      );
      loadStoreApplications();
    } catch (e: any) {
      alert(e.message || 'Failed to reject store application');
    } finally {
      setApprovingAppId(null);
    }
  };

  const loadPartiesAndPayments = useCallback(async () => {
    try {
      const [partiesRes, paymentsRes] = await Promise.all([
        apiFetch<any[]>('/parties').catch(() => []),
        apiFetch<any[]>('/payments?limit=50').catch(() => []),
      ]);
      if (Array.isArray(partiesRes)) {
        const customers = partiesRes.filter((p) => String(p.kind || '').startsWith('CUSTOMER'));
        setPartiesList(customers);
        setPaymentPartyId((prev) => prev || customers[0]?.id || '');
      }
      if (Array.isArray(paymentsRes)) {
        setPaymentsList(paymentsRes);
      }
    } catch (e) {
      console.warn('Failed to load parties or payments', e);
    }
  }, []);

  useEffect(() => {
    const session = getStoredSession();
    if (!session || !['ADMIN', 'OWNER'].includes(session.role)) {
      return;
    }
    loadOrders();
    loadStoreApplications();
    loadPartiesAndPayments();
  }, [loadOrders, loadStoreApplications, loadPartiesAndPayments]);

  useEffect(() => {
    if (!paymentPartyId) {
      setPartyOutstanding(null);
      return;
    }
    let cancelled = false;
    apiFetch<any>(`/parties/${paymentPartyId}/outstanding`)
      .then((res) => {
        if (!cancelled) setPartyOutstanding(res);
      })
      .catch(() => {
        if (!cancelled) setPartyOutstanding(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentPartyId]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(paymentAmount);
    if (!paymentPartyId || !(amt > 0)) {
      setPaymentMsg({ type: 'error', text: 'Select a customer and enter a positive payment amount.' });
      return;
    }
    setPaymentSubmitting(true);
    setPaymentMsg(null);
    try {
      const refStr = paymentRef.trim() || `PAY-${Date.now().toString().slice(-6)}`;
      await apiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({
          partyId: paymentPartyId,
          amount: amt,
          mode: paymentMode,
          reference: refStr,
        }),
      });
      const updatedOut = await apiFetch<any>(`/parties/${paymentPartyId}/outstanding`).catch(() => null);
      if (updatedOut) setPartyOutstanding(updatedOut);
      setPaymentMsg({
        type: 'success',
        text: `Payment of ₹${amt.toLocaleString('en-IN')} (${paymentMode}) recorded & FIFO-allocated! Remaining outstanding: ₹${Number(updatedOut?.outstanding ?? 0).toLocaleString('en-IN')}.`,
      });
      setPaymentRef('');
      await Promise.all([loadPartiesAndPayments(), loadOrders()]);
    } catch (err: any) {
      setPaymentMsg({ type: 'error', text: err?.message || 'Failed to record payment' });
    } finally {
      setPaymentSubmitting(false);
    }
  };

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

      if (actionLoading || !selectedOrder || selectedOrder.status !== 'SUBMITTED') return;

      if (e.key === 'a' || e.key === 'A') {
        const computedHasShortage =
          selectedOrder.hasShortage ??
          (selectedOrder.lines || []).some(
            (l: any) => (stockByItem[l.itemId] ?? Number.POSITIVE_INFINITY) < Number(l.qty || 0),
          );
        if (!computedHasShortage) {
          handleApproveOrder('APPROVE_FULL');
        } else {
          alert('Mandatory Stock Control: Order has items out of stock. Use "Approve Available & Backorder" or "Hold".');
        }
      } else if (e.key === 'r' || e.key === 'R') {
        handleRejectOrder();
      } else if (e.key === 'h' || e.key === 'H') {
        handleHoldOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, actionLoading, stockByItem]);

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

  const handleOpenShareModal = async (invoiceId?: string) => {
    setShareModalOpen(true);
    setShareData(null);
    if (!invoiceId) return;
    setShareLoading(true);
    try {
      const data = await apiFetch<any>(`/invoices/${invoiceId}/share`);
      if (data?.publicUrl) {
        setShareData(data);
      }
    } catch (e: any) {
      console.warn('Could not load signed share link', e);
    } finally {
      setShareLoading(false);
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
  const approvedStoreCount = storeApplications.filter((a) => a.status === 'APPROVED').length;

  const displayedApplications = storeApplications.filter((app) => {
    if (storeFilter === 'PENDING') return app.status === 'PENDING';
    if (storeFilter === 'APPROVED') return app.status === 'APPROVED';
    return true;
  });

  return (
    <RbacGate
      allowedRoles={['ADMIN', 'OWNER']}
      portalName="Admin Order Inbox & Store Onboarding"
      requiredPermission="ORDER_APPROVE"
    >
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
            <button
              onClick={() => setActiveAdminTab('PAYMENTS')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeAdminTab === 'PAYMENTS' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-600'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-amber-600" />
              <span>Payments</span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Store Onboarding Applications ({displayedApplications.length})
                </h2>
                <p className="text-[11px] text-stone-500">
                  Review field sales store onboarding requests and allocate credit limits
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs font-semibold">
                <button
                  onClick={() => setStoreFilter('PENDING')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    storeFilter === 'PENDING'
                      ? 'bg-white shadow-xs text-amber-900 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Pending Queue</span>
                  {pendingStoreCount > 0 && (
                    <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {pendingStoreCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setStoreFilter('APPROVED')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    storeFilter === 'APPROVED'
                      ? 'bg-white shadow-xs text-emerald-900 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Onboarded & Active</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {approvedStoreCount}
                  </span>
                </button>
                <button
                  onClick={() => setStoreFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    storeFilter === 'ALL'
                      ? 'bg-white shadow-xs text-stone-900 font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All ({storeApplications.length})
                </button>
              </div>

              <button
                onClick={loadStoreApplications}
                className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition-all shrink-0"
              >
                Refresh
              </button>
            </div>
          </div>

          {displayedApplications.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs">
              {storeFilter === 'PENDING'
                ? '✓ All store applications have been reviewed and onboarded! Zero pending approvals.'
                : 'No store applications found in this view.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedApplications.map((app) => {
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

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveStore(app.id)}
                            disabled={isApproving}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            {isApproving ? 'Processing...' : 'Approve & Onboard Store'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectStore(app.id)}
                            disabled={isApproving}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : app.status === 'REJECTED' ? (
                      <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] font-medium flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Store application was rejected.</span>
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
      ) : activeAdminTab === 'ORDERS' ? (
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-stone-900">{ord.number}</span>
                        {ord.hasShortage && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            Shortage
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ord.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'PARTIALLY_APPROVED'
                            ? 'bg-amber-100 text-amber-800'
                            : ord.status === 'INVOICED'
                            ? 'bg-blue-100 text-blue-800'
                            : ord.status === 'DISPATCHED'
                            ? 'bg-purple-100 text-purple-800'
                            : ord.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-stone-100 text-stone-800'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-stone-800">{ord.party?.name}</div>

                    <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-stone-100">
                      <span className="text-[10px] text-stone-400">
                        {ord.lines?.length || 1} line item(s) • Sales: {ord.salesman?.name || 'Karthik'}
                      </span>
                      <span className="font-extrabold text-stone-900">
                        ₹{Number(ord.grandTotal ?? ord.totalAmount ?? 0).toLocaleString('en-IN')}
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
                      Client UUID: {selectedOrder.clientUuid ? `${selectedOrder.clientUuid.slice(0, 8)}...` : (selectedOrder.id || 'SO-001')}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    Customer: <span className="font-bold text-stone-800">{selectedOrder.party?.name}</span> • State Code: {selectedOrder.party?.stateCode || '33'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Grand Total</div>
                  <div className="text-2xl font-black text-stone-900">
                    ₹{Number(selectedOrder.grandTotal ?? selectedOrder.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                      {selectedOrder.lines?.map((line: any) => {
                        const liveOnHand = stockByItem[line.itemId];
                        const onHand = line.onHandQty !== undefined ? line.onHandQty : liveOnHand;
                        const computedCoverage =
                          line.stockCoverage ||
                          (onHand === undefined
                            ? 'COVERED'
                            : onHand <= 0
                            ? 'OUT_OF_STOCK'
                            : onHand < Number(line.qty || 0)
                            ? 'PARTIAL'
                            : 'COVERED');
                        return (
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
                            {computedCoverage === 'OUT_OF_STOCK' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                Out of Stock (0 on hand)
                              </span>
                            ) : computedCoverage === 'PARTIAL' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Partial ({onHand} / {line.qty} {line.uom})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Covered ({onHand !== undefined ? `${onHand} on hand` : 'In Stock'})
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
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
                  <span>Taxable: <b>₹{Number(selectedOrder.taxableTotal ?? (selectedOrder.grandTotal ? selectedOrder.grandTotal * 0.95 : 0)).toFixed(2)}</b></span>
                  <span>GST: <b>₹{Number(selectedOrder.taxTotal ?? (selectedOrder.grandTotal ? selectedOrder.grandTotal * 0.05 : 0)).toFixed(2)}</b></span>
                </div>
              </div>

              {/* Workflow Actions depending on Order Status */}
              <div className="pt-2 border-t border-stone-100">
                {selectedOrder.status === 'SUBMITTED' && (
                  <div className="space-y-3">
                    {selectedOrder.hasShortage && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">Mandatory Inventory Control: Stock Shortage Detected</div>
                          <div className="text-[11px] text-amber-800 mt-0.5">
                            One or more items in this order do not have sufficient finished goods inventory on hand.
                            Full approval is blocked to prevent unfulfillable dispatches.
                          </div>
                        </div>
                      </div>
                    )}

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
                      {selectedOrder.hasShortage ? (
                        <button
                          onClick={() => handleApproveOrder('APPROVE_AVAILABLE_BACKORDER')}
                          disabled={actionLoading}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 active:scale-95 transition-all"
                        >
                          <Clock className="w-4 h-4" />
                          Approve Available & Backorder
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApproveOrder('APPROVE_FULL')}
                          disabled={actionLoading}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve Full (A)
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {selectedOrder.status === 'PARTIALLY_APPROVED' && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Partially Approved (Available items covered; balance backordered). Ready for Invoicing.
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

                {(() => {
                  const activeInvoice = selectedOrder.invoices?.find((i: any) => i.status !== 'CANCELLED') || selectedOrder.invoices?.[0];
                  if (selectedOrder.status !== 'INVOICED' && !activeInvoice) return null;
                  return (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-blue-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Generated Invoice: {activeInvoice?.number || 'Posted'}
                        </span>
                        <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded">
                          {activeInvoice?.status || 'POSTED'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-blue-800 text-xs">
                        <span>Invoice Total: <b>₹{Number(activeInvoice?.total || selectedOrder.grandTotal).toLocaleString('en-IN')}</b></span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenShareModal(activeInvoice?.id)}
                            className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share (WhatsApp/QR)
                          </button>

                          {selectedOrder.status !== 'DISPATCHED' && activeInvoice && activeInvoice.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleDispatch(activeInvoice.id)}
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
                  );
                })()}

                {selectedOrder.status === 'DISPATCHED' && (
                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-purple-600" />
                      Dispatched! Finished goods batches allocated & stock ledger updated.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedOrder.party?.id) setPaymentPartyId(selectedOrder.party.id);
                          setActiveAdminTab('PAYMENTS');
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-emerald-600 text-white rounded-lg shadow-xs hover:bg-emerald-700"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        Record Payment
                      </button>
                      <button
                        onClick={() => handleOpenShareModal((selectedOrder.invoices?.find((i: any) => i.status !== 'CANCELLED') || selectedOrder.invoices?.[0])?.id)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white border border-purple-300 text-purple-800 rounded-lg shadow-xs hover:bg-purple-100/50"
                      >
                        <Share2 className="w-3.5 h-3.5 text-purple-600" />
                        Share Delivery Slip
                      </button>
                    </div>
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
      ) : null}

      {activeAdminTab === 'PAYMENTS' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleRecordPayment} className="lg:col-span-5 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <Wallet className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="text-sm font-bold text-stone-900">Record Customer Payment (FIFO)</h2>
                <p className="text-[11px] text-stone-500">Allocates payment against oldest unpaid POSTED invoices</p>
              </div>
            </div>

            {paymentMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border ${
                  paymentMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {paymentMsg.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Customer / Party *</label>
              <select
                value={paymentPartyId}
                onChange={(e) => setPaymentPartyId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white"
              >
                {partiesList.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>

            {partyOutstanding && (
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                <div>
                  <div className="text-[10px] text-stone-400 font-bold uppercase">Invoiced</div>
                  <div className="font-bold text-stone-900">₹{Number(partyOutstanding.totalInvoiced).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400 font-bold uppercase">Received</div>
                  <div className="font-bold text-emerald-700">₹{Number(partyOutstanding.totalReceived).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-stone-400 font-bold uppercase">Outstanding</div>
                  <div className="font-extrabold text-rose-700">₹{Number(partyOutstanding.outstanding).toLocaleString('en-IN')}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white"
                >
                  <option value="UPI">UPI</option>
                  <option value="NEFT">NEFT</option>
                  <option value="CASH">CASH</option>
                  <option value="CHEQUE">CHEQUE</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Reference / UTR No.</label>
              <input
                type="text"
                placeholder="e.g. UPI-RETAILER-A-4000"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={paymentSubmitting}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
            >
              {paymentSubmitting ? 'Recording Payment...' : 'Record Payment'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-stone-900 pb-3 border-b border-stone-100">
              Recent Payments ({paymentsList.length})
            </h2>
            {paymentsList.length === 0 ? (
              <p className="text-xs text-stone-400 py-8 text-center">No customer payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] border-b border-stone-200">
                    <tr>
                      <th className="p-2.5">Payment #</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Mode / Ref</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {paymentsList.map((pm) => (
                      <tr key={pm.id}>
                        <td className="p-2.5 font-mono font-bold text-stone-900">{pm.paymentNo}</td>
                        <td className="p-2.5 text-stone-700">{pm.party?.name || '-'}</td>
                        <td className="p-2.5 text-stone-500">{pm.mode} • {pm.reference}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">₹{Number(pm.amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Invoice & UPI QR Modal */}
      {shareModalOpen && selectedOrder && (
        <div role="dialog" aria-modal="true" aria-label="Share Invoice and Payment QR" className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-sm w-full rounded-2xl p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-600" />
                Share Invoice & Payment QR
              </h3>
              <button
                type="button"
                aria-label="Close share modal"
                onClick={() => setShareModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {(() => {
              const totalStr = Number(selectedOrder.grandTotal || 0).toFixed(2);
              const invNo = shareData?.invoiceNumber || selectedOrder.invoices?.[0]?.number || selectedOrder.number;
              const upiUri =
                shareData?.upiUri ||
                `upi://pay?pa=srimurugansnacks@okhdfcbank&pn=Sri%20Murugan%20Snacks&am=${totalStr}&cu=INR&tn=${encodeURIComponent(`Invoice ${invNo}`)}`;
              const whatsappUrl =
                shareData?.whatsappUrl ||
                `https://wa.me/?text=${encodeURIComponent(
                  `Invoice ${invNo} from Sri Murugan Snacks. Total: ₹${totalStr}. UPI Pay: ${upiUri}`,
                )}`;
              const shareUrl = shareData?.publicUrl || '';

              return (
                <>
                  {/* UPI QR Display */}
                  <div className="text-center p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                    <div className="w-32 h-32 mx-auto bg-white p-2 rounded-xl border border-stone-300 shadow-xs flex items-center justify-center">
                      <QrCode className="w-28 h-28 text-stone-800" />
                    </div>
                    <div className="text-xs font-bold text-stone-900">
                      UPI Pay: ₹{Number(selectedOrder.grandTotal).toLocaleString('en-IN')}
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono break-all">
                      {shareLoading ? 'Signing HMAC link...' : upiUri}
                    </p>
                  </div>

                  {/* Share Buttons */}
                  <div className="space-y-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-xs transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Share on WhatsApp (wa.me)
                    </a>

                    <button
                      type="button"
                      disabled={!shareUrl || shareLoading}
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        alert('Signed HMAC invoice link copied to clipboard!');
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 font-bold text-xs py-2.5 rounded-xl border border-stone-200 transition-colors"
                    >
                      {shareLoading ? 'Generating Signed Link...' : shareUrl ? 'Copy 24-Hr Signed HMAC Link' : 'Signed Link Unavailable'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
    </RbacGate>
  );
}
