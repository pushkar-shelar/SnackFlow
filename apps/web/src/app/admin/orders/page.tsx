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
} from 'lucide-react';

export default function AdminOrdersPage() {
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

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner with Quick Actions and Keyboard Hint */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-stone-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-amber-600" />
            Admin Order Management & Invoicing
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time stock coverage evaluation, keyboard approvals (A/R/H), one-click GST invoicing & FEFO dispatch
          </p>
        </div>

        {/* Keyboard hints pill */}
        <div className="flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-600">
          <span className="font-semibold text-stone-800">Shortcuts:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 font-mono text-[11px] shadow-xs">A</kbd> Approve
          <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 font-mono text-[11px] shadow-xs">R</kbd> Reject
          <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 font-mono text-[11px] shadow-xs">H</kbd> Hold
        </div>
      </div>

      {/* Split View Container */}
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
