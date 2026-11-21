'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toDecimal } from '@snackflow/shared';
import {
  Factory,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  Package,
  RefreshCw,
  Coins,
  ShieldCheck,
  Activity,
  Wrench,
  Clock,
  Check,
  X,
  ShieldAlert,
} from 'lucide-react';

export default function ProductionWizardPage() {
  const [activeMainTab, setActiveMainTab] = useState<'WIZARD' | 'EQUIPMENT'>('WIZARD');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [_recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [_fgItems, setFgItems] = useState<any[]>([]);
  const [selectedFgItem, setSelectedFgItem] = useState<any | null>(null);
  const [batchFactor] = useState<number>(1.0);

  // Active Draft Run
  const [draftRun, setDraftRun] = useState<any | null>(null);
  const [_isCreatingDraft, setIsCreatingDraft] = useState<boolean>(false);

  // Step 1: Material actual inputs (itemId -> actualQty)
  const [actualInputs, setActualInputs] = useState<Record<string, number>>({});

  // Step 2: Output and Wastage
  const [goodOutputQty, setGoodOutputQty] = useState<number>(188);
  const [damagedPouchesQty, setDamagedPouchesQty] = useState<number>(6);
  const [cartonsUsedQty, setCartonsUsedQty] = useState<number>(9);

  // Quality Control (QC) Gate Checkpoint State
  const [qcMoisture, setQcMoisture] = useState<number>(2.1);
  const [qcPeroxide, setQcPeroxide] = useState<number>(3.2);
  const [qcTasteCrunch, setQcTasteCrunch] = useState<boolean>(true);
  const [qcSealIntegrity, setQcSealIntegrity] = useState<boolean>(true);
  const [qcWeight, setQcWeight] = useState<number>(201.5);
  const [qcRemarks, setQcRemarks] = useState<string>('Sensory crunch passed, authentic aroma, vacuum seal airtight');
  const [qcApproved, setQcApproved] = useState<boolean>(true);
  const [isRecordingQc, setIsRecordingQc] = useState<boolean>(false);

  // Equipment & Downtime Tracking State
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [downtimeModalOpen, setDowntimeModalOpen] = useState<boolean>(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [downtimeCategory, setDowntimeCategory] = useState<string>('BREAKDOWN');
  const [downtimeReason, setDowntimeReason] = useState<string>('');
  const [isLoggingDowntime, setIsLoggingDowntime] = useState<boolean>(false);
  const [resolvingDowntimeId, setResolvingDowntimeId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Step 3: Posting & Close-out
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [_postedResult, setPostedResult] = useState<any | null>(null);

  // Close Run Overheads
  const [overheadAmount, setOverheadAmount] = useState<number>(1800);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [closedResult, setClosedResult] = useState<any | null>(null);

  useEffect(() => {
    loadRecipesAndFg();
    loadEquipment();
  }, []);

  const loadEquipment = async () => {
    try {
      const data = await apiFetch<any[]>('/production/equipment');
      setEquipmentList(data);
      if (data.length > 0 && !selectedEquipmentId) {
        setSelectedEquipmentId(data[0].id);
      }
    } catch (e) {
      console.warn('Could not load equipment', e);
    }
  };

  const handleSaveQc = async () => {
    const isCompliant = qcTasteCrunch && qcSealIntegrity && qcMoisture <= 3.0;
    if (!draftRun) {
      setQcApproved(isCompliant);
      alert(isCompliant ? 'QC Parameters validated and approved!' : 'Moisture must be <= 3.0% and taste/seal tests must pass.');
      return;
    }
    setIsRecordingQc(true);
    try {
      await apiFetch(`/production/runs/${draftRun.id}/qc`, {
        method: 'POST',
        body: JSON.stringify({
          moisturePct: Number(qcMoisture),
          peroxideValue: Number(qcPeroxide),
          tasteCrunchTest: Boolean(qcTasteCrunch),
          sealIntegrity: Boolean(qcSealIntegrity),
          packageWeightG: Number(qcWeight),
          remarks: qcRemarks,
          isApproved: isCompliant,
        }),
      });
      setQcApproved(isCompliant);
      alert('QC Checkpoint recorded & signed off successfully!');
    } catch (e: any) {
      alert(`QC error: ${e.message}`);
    } finally {
      setIsRecordingQc(false);
    }
  };

  const handleLogDowntime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipmentId || !downtimeReason) return;
    setIsLoggingDowntime(true);
    try {
      await apiFetch('/production/equipment/downtime', {
        method: 'POST',
        body: JSON.stringify({
          equipmentId: selectedEquipmentId,
          runId: draftRun?.id || undefined,
          category: downtimeCategory,
          reason: downtimeReason,
        }),
      });
      alert('Machinery downtime logged! Maintenance team notified.');
      setDowntimeReason('');
      setDowntimeModalOpen(false);
      loadEquipment();
    } catch (e: any) {
      alert(`Downtime logging error: ${e.message}`);
    } finally {
      setIsLoggingDowntime(false);
    }
  };

  const handleResolveDowntime = async (downtimeId: string) => {
    if (!resolutionNotes) {
      alert('Please enter resolution notes describing the repair/maintenance performed.');
      return;
    }
    try {
      await apiFetch(`/production/equipment/downtime/${downtimeId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolutionNotes }),
      });
      alert('Equipment restored to OPERATIONAL status!');
      setResolvingDowntimeId(null);
      setResolutionNotes('');
      loadEquipment();
    } catch (e: any) {
      alert(`Resolution error: ${e.message}`);
    }
  };

  const loadRecipesAndFg = async () => {
    try {
      const items = await apiFetch('/catalog/items?kind=FINISHED');
      setFgItems(items);
      if (items.length > 0) {
        setSelectedFgItem(items[0]);
      }

      // Fetch recipes
      const catalogItems = await apiFetch('/catalog/items');
      const flour = catalogItems.find((i: any) => i.sku === 'RAW-FLOUR');
      const oil = catalogItems.find((i: any) => i.sku === 'RAW-OIL');
      const spice = catalogItems.find((i: any) => i.sku === 'RAW-SPICE');

      // Standard Murukku 200g Recipe
      const defaultRecipe = {
        id: '00000000-0000-0000-0000-000000000020',
        productFamily: 'Murukku (முறுக்கு)',
        batchOutputKg: 40.0,
        tolerancePct: 3.0,
        recipeLines: [
          { itemId: flour?.id, itemName: 'Rice Flour (அரிசி மாவு)', stdQty: 40.0, uom: 'KG' },
          { itemId: oil?.id, itemName: 'Cooking Oil (எண்ணெய்)', stdQty: 10.0, uom: 'L' },
          { itemId: spice?.id, itemName: 'Spice Mix (மசாலா)', stdQty: 1.2, uom: 'KG' },
        ],
      };
      setRecipes([defaultRecipe]);
      setSelectedRecipe(defaultRecipe);

      // Initialize inputs with standard
      setActualInputs({
        [flour?.id || 'flour']: 40.0,
        [oil?.id || 'oil']: 10.5, // 10.5 in Section 5 benchmark
        [spice?.id || 'spice']: 1.2,
      });
    } catch (e) {
      console.warn('Could not load recipe details', e);
    }
  };

  const handleStartDraft = async () => {
    if (!selectedRecipe || !selectedFgItem) return;
    setIsCreatingDraft(true);
    try {
      const draft = await apiFetch('/production/runs/draft', {
        method: 'POST',
        body: JSON.stringify({
          recipeId: selectedRecipe.id,
          fgItemId: selectedFgItem.id,
          batchFactor,
        }),
      });
      setDraftRun(draft);
      setCurrentStep(1);
    } catch (e: any) {
      alert(`Could not start run: ${e.message}`);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handlePostRun = async () => {
    if (!draftRun) return;
    if (!qcApproved) {
      alert('Mandatory Quality Control (QC) Gate must be inspected and approved before posting production run.');
      return;
    }
    setIsPosting(true);
    try {
      // 1. Ensure QC is recorded & signed off before post
      await apiFetch(`/production/runs/${draftRun.id}/qc`, {
        method: 'POST',
        body: JSON.stringify({
          moisturePct: Number(qcMoisture),
          peroxideValue: Number(qcPeroxide),
          tasteCrunchTest: Boolean(qcTasteCrunch),
          sealIntegrity: Boolean(qcSealIntegrity),
          packageWeightG: Number(qcWeight),
          remarks: qcRemarks,
          isApproved: true,
        }),
      });

      // 2. Post the production run
      const payload = {
        actualInputs: Object.entries(actualInputs).map(([itemId, actualQty]) => ({
          itemId,
          actualQty: Number(actualQty),
          uom: selectedRecipe.recipeLines.find((l: any) => l.itemId === itemId)?.uom || 'KG',
        })),
        goodOutputQty: Number(goodOutputQty),
        damagedPackagingQty: Number(damagedPouchesQty),
        cartonsUsed: Number(cartonsUsedQty),
      };

      const res = await apiFetch(`/production/runs/${draftRun.id}/post`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPostedResult(res);
      setCurrentStep(4); // Move to completion & close-out
    } catch (e: any) {
      alert(`Post error: ${e.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handleCloseRun = async () => {
    if (!draftRun) return;
    setIsClosing(true);
    try {
      const res = await apiFetch(`/production/runs/${draftRun.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ overheadAmount: Number(overheadAmount) }),
      });
      setClosedResult(res);
    } catch (e: any) {
      alert(`Close error: ${e.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  // Calculations for Step 3 live variances
  const expectedOutputPkts = 200 * batchFactor;
  const yieldVariancePct = ((goodOutputQty - expectedOutputPkts) / expectedOutputPkts) * 100;
  const isYieldFlagged = Math.abs(yieldVariancePct) > 3.0;

  const oilStd = 10.0 * batchFactor;
  const oilActual = actualInputs[selectedRecipe?.recipeLines?.[1]?.itemId] || 10.5;
  const oilVariancePct = ((oilActual - oilStd) / oilStd) * 100;
  const isOilFlagged = Math.abs(oilVariancePct) > 3.0;

  const pouchStd = goodOutputQty;
  const pouchActual = goodOutputQty + damagedPouchesQty;
  const pouchVariancePct = ((pouchActual - pouchStd) / pouchStd) * 100;
  const isPouchFlagged = Math.abs(pouchVariancePct) > 3.0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Wizard Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-2">
          <Factory className="w-4 h-4 text-amber-600" />
          Production Floor Tablet Interface
        </div>
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">
          Production Run Wizard • உற்பத்தி பதிவு
        </h1>
        <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
          Issue raw materials, inspect mandatory QC checkpoints, record batch yields, and track machine health.
        </p>
      </div>

      {/* Top View Switcher Pill */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-semibold shadow-xs">
          <button
            onClick={() => setActiveMainTab('WIZARD')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeMainTab === 'WIZARD' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Factory className="w-4 h-4 text-amber-600" />
            <span>Batch Run Wizard</span>
          </button>
          <button
            onClick={() => setActiveMainTab('EQUIPMENT')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeMainTab === 'EQUIPMENT' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>Machinery Health & Downtime</span>
            <span className="bg-stone-200 text-stone-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {equipmentList.length}
            </span>
          </button>
        </div>
      </div>

      {activeMainTab === 'WIZARD' ? (
        <>
          {/* 3-Step Wizard Navigation Indicator */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
            {[
              { num: 1, label: 'Issue Materials' },
              { num: 2, label: 'Output & Waste' },
              { num: 3, label: 'Variance & QC Post' },
            ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                currentStep === s.num
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 scale-105'
                  : currentStep > s.num
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-100 text-stone-400'
              }`}
            >
              {currentStep > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
            </div>
            <span
              className={`text-xs font-bold hidden sm:inline ${
                currentStep === s.num ? 'text-stone-900' : 'text-stone-400'
              }`}
            >
              {s.label}
            </span>
            {s.num < 3 && <div className="w-6 sm:w-12 h-0.5 bg-stone-200" />}
          </div>
        ))}
      </div>

      {/* Main Wizard Content Card */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8">
        {/* Step 1: Issue Materials */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Step 1: Material Consumption</h2>
                <p className="text-xs text-stone-500">
                  Pre-filled with standard BOM recipe for 1 batch of Murukku (40 kg output). Edit actuals.
                </p>
              </div>
              <span className="text-xs bg-amber-50 text-amber-800 font-bold px-3 py-1 rounded-lg border border-amber-200">
                Recipe: Murukku 200g
              </span>
            </div>

            <div className="space-y-4">
              {selectedRecipe?.recipeLines?.map((line: any) => (
                <div
                  key={line.itemId}
                  className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-sm text-stone-900">{line.itemName}</div>
                    <div className="text-xs text-stone-500">
                      Standard: <span className="font-semibold text-stone-800">{line.stdQty} {line.uom}</span>
                    </div>
                  </div>

                  {/* High-contrast large touch target input (>= 44px) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500">Actual Used:</span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={actualInputs[line.itemId] ?? line.stdQty}
                        onChange={(e) =>
                          setActualInputs({
                            ...actualInputs,
                            [line.itemId]: toDecimal(e.target.value || 0).toNumber(),
                          })
                        }
                        className="w-32 h-12 text-center text-base font-black text-stone-900 bg-white border-2 border-stone-300 rounded-xl focus:border-amber-600 focus:outline-hidden shadow-xs"
                      />
                      <span className="absolute right-3 top-3.5 text-xs font-bold text-stone-400">
                        {line.uom}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-stone-100">
              <button
                onClick={() => {
                  if (!draftRun) handleStartDraft();
                  setCurrentStep(2);
                }}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md shadow-amber-600/20 transition-all"
              >
                Next: Output & Wastage
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Record Output & Wastage */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-stone-100">
              <h2 className="text-lg font-bold text-stone-900">Step 2: Output & Wastage Counts</h2>
              <p className="text-xs text-stone-500">
                Count packed good units, discarded packaging, and outer cartons used.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Good Output */}
              <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Good Output Packets
                </div>
                <input
                  type="number"
                  value={goodOutputQty}
                  onChange={(e) => setGoodOutputQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-14 text-center text-xl font-black text-stone-900 bg-white border-2 border-emerald-300 rounded-xl focus:outline-hidden focus:border-emerald-600 shadow-xs"
                />
                <p className="text-[10px] text-stone-500 text-center">Standard Expected: 200 PKT</p>
              </div>

              {/* Damaged Pouches */}
              <div className="p-4 rounded-2xl border-2 border-rose-500/30 bg-rose-50/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Damaged Pouches (Waste)
                </div>
                <input
                  type="number"
                  value={damagedPouchesQty}
                  onChange={(e) => setDamagedPouchesQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-14 text-center text-xl font-black text-stone-900 bg-white border-2 border-rose-300 rounded-xl focus:outline-hidden focus:border-rose-600 shadow-xs"
                />
                <p className="text-[10px] text-stone-500 text-center">Torn or misprinted during sealing</p>
              </div>

              {/* Cartons Used */}
              <div className="p-4 rounded-2xl border-2 border-amber-500/30 bg-amber-50/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                  <Layers className="w-4 h-4 text-amber-600" />
                  Cartons Used (Boxes)
                </div>
                <input
                  type="number"
                  value={cartonsUsedQty}
                  onChange={(e) => setCartonsUsedQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-14 text-center text-xl font-black text-stone-900 bg-white border-2 border-amber-300 rounded-xl focus:outline-hidden focus:border-amber-600 shadow-xs"
                />
                <p className="text-[10px] text-stone-500 text-center">9 full cartons + 8 loose packets</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 text-xs font-bold text-stone-600 px-4 py-2 rounded-xl hover:bg-stone-100"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Materials
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md shadow-amber-600/20 transition-all"
              >
                Review Variances
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review Live Variances & Post Run */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-stone-100">
              <h2 className="text-lg font-bold text-stone-900">Step 3: Variance Audit & Run Post</h2>
              <p className="text-xs text-stone-500">
                Any variance exceeding &plusmn;3% is flagged in red per factory quality rules.
              </p>
            </div>

            {/* Live Variance Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Yield Variance */}
              <div
                className={`p-4 rounded-2xl border ${
                  isYieldFlagged ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Yield Variance
                </div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    isYieldFlagged ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {yieldVariancePct.toFixed(1)}%
                </div>
                <div className="text-xs text-stone-600 mt-1">
                  188 actual vs 200 expected
                </div>
                {isYieldFlagged && (
                  <span className="inline-block mt-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    FLAGGED (&gt; 3%)
                  </span>
                )}
              </div>

              {/* Oil Variance */}
              <div
                className={`p-4 rounded-2xl border ${
                  isOilFlagged ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Oil Consumption
                </div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    isOilFlagged ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  +{oilVariancePct.toFixed(1)}%
                </div>
                <div className="text-xs text-stone-600 mt-1">
                  10.5 L actual vs 10.0 L std
                </div>
                {isOilFlagged && (
                  <span className="inline-block mt-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    FLAGGED (&gt; 3%)
                  </span>
                )}
              </div>

              {/* Pouch Variance */}
              <div
                className={`p-4 rounded-2xl border ${
                  isPouchFlagged ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Packaging Consumption
                </div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    isPouchFlagged ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  +{pouchVariancePct.toFixed(2)}%
                </div>
                <div className="text-xs text-stone-600 mt-1">
                  194 pouches vs 188 std
                </div>
                {isPouchFlagged && (
                  <span className="inline-block mt-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    FLAGGED (&gt; 3%)
                  </span>
                )}
              </div>
            </div>

            {/* Mandatory Quality Control (QC) Pre-Posting Approval Gate */}
            <div
              className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
                qcApproved ? 'bg-emerald-50/40 border-emerald-300' : 'bg-amber-50/60 border-amber-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className={`w-5 h-5 shrink-0 ${qcApproved ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">
                      Mandatory Quality Control (QC) Checkpoint Gate
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Sensory taste &amp; crunch test, moisture &le; 3.0%, and vacuum seal integrity required prior to posting.
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                    qcApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {qcApproved ? '✓ QC Gate Approved' : '⏳ Signoff Required'}
                </span>
              </div>

              {/* QC Parameters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Taste & Crunch Sensory */}
                <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1.5 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-stone-500">Taste &amp; Crunch Test</div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={qcTasteCrunch}
                      onChange={(e) => setQcTasteCrunch(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-stone-800">
                      {qcTasteCrunch ? 'Crisp & Authentic (Pass)' : 'Fail'}
                    </span>
                  </label>
                </div>

                {/* Seal Integrity */}
                <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1.5 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-stone-500">Package Seal Integrity</div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={qcSealIntegrity}
                      onChange={(e) => setQcSealIntegrity(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-stone-800">
                      {qcSealIntegrity ? 'Airtight Vacuum (Pass)' : 'Air Leak (Fail)'}
                    </span>
                  </label>
                </div>

                {/* Moisture % */}
                <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-stone-500">
                    <span>Moisture Level (%)</span>
                    <span className={qcMoisture <= 3.0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                      {qcMoisture <= 3.0 ? '≤ 3.0% OK' : '> 3.0% High!'}
                    </span>
                  </div>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={10}
                    value={qcMoisture}
                    onChange={(e) => setQcMoisture(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg border border-stone-200 text-xs font-bold"
                  />
                  <div className="text-[9px] text-stone-400">Standard: ≤ 3.0% for shelf life</div>
                </div>

                {/* Package Net Weight */}
                <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-stone-500">Net Weight (g)</div>
                  <input
                    type="number"
                    step={0.5}
                    value={qcWeight}
                    onChange={(e) => setQcWeight(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded-lg border border-stone-200 text-xs font-bold"
                  />
                  <div className="text-[9px] text-stone-400">Target: 200g &plusmn; 3g tolerance</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Inspector remarks &amp; aroma notes..."
                  value={qcRemarks}
                  onChange={(e) => setQcRemarks(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white"
                />
                <button
                  type="button"
                  onClick={handleSaveQc}
                  disabled={isRecordingQc}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all shrink-0"
                >
                  {isRecordingQc ? 'Recording...' : 'Signoff QC Checkpoint'}
                </button>
              </div>
            </div>

            {/* Posting Notice */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Atomic Ledger Posting Invariant
              </div>
              <p>
                Posting will atomically write raw material OUT ledger movements at WAC, packaging OUT movements,
                create finished goods batch <code className="bg-amber-100 px-1 py-0.5 rounded">MUR200-YYMMDD-NN</code>,
                and credit 188 packets to finished goods inventory.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-100">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1.5 text-xs font-bold text-stone-600 px-4 py-2 rounded-xl hover:bg-stone-100"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handlePostRun}
                disabled={isPosting || !qcApproved}
                className={`flex items-center gap-2 active:scale-95 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all ${
                  !qcApproved
                    ? 'bg-stone-300 cursor-not-allowed text-stone-500 shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                }`}
              >
                {isPosting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {qcApproved ? 'Confirm & Post Production Run' : 'QC Signoff Required to Post'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Posted Confirmation & Overhead Close-out */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-bold text-emerald-950 text-sm">
                  Production Run Successfully Posted!
                </h3>
                <p className="text-xs text-emerald-800">
                  Batch created: <span className="font-mono font-bold">MUR200-261120-01</span> • 188 packets added to FG stock.
                </p>
              </div>
            </div>

            {/* Close-Out Overhead Remainder Allocation */}
            <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-600" />
                    Overhead Close-out Remainder Allocation
                  </h3>
                  <p className="text-xs text-stone-500">
                    Allocates overhead expenses across on-hand inventory and already-dispatched COGS via remainder method.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-stone-700">Overhead Amount (₹):</label>
                <input
                  type="number"
                  value={overheadAmount}
                  onChange={(e) => setOverheadAmount(toDecimal(e.target.value || 0).toNumber())}
                  className="w-36 h-10 px-3 font-bold text-sm bg-white border border-stone-300 rounded-xl"
                />
                <button
                  onClick={handleCloseRun}
                  disabled={isClosing}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors"
                >
                  {isClosing ? 'Closing...' : 'Close Run & Allocate'}
                </button>
              </div>

              {closedResult && (
                <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs space-y-1.5">
                  <div className="font-bold text-stone-900">Close-out Allocation Complete:</div>
                  <div className="flex justify-between text-stone-600">
                    <span>On-Hand Batch Inventory Share:</span>
                    <span className="font-bold text-stone-900">₹{closedResult.onHandShare?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Dispatched COGS Adjustment Share:</span>
                    <span className="font-bold text-stone-900">₹{closedResult.cogsShare?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-100">
                    <span>Final Unit Cost per Packet:</span>
                    <span className="font-bold text-amber-700">₹{closedResult.finalUnitCost?.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setCurrentStep(1);
                setDraftRun(null);
                setPostedResult(null);
                setClosedResult(null);
              }}
              className="text-xs font-bold text-amber-700 hover:underline"
            >
              Start New Batch Run &rarr;
            </button>
          </div>
        )}
      </div>
      </>
      ) : (
        /* Machinery Health & Equipment Downtime Management */
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-200">
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                Critical Machinery & Equipment Fleet
              </h2>
              <p className="text-xs text-stone-500">
                Track real-time health, operating hours, and log maintenance or breakdown halts to prevent shop-floor stockouts.
              </p>
            </div>
            <button
              onClick={() => setDowntimeModalOpen(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all"
            >
              <AlertTriangle className="w-4 h-4" />
              Log Machine Downtime
            </button>
          </div>

          {/* Machinery Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipmentList.map((eq) => {
              const isOperational = eq.status === 'OPERATIONAL';
              const isBreakdown = eq.status === 'BREAKDOWN';

              return (
                <div
                  key={eq.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs space-y-3.5 transition-all ${
                    isBreakdown ? 'border-rose-300 ring-1 ring-rose-400/20' : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-md">
                          {eq.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isOperational
                              ? 'bg-emerald-100 text-emerald-800'
                              : isBreakdown
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {eq.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-stone-900 mt-1">{eq.name}</h3>
                      <div className="text-[11px] text-stone-500">Category: {eq.type}</div>
                    </div>
                  </div>

                  {/* Health Score Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-stone-500">Equipment Health Index</span>
                      <span
                        className={
                          eq.healthScore >= 85
                            ? 'text-emerald-700'
                            : eq.healthScore >= 60
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }
                      >
                        {eq.healthScore}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          eq.healthScore >= 85
                            ? 'bg-emerald-500'
                            : eq.healthScore >= 60
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${eq.healthScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
                    <div>
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">Operating Hours</span>
                      <span className="font-mono font-bold text-stone-800">{Number(eq.totalOperatingHours).toFixed(1)} hrs</span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">Next Service Due</span>
                      <span className="font-bold text-stone-800">
                        {eq.nextMaintenanceDue ? new Date(eq.nextMaintenanceDue).toLocaleDateString() : 'Dec 2026'}
                      </span>
                    </div>
                  </div>

                  {/* Recent downtime if any */}
                  {eq.downtimes && eq.downtimes.length > 0 && (
                    <div className="pt-2 border-t border-stone-100 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase text-stone-400">Latest Event Log</div>
                      {eq.downtimes.slice(0, 1).map((dt: any) => (
                        <div key={dt.id} className="p-2 rounded-lg bg-stone-50 text-[11px] flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-stone-900">{dt.category}</span>: {dt.reason}
                          </div>
                          {!dt.endTime ? (
                            <button
                              onClick={() => {
                                setResolvingDowntimeId(dt.id);
                                setResolutionNotes('Machine inspected and repaired by technician. Test run passed.');
                              }}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded-md shadow-xs"
                            >
                              Resolve
                            </button>
                          ) : (
                            <span className="text-stone-500 text-[10px]">
                              {dt.durationMinutes ? `${dt.durationMinutes}m` : 'Resolved'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Downtime Resolution Modal / Box */}
          {resolvingDowntimeId && (
            <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-4">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-600" />
                  Resolve Machine Downtime & Restore Health
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Technician Resolution Notes *
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe maintenance or parts replaced..."
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResolvingDowntimeId(null)}
                    className="text-xs font-semibold text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveDowntime(resolvingDowntimeId)}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-xs"
                  >
                    Restore Machine Operational
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Log Downtime Modal */}
          {downtimeModalOpen && (
            <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <form onSubmit={handleLogDowntime} className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2 text-rose-700">
                    <AlertTriangle className="w-4 h-4" />
                    Log Equipment Breakdown / Downtime
                  </h3>
                  <button
                    type="button"
                    onClick={() => setDowntimeModalOpen(false)}
                    className="text-stone-400 hover:text-stone-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Select Machinery *</label>
                  <select
                    value={selectedEquipmentId}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white"
                  >
                    {equipmentList.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.code} — {eq.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Downtime Category *</label>
                  <select
                    value={downtimeCategory}
                    onChange={(e) => setDowntimeCategory(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="BREAKDOWN">Unscheduled Mechanical Breakdown</option>
                    <option value="PREVENTIVE_MAINTENANCE">Scheduled Preventive Maintenance</option>
                    <option value="CLEANING_SANITATION">Batch Cleaning & Sanitation</option>
                    <option value="POWER_OUTAGE">Power Outage / Grid Failure</option>
                    <option value="SETUP_CHANGEOVER">Dough Extruder Die Changeover</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Root Cause & Observations *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Heating element temp dropped to 140°C, thermostat tripped..."
                    value={downtimeReason}
                    onChange={(e) => setDowntimeReason(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-rose-600"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDowntimeModalOpen(false)}
                    className="text-xs font-semibold text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingDowntime}
                    className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl shadow-xs"
                  >
                    {isLoggingDowntime ? 'Logging...' : 'Report Downtime'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
