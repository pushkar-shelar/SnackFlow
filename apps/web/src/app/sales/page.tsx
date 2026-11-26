'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch, getStoredSession } from '@/lib/api';
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

const INDIAN_GST_STATES = [
  { code: '33', label: '33 - Tamil Nadu (Intra-State)' },
  { code: '29', label: '29 - Karnataka (Inter-State)' },
  { code: '32', label: '32 - Kerala (Inter-State)' },
  { code: '37', label: '37 - Andhra Pradesh (Inter-State)' },
  { code: '36', label: '36 - Telangana (Inter-State)' },
  { code: '34', label: '34 - Puducherry (Inter-State)' },
  { code: '27', label: '27 - Maharashtra (Inter-State)' },
  { code: '07', label: '07 - Delhi (Inter-State)' },
  { code: '24', label: '24 - Gujarat (Inter-State)' },
] as const;

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

  // Line items state: itemId -> { pkts: number, cartons: number, rate: number }
  const [orderLines, setOrderLines] = useState<Record<string, { pkts: number; cartons: number; rate: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedModal, setSubmittedModal] = useState<{
    orderNumber: string;
    partyName: string;
    totalAmount: number;
    totalPkts: number;
    offline?: boolean;
  } | null>(null);

  // Past orders from API
  const [pastOrders, setPastOrders] = useState<any[]>([]);

  // Store onboarding state
  const [storeForm, setStoreForm] = useState({
    storeName: '',
    contactPerson: '',
    phone: '',
    address: '',
    stateCode: '33',
    gstin: '',
    geoLat: undefined as number | undefined,
    geoLng: undefined as number | undefined,
  });
  const [applications, setApplications] = useState<any[]>([]);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [storeSubmitting, setStoreSubmitting] = useState(false);
  const [storeSuccess, setStoreSuccess] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Store current role check for clearer UI feedback
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  // Dexie queued orders
  const queuedOrders = useLiveQuery(() => db.queuedOrders.toArray(), []) || [];

  useEffect(() => {
    const syncAndLoad = () => {
      const session = getStoredSession();
      setCurrentRole(session?.role ?? null);
      if (!session || !['SALESMAN', 'ADMIN', 'OWNER'].includes(session.role)) {
        return;
      }
      setSubmitSuccess(null);
      setSubmitError(null);
      setSubmittedModal(null);
      loadCatalogAndParties();
      loadPastOrders();
      loadApplications();
    };

    syncAndLoad();
    window.addEventListener('snackflow-session-change', syncAndLoad);
    return () => window.removeEventListener('snackflow-session-change', syncAndLoad);
  }, []);

  useEffect(() => {
    if (!selectedParty || items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const rates = await Promise.all(
          items.map(async (item) => {
            try {
              const res = await apiFetch<{ rate: string | number }>(
                `/catalog/rate?partyId=${encodeURIComponent(selectedParty.id)}&itemId=${encodeURIComponent(item.id)}`,
              );
              const parsed = Number(res?.rate);
              return [item.id, Number.isFinite(parsed) && parsed > 0 ? parsed : 50.0] as const;
            } catch {
              return [item.id, 50.0] as const;
            }
          }),
        );
        if (cancelled) return;
        setOrderLines((prev) => {
          const next = { ...prev };
          for (const [id, rate] of rates) {
            next[id] = { ...(next[id] || { pkts: 0, cartons: 0, rate }), rate };
          }
          return next;
        });
      } catch {
        // Keep current fallback rates if rate lookup fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedParty, items]);

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
      const initial: Record<string, { pkts: number; cartons: number; rate: number }> = {};
      for (const item of salesItems) {
        initial[item.id] = { pkts: 0, cartons: 0, rate: 50.0 };
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
    setStoreError(null);
    try {
      await apiFetch('/parties/applications', {
        method: 'POST',
        body: JSON.stringify({
          ...storeForm,
          gstin: storeForm.gstin.trim() || undefined,
        }),
      });
      setStoreSuccess(`Application submitted for "${storeForm.storeName}"! Waiting for Admin verification.`);
      setStoreForm({
        storeName: '',
        contactPerson: '',
        phone: '',
        address: '',
        stateCode: '33',
        gstin: '',
        geoLat: undefined,
        geoLng: undefined,
      });
      loadApplications();
    } catch (err: any) {
      setStoreError(err.message || 'Failed to submit application');
    } finally {
      setStoreSubmitting(false);
    }
  };

  const updateLineUnit = (itemId: string, unit: 'pkts' | 'cartons', delta: number) => {
    setOrderLines((prev) => {
      const current = prev[itemId] || { pkts: 0, cartons: 0, rate: 50.0 };
      const nextVal = Math.max(0, current[unit] + delta);
      return { ...prev, [itemId]: { ...current, [unit]: nextVal } };
    });
  };

  const setLineUnit = (itemId: string, unit: 'pkts' | 'cartons', value: number) => {
    setOrderLines((prev) => {
      const current = prev[itemId] || { pkts: 0, cartons: 0, rate: 50.0 };
      const safeVal = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      return { ...prev, [itemId]: { ...current, [unit]: safeVal } };
    });
  };

  // Compute totals
  let totalPkts = 0;
  let taxable = 0;
  let gstTotal = 0;

  for (const item of items) {
    const line = orderLines[item.id];
    if (line) {
      const pkts = line.cartons * 20 + line.pkts;
      if (pkts > 0) {
        const lineTaxable = pkts * line.rate;
        const lineGst = lineTaxable * 0.05; // 5% GST on snack food
        totalPkts += pkts;
        taxable += lineTaxable;
        gstTotal += lineGst;
      }
    }
  }

  const grandTotal = taxable + gstTotal;

  const handleSubmitOrder = async () => {
    if (!selectedParty) {
      setSubmitError('Please select a customer before submitting.');
      return;
    }

    const linesToSubmit = items
      .map((item) => {
        const line = orderLines[item.id];
        const pkts = line ? line.cartons * 20 + line.pkts : 0;
        return {
          itemId: item.id,
          itemName: item.name,
          qty: pkts,
          rate: line?.rate ?? 50.0,
          uom: 'PKT',
        };
      })
      .filter((line) => line.qty > 0);

    if (linesToSubmit.length === 0) {
      setSubmitError('Please add at least one item quantity before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    // Client UUID generated once at source for guaranteed idempotency
    const clientUuid = crypto.randomUUID();
    let outboxId: number | undefined;

    try {
      // 1. Capture GPS check-in silently with hard 1000ms wall-clock cap so Submit never hangs
      let geoLat: number | undefined;
      let geoLng: number | undefined;
      if (typeof navigator !== 'undefined' && typeof navigator.geolocation?.getCurrentPosition === 'function') {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('GPS lookup timed out')), 1000);
            navigator.geolocation.getCurrentPosition(
              (p) => {
                clearTimeout(timer);
                resolve(p);
              },
              (err) => {
                clearTimeout(timer);
                reject(err);
              },
              { timeout: 1000 },
            );
          });
          geoLat = Number(pos.coords.latitude.toFixed(6));
          geoLng = Number(pos.coords.longitude.toFixed(6));
        } catch {
          // Offline, denied, or timed out -> proceed immediately
        }
      }

      // 2. Write to Dexie offline outbox best-effort (never block online submit if IndexedDB fails)
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
      try {
        outboxId = await db.queuedOrders.add(queuedRecord);
      } catch {
        // Proceed with online submission even if local IndexedDB storage is restricted
      }

      // 3. Attempt immediate sync with API
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
        headers: { 'Idempotency-Key': clientUuid },
        body: JSON.stringify(orderPayload),
      });

      if (outboxId !== undefined) {
        try {
          await db.queuedOrders.update(outboxId, { syncStatus: 'SYNCED' });
        } catch {}
      }
      setSubmitSuccess(`Order placed! Order Number: ${res.number || 'Submitted'}`);
      setSubmittedModal({
        orderNumber: res.number || 'Submitted',
        partyName: selectedParty.name,
        totalAmount: Number(res.grandTotal ?? grandTotal),
        totalPkts: linesToSubmit.reduce((acc, l) => acc + l.qty, 0),
      });

      // Reset quantities while keeping party-specific rates
      setOrderLines((prev) => {
        const reset: Record<string, { pkts: number; cartons: number; rate: number }> = {};
        for (const item of items) {
          reset[item.id] = { pkts: 0, cartons: 0, rate: prev[item.id]?.rate ?? 50.0 };
        }
        return reset;
      });
      loadPastOrders();
    } catch (e: any) {
      const isOfflineOrNetwork =
        !navigator.onLine || e?.name === 'AbortError' || e instanceof TypeError;
      if (isOfflineOrNetwork) {
        console.warn('Offline mode: order saved locally in outbox', e);
        setSubmitSuccess('Order saved to offline outbox. Will sync automatically when connected.');
        setSubmittedModal({
          orderNumber: 'Queued Offline',
          partyName: selectedParty.name,
          totalAmount: grandTotal,
          totalPkts: linesToSubmit.reduce((acc, l) => acc + l.qty, 0),
          offline: true,
        });
      } else {
        if (outboxId !== undefined) {
          try {
            await db.queuedOrders.delete(outboxId);
          } catch {}
        }
        setSubmitError(e?.message || 'Failed to submit order');
      }
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
      <div className="min-h-screen bg-stone-50 pb-28 overflow-x-hidden">
      {/* Top Mobile Bar */}
      <div className="max-w-md mx-auto bg-white border-b border-stone-200 px-3 sm:px-4 py-3 sticky top-16 z-40">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-5 h-5 text-amber-600 shrink-0" />
            <h1 className="font-bold text-stone-900 text-sm sm:text-base truncate">Sales Order Entry</h1>
          </div>

          {/* Tab Pill */}
          <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-[11px] font-semibold shrink-0">
            <button
              onClick={() => setActiveTab('NEW_ORDER')}
              className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                activeTab === 'NEW_ORDER' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-500'
              }`}
            >
              Order
            </button>
            <button
              onClick={() => setActiveTab('NEW_STORE')}
              className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                activeTab === 'NEW_STORE' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-500'
              }`}
            >
              + Store
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
                activeTab === 'HISTORY' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-500'
              }`}
            >
              History ({pastOrders.length})
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4">
        {currentRole && currentRole !== 'SALESMAN' && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
            Viewing as <strong>{currentRole}</strong>. Submitting new sales orders requires a <strong>SALESMAN</strong> account — switch to <em>Karthik (Salesman)</em> in the top menu to place orders.
          </div>
        )}

        {submitSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {submitError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {submitError}
          </div>
        )}

        {storeSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{storeSuccess}</span>
          </div>
        )}

        {storeError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {storeError}
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
                  {selectedParty && selectedParty.stateCode !== '33'
                    ? '5% IGST (Inter-State)'
                    : '5% GST (CGST + SGST)'}
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const line = orderLines[item.id] || { pkts: 0, cartons: 0, rate: 50.0 };
                  const effectivePkts = line.cartons * 20 + line.pkts;
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

                      {/* Dual Controls: Simultaneous Cartons (20x) + Loose Packets */}
                      <div className="space-y-2 pt-2 border-t border-stone-200/60">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Cartons (20 PKT)</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Decrease cartons for ${item.name}`}
                              onClick={() => updateLineUnit(item.id, 'cartons', -1)}
                              disabled={line.cartons <= 0}
                              className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-200 disabled:opacity-40 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              aria-label={`Cartons for ${item.name}`}
                              value={line.cartons}
                              onChange={(e) => setLineUnit(item.id, 'cartons', Number(e.target.value))}
                              className="w-12 h-8 text-center font-bold text-sm text-stone-900 bg-white border border-stone-200 rounded-lg focus:outline-amber-600"
                            />
                            <button
                              type="button"
                              aria-label={`Increase cartons for ${item.name}`}
                              onClick={() => updateLineUnit(item.id, 'cartons', 1)}
                              className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center hover:bg-amber-700 active:scale-95 transition-transform shadow-xs"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Loose Packets (PKT)</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Decrease quantity for ${item.name}`}
                              onClick={() => updateLineUnit(item.id, 'pkts', -1)}
                              disabled={line.pkts <= 0}
                              className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 hover:bg-stone-200 disabled:opacity-40 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              aria-label={`Packets for ${item.name}`}
                              value={line.pkts}
                              onChange={(e) => setLineUnit(item.id, 'pkts', Number(e.target.value))}
                              className="w-12 h-8 text-center font-bold text-sm text-stone-900 bg-white border border-stone-200 rounded-lg focus:outline-amber-600"
                            />
                            <button
                              type="button"
                              aria-label={`Increase quantity for ${item.name}`}
                              onClick={() => updateLineUnit(item.id, 'pkts', 1)}
                              className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center hover:bg-amber-700 active:scale-95 transition-transform shadow-xs"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Line Subtotal calculation */}
                      {effectivePkts > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed border-stone-200 flex items-center justify-between text-xs">
                          <span className="text-stone-500">
                            {[
                              line.cartons > 0 ? `${line.cartons} CTN` : null,
                              line.pkts > 0 ? `${line.pkts} PKT` : null,
                            ]
                              .filter(Boolean)
                              .join(' + ')}{' '}
                            ({effectivePkts} packets @ ₹{line.rate})
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
                    pattern="[6-9][0-9]{9}"
                    title="Enter a valid 10-digit Indian mobile number starting with 6-9"
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
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">State &amp; GST Code *</label>
                <select
                  value={storeForm.stateCode}
                  onChange={(e) => setStoreForm({ ...storeForm, stateCode: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-amber-600 bg-white"
                >
                  {INDIAN_GST_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-500 mt-1">
                  {storeForm.stateCode === '33'
                    ? 'Same state as factory (33): billed as 2.5% CGST + 2.5% SGST (no extra charges).'
                    : `Outside Tamil Nadu (${storeForm.stateCode}): billed as 5% IGST with no extra charges.`}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">GSTIN (Optional for Unregistered Shops)</label>
                <input
                  type="text"
                  placeholder={storeForm.stateCode === '29' ? '29AAAAA0000A1Z5' : '33AAAAA0000A1Z5'}
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
          {submitError && (
            <div className="max-w-md mx-auto mb-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold">
              {submitError}
            </div>
          )}
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

      {/* Order Submitted Confirmation Modal Popup */}
      {submittedModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-submitted-title"
          onClick={() => setSubmittedModal(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSubmittedModal(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border border-emerald-200 shadow-2xl p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 id="order-submitted-title" className="text-lg font-extrabold text-stone-900">
                {submittedModal.offline ? 'Order Saved Offline' : 'Order Submitted'}
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                {submittedModal.offline
                  ? 'Order queued locally and will sync automatically when online.'
                  : 'Your order has been sent to Admin Inbox for approval.'}
              </p>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Order #</span>
                <span className="font-bold text-stone-900">{submittedModal.orderNumber}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Customer</span>
                <span className="font-semibold text-stone-800 truncate max-w-[190px]">
                  {submittedModal.partyName}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Quantity</span>
                <span className="font-semibold text-stone-800">{submittedModal.totalPkts} PKT</span>
              </div>
              <div className="flex justify-between gap-2 pt-1 border-t border-stone-200">
                <span className="text-stone-500 font-semibold">Grand Total</span>
                <span className="font-extrabold text-emerald-700">
                  ₹{submittedModal.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSubmittedModal(null);
                  setActiveTab('HISTORY');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-50 transition-colors"
              >
                View History
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setSubmittedModal(null)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RbacGate>
  );
}
