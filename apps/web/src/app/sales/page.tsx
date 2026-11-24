'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { db, QueuedOrder } from '@/lib/db';
import { RbacGate } from '@/components/common/RbacGate';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Store,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  ShoppingBag,
  History,
  MapPin,
  Package,
  Layers,
} from 'lucide-react';

interface Party {
  id: string;
  name: string;
  kind: string;
  address: string;
  stateCode: string;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  baseUom: string;
  gstRate: number;
  shelfLifeDays?: number;
}

export default function SalesmanPage() {
  const [activeTab, setActiveTab] = useState<'NEW_ORDER' | 'NEW_STORE' | 'HISTORY'>('NEW_ORDER');
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  // Line items state: itemId -> { qty: number, isCarton: boolean, rate: number }
  const [orderLines, setOrderLines] = useState<Record<string, { qty: number; isCarton: boolean; rate: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Past orders from API
  const [pastOrders, setPastOrders] = useState<any[]>([]);

  // Store onboarding state
  const [storeForm, setStoreForm] = useState({
    storeName: '',
    contactPerson: '',
    phone: '',
    address: '',
    gstin: '',
    geoLat: undefined as number | undefined,
    geoLng: undefined as number | undefined,
  });
  const [applications, setApplications] = useState<any[]>([]);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [storeSubmitting, setStoreSubmitting] = useState(false);
  const [storeSuccess, setStoreSuccess] = useState<string | null>(null);

  // Dexie queued orders
  const queuedOrders = useLiveQuery(() => db.queuedOrders.toArray(), []) || [];

  useEffect(() => {
    loadCatalogAndParties();
    loadPastOrders();
    loadApplications();
  }, []);

  const loadCatalogAndParties = async () => {
    try {
      const [partiesRes, itemsRes] = await Promise.all([
        apiFetch<Party[]>('/parties'),
        apiFetch<Item[]>('/catalog/items?kind=FINISHED'),
      ]);
      setParties(partiesRes);
      // Strictly restrict sales products to Murukku and Ribbon Pakoda only
      const allowedSkus = ['FG-MUR-200G', 'FG-RIB-200G'];
      const salesItems = itemsRes.filter((item) =>
        allowedSkus.includes(item.sku) ||
        (item.name.toLowerCase().includes('murukku') && !item.name.toLowerCase().includes('kai')) ||
        item.name.toLowerCase().includes('ribbon')
      );
      setItems(salesItems);
      if (partiesRes.length > 0) {
        setSelectedParty(partiesRes[0]!);
      }
      // Initialize items with 0 qty and standard rate 50
      const initial: Record<string, { qty: number; isCarton: boolean; rate: number }> = {};
      for (const item of salesItems) {
        initial[item.id] = { qty: 0, isCarton: false, rate: 50.0 };
      }
      setOrderLines(initial);
    } catch (e: any) {
      console.warn('Could not load online parties, using offline mock if available', e);
    }
  };

  const loadPastOrders = async () => {
    try {
      const orders = await apiFetch('/orders');
      setPastOrders(orders);
    } catch (e) {
      console.warn('Failed to fetch orders list', e);
    }
  };

  const loadApplications = async () => {
    try {
      const apps = await apiFetch<any[]>('/parties/applications');
      setApplications(apps);
    } catch (e) {
      console.warn('Failed to fetch store applications', e);
    }
  };

  const handleCaptureGps = () => {
    setIsCapturingGps(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setStoreForm((prev) => ({
          ...prev,
          geoLat: Number(pos.coords.latitude.toFixed(6)),
          geoLng: Number(pos.coords.longitude.toFixed(6)),
        }));
        setIsCapturingGps(false);
      },
      () => {
        alert('Could not capture location. Please ensure GPS permission is enabled.');
        setIsCapturingGps(false);
      },
      { timeout: 5000 }
    );
  };

  const handleApplyStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreSubmitting(true);
    setStoreSuccess(null);
    try {
      await apiFetch('/parties/applications', {
        method: 'POST',
        body: JSON.stringify(storeForm),
      });
      setStoreSuccess(`Application submitted for "${storeForm.storeName}"! Waiting for Admin verification.`);
      setStoreForm({
        storeName: '',
        contactPerson: '',
        phone: '',
        address: '',
        gstin: '',
        geoLat: undefined,
        geoLng: undefined,
      });
      loadApplications();
    } catch (err: any) {
      alert(err.message || 'Failed to submit application');
    } finally {
      setStoreSubmitting(false);
    }
  };

  const updateLineQty = (itemId: string, delta: number) => {
    setOrderLines((prev) => {
      const current = prev[itemId] || { qty: 0, isCarton: false, rate: 50.0 };
      const newQty = Math.max(0, current.qty + delta);
      return { ...prev, [itemId]: { ...current, qty: newQty } };
    });
  };

  const toggleCarton = (itemId: string) => {
    setOrderLines((prev) => {
      const current = prev[itemId] || { qty: 0, isCarton: false, rate: 50.0 };
      return { ...prev, [itemId]: { ...current, isCarton: !current.isCarton } };
    });
  };

  // Compute totals
  let totalPkts = 0;
  let taxable = 0;
  let gstTotal = 0;

  for (const item of items) {
    const line = orderLines[item.id];
    if (line && line.qty > 0) {
      const pkts = line.isCarton ? line.qty * 20 : line.qty;
      const lineTaxable = pkts * line.rate;
      const lineGst = lineTaxable * 0.05; // 5% GST on snack food
      totalPkts += pkts;
      taxable += lineTaxable;
      gstTotal += lineGst;
    }
  }

  const grandTotal = taxable + gstTotal;

  const handleSubmitOrder = async () => {
    if (!selectedParty) {
      alert('Please select a customer');
      return;
    }

    const linesToSubmit = items
      .filter((item) => (orderLines[item.id]?.qty || 0) > 0)
      .map((item) => {
        const line = orderLines[item.id]!;
        const pkts = line.isCarton ? line.qty * 20 : line.qty;
        return {
          itemId: item.id,
          itemName: item.name,
          qty: pkts,
          rate: line.rate,
          uom: 'PKT',
        };
      });

    if (linesToSubmit.length === 0) {
      alert('Please select at least one item');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);

    // Client UUID generated once at source for guaranteed idempotency
    const clientUuid = crypto.randomUUID();

    // 1. Capture GPS check-in silently if permitted
    let geoLat: number | undefined;
    let geoLng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation?.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });
      geoLat = Number(pos.coords.latitude.toFixed(6));
      geoLng = Number(pos.coords.longitude.toFixed(6));
    } catch {
      // Offline or permission declined -> proceed safely
    }

    // 2. Write to Dexie offline outbox first
    const queuedRecord: QueuedOrder = {
      clientUuid,
      partyId: selectedParty.id,
      partyName: selectedParty.name,
      lines: linesToSubmit,
      totalAmount: grandTotal,
      geoLat,
      geoLng,
      createdAt: new Date().toISOString(),
      syncStatus: 'QUEUED',
    };

    const outboxId = await db.queuedOrders.add(queuedRecord);

    // 3. Attempt immediate sync with API
    try {
      const orderPayload = {
        clientUuid,
        partyId: selectedParty.id,
        geoLat,
        geoLng,
        lines: linesToSubmit.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          rate: l.rate,
          uom: l.uom,
        })),
      };

      const res = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      });

      // Mark as synced in Dexie
      await db.queuedOrders.update(outboxId, { syncStatus: 'SYNCED' });
      setSubmitSuccess(`Order placed! Order Number: ${res.number || 'Submitted'}`);

      // Reset quantities
      const reset: Record<string, { qty: number; isCarton: boolean; rate: number }> = {};
      for (const item of items) {
        reset[item.id] = { qty: 0, isCarton: false, rate: 50.0 };
      }
      setOrderLines(reset);
      loadPastOrders();
    } catch (e: any) {
      console.warn('Offline mode: order saved locally in outbox', e);
      setSubmitSuccess('Order saved to offline outbox. Will sync automatically when connected.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncOutbox = async () => {
    const pending = await db.queuedOrders.where('syncStatus').equals('QUEUED').toArray();
    for (const ord of pending) {
      try {
        await db.queuedOrders.update(ord.id!, { syncStatus: 'SYNCING' });
        await apiFetch('/orders', {
          method: 'POST',
          body: JSON.stringify({
            clientUuid: ord.clientUuid,
            partyId: ord.partyId,
            geoLat: ord.geoLat,
            geoLng: ord.geoLng,
            lines: ord.lines.map((l) => ({
              itemId: l.itemId,
              qty: l.qty,
              rate: l.rate,
              uom: l.uom,
            })),
          }),
        });
        await db.queuedOrders.update(ord.id!, { syncStatus: 'SYNCED' });
      } catch (err: any) {
        await db.queuedOrders.update(ord.id!, {
          syncStatus: 'QUEUED',
          errorMessage: err.message,
        });
      }
    }
    loadPastOrders();
  };

  return (
    <RbacGate
      allowedRoles={['SALESMAN', 'ADMIN', 'OWNER']}
      portalName="Salesman Mobile PWA & Order Pad"
      requiredPermission="ORDER_CREATE"
    >
      <div className="min-h-screen bg-stone-50 pb-28">
      {/* Top Mobile Bar */}
      <div className="max-w-md mx-auto bg-white border-b border-stone-200 px-4 py-3 sticky top-16 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
            <h1 className="font-bold text-stone-900 text-base">Sales Order Entry</h1>
          </div>

          {/* Tab Pill */}
          <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('NEW_ORDER')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === 'NEW_ORDER' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-500'
              }`}
            >
              Order
            </button>
            <button
              onClick={() => setActiveTab('NEW_STORE')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === 'NEW_STORE' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-500'
              }`}
            >
              + Store
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                activeTab === 'HISTORY' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-500'
              }`}
            >
              History ({pastOrders.length})
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4">
        {submitSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {storeSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{storeSuccess}</span>
          </div>
        )}

        {activeTab === 'NEW_ORDER' ? (
          <div className="space-y-4">
            {/* Customer Picker */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 flex items-center justify-between">
                <span>Select Retailer / Customer</span>
                <span className="text-amber-700 font-normal">Assigned Territory</span>
              </label>

              <div className="grid grid-cols-1 gap-2">
                {parties.map((p) => {
                  const isSelected = selectedParty?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedParty(p)}
                      className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-stone-900">{p.name}</div>
                          <div className="text-[10px] text-stone-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {p.address} • State: {p.stateCode}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        {p.kind.replace('CUSTOMER_', '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Catalog with Steppers */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Packaged Snack Products
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  5% GST Applicable
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const line = orderLines[item.id] || { qty: 0, isCarton: false, rate: 50.0 };
                  const effectivePkts = line.isCarton ? line.qty * 20 : line.qty;
                  const lineSubtotal = effectivePkts * line.rate;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-stone-200/90 bg-stone-50/40 hover:bg-stone-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-stone-900">{item.name}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                              {item.sku}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            ₹{line.rate.toFixed(2)} / PKT • 20 PKT / CTN
                          </p>
                        </div>

                        {/* Stock Hint Badge */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                          In Stock (FEFO)
                        </span>
                      </div>

                      {/* Controls: Packets vs Cartons toggle + Stepper */}
                      <div className="flex items-center justify-between pt-2 border-t border-stone-200/60">
                        {/* Toggle */}
                        <div className="flex items-center bg-stone-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            onClick={() => !line.isCarton || toggleCarton(item.id)}
                            className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                              !line.isCarton ? 'bg-white shadow-xs text-amber-900' : 'text-stone-600'
                            }`}
                          >
                            <Package className="w-3 h-3" />
                            PKT
                          </button>
                          <button
                            onClick={() => line.isCarton || toggleCarton(item.id)}
                            className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                              line.isCarton ? 'bg-white shadow-xs text-amber-900' : 'text-stone-600'
                            }`}
                          >
                            <Layers className="w-3 h-3" />
                            CTN (20x)
                          </button>
                        </div>

                        {/* Stepper (+ / -) */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateLineQty(item.id, -1)}
                            disabled={line.qty <= 0}
                            className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-200 disabled:opacity-40 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>

                          <span className="w-8 text-center font-bold text-sm text-stone-900">
                            {line.qty}
                          </span>

                          <button
                            onClick={() => updateLineQty(item.id, 1)}
                            className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center hover:bg-amber-700 active:scale-95 transition-transform shadow-xs"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Line Subtotal calculation */}
                      {line.qty > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed border-stone-200 flex items-center justify-between text-xs">
                          <span className="text-stone-500">
                            {effectivePkts} packets @ ₹{line.rate}
                          </span>
                          <span className="font-bold text-stone-900">
                            ₹{lineSubtotal.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : activeTab === 'NEW_STORE' ? (
          /* New Store Onboarding Tab */
          <div className="space-y-4">
            {/* Store Registration Form */}
            <form onSubmit={handleApplyStore} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-600" />
                Register New Kirana / Retailer Store
              </h2>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Store / Shop Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Sri Murugan Maligai Stores"
                  value={storeForm.storeName}
                  onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Contact Person *</label>
                  <input
                    required
                    type="text"
                    placeholder="Owner / Proprietor Name"
                    value={storeForm.contactPerson}
                    onChange={(e) => setStoreForm({ ...storeForm, contactPerson: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Mobile No (10-digit) *</label>
                  <input
                    required
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={storeForm.phone}
                    onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Shop Address / Street *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Full street address in Madurai / TN"
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-amber-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">GSTIN (Optional for Unregistered Shops)</label>
                <input
                  type="text"
                  placeholder="33AAAAA0000A1Z5"
                  value={storeForm.gstin}
                  onChange={(e) => setStoreForm({ ...storeForm, gstin: e.target.value.toUpperCase() })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-amber-600 font-mono"
                />
              </div>

              {/* GPS Capture */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[11px]">
                  <span className="font-semibold text-stone-700">Physical Store Location:</span>
                  <div className="text-stone-500 font-mono text-[10px]">
                    {storeForm.geoLat ? `${storeForm.geoLat}, ${storeForm.geoLng}` : 'Location not tagged'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  disabled={isCapturingGps}
                  className="px-2.5 py-1 text-xs bg-stone-200 hover:bg-stone-300 rounded-lg text-stone-700 font-semibold"
                >
                  {isCapturingGps ? 'Locating...' : 'Tag GPS'}
                </button>
              </div>

              <button
                type="submit"
                disabled={storeSubmitting}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {storeSubmitting ? 'Submitting Application...' : 'Submit for Admin Approval'}
              </button>
            </form>

            {/* Application Status History */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                My Store Applications ({applications.length})
              </h3>

              {applications.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4">No store applications submitted yet.</p>
              ) : (
                <div className="space-y-2">
                  {applications.map((app) => (
                    <div key={app.id} className="p-3 rounded-xl border border-stone-100 bg-stone-50 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-stone-900">{app.storeName}</div>
                        <div className="text-[10px] text-stone-500">{app.contactPerson} • {app.phone}</div>
                        <div className="text-[10px] text-stone-400">{app.address}</div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          app.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {app.status === 'APPROVED' ? '✓ Approved' : app.status === 'REJECTED' ? '✕ Rejected' : '⏳ Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Order History & Dexie Outbox Tab */
          <div className="space-y-4">
            {/* Outbox section if any */}
            {queuedOrders.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600" />
                    Offline Outbox ({queuedOrders.length})
                  </div>
                  <button
                    onClick={syncOutbox}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-amber-600 px-2.5 py-1 rounded-lg hover:bg-amber-700 shadow-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Sync Now
                  </button>
                </div>

                <div className="space-y-2">
                  {queuedOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-stone-900">{ord.partyName}</div>
                        <div className="text-[10px] text-stone-500">
                          {ord.lines.length} lines • ₹{ord.totalAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ord.syncStatus === 'SYNCED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {ord.syncStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submitted Orders History from API */}
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
                <History className="w-4 h-4 text-stone-400" />
                Submitted Orders
              </h2>

              {pastOrders.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">No previous orders found.</p>
              ) : (
                <div className="space-y-2.5">
                  {pastOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl border border-stone-200 hover:border-stone-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
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
                      <div className="text-xs text-stone-600 font-medium">{ord.party?.name}</div>
                      <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                        <span className="text-stone-400 text-[10px]">
                          {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="font-bold text-stone-900">
                          ₹{Number(ord.grandTotal).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Order Summary Footer */}
      {activeTab === 'NEW_ORDER' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-3 shadow-lg z-50">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase font-bold text-stone-400">
                Total ({totalPkts} PKT)
              </div>
              <div className="text-lg font-extrabold text-stone-900 leading-tight">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-stone-500">
                Taxable ₹{taxable.toFixed(2)} + GST ₹{gstTotal.toFixed(2)}
              </div>
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting || totalPkts === 0}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md shadow-amber-600/25 transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Placing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Order
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
    </RbacGate>
  );
}
