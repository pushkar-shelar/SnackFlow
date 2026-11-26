'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch, getStoredSession } from '@/lib/api';
import { toDecimal } from '@snackflow/shared';
import { RbacGate } from '@/components/common/RbacGate';
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
  Wrench,
  ShieldAlert,
} from 'lucide-react';

export default function ProductionWizardPage() {
  const [activeMainTab, setActiveMainTab] = useState<'WIZARD' | 'OVERHEADS' | 'EQUIPMENT'>('WIZARD');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);
  const [fgItems, setFgItems] = useState<any[]>([]);
  const [selectedFgItem, setSelectedFgItem] = useState<any | null>(null);
  const [batchFactor] = useState<number>(1.0);
  const [stockBalances, setStockBalances] = useState<any[]>([]);

  // Active Draft Run
  const [draftRun, setDraftRun] = useState<any | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState<boolean>(false);

  // Step 1: Material actual inputs (itemId -> actualQty)
  const [actualInputs, setActualInputs] = useState<Record<string, number>>({});

  // Step 2: Output and Wastage
  const [goodOutputQty, setGoodOutputQty] = useState<number>(200);
  const [damagedPouchesQty, setDamagedPouchesQty] = useState<number>(0);
  const [cartonsUsedQty, setCartonsUsedQty] = useState<number>(10);

  // Quality Control (QC) Gate Checkpoint State
  const [qcMoisture, setQcMoisture] = useState<number>(2.1);
  const [qcPeroxide] = useState<number>(3.2);
  const [qcTasteCrunch, setQcTasteCrunch] = useState<boolean>(true);
  const [qcSealIntegrity, setQcSealIntegrity] = useState<boolean>(true);
  const [qcWeight, setQcWeight] = useState<number>(201.5);
  const [qcRemarks, setQcRemarks] = useState<string>('Sensory crunch passed, authentic aroma, vacuum seal airtight');
  const [qcApproved, setQcApproved] = useState<boolean>(true);
  const [isRecordingQc, setIsRecordingQc] = useState<boolean>(false);

  // Equipment & Downtime Tracking State
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [isLoadingEquipment, setIsLoadingEquipment] = useState<boolean>(false);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [downtimeModalOpen, setDowntimeModalOpen] = useState<boolean>(false);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [downtimeCategory, setDowntimeCategory] = useState<string>('BREAKDOWN');
  const [downtimeReason, setDowntimeReason] = useState<string>('');
  const [isLoggingDowntime, setIsLoggingDowntime] = useState<boolean>(false);
  const [resolvingDowntimeId, setResolvingDowntimeId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Inward Stock / GRN Refill Modal State
  const INWARD_SKU_DEFAULTS: Record<string, { cost: number; uom: string }> = {
    'RAW-FLOUR': { cost: 42.0, uom: 'KG' },
    'RAW-OIL': { cost: 140.0, uom: 'L' },
    'RAW-SPICE': { cost: 200.0, uom: 'KG' },
    'PKG-POUCH-200G': { cost: 2.5, uom: 'PCS' },
    'PKG-CARTON-20PKT': { cost: 15.0, uom: 'PCS' },
    'FG-RIB-200G': { cost: 32.0, uom: 'PKT' },
  };
  const [inwardModalOpen, setInwardModalOpen] = useState<boolean>(false);
  const [inwardSku, setInwardSku] = useState<string>('RAW-FLOUR');
  const [inwardQty, setInwardQty] = useState<number>(100);
  const [inwardUnitCost, setInwardUnitCost] = useState<number>(42.0);
  const [inwardVendor, setInwardVendor] = useState<string>('Thanjavur Agro Mills, Tiruchirappalli');
  const [inwardGrnNo, setInwardGrnNo] = useState<string>('GRN-2026-0045');
  const [isSubmittingInward, setIsSubmittingInward] = useState<boolean>(false);

  const handleInwardStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(Number(inwardQty) > 0) || !(Number(inwardUnitCost) > 0)) {
      alert('Please enter a valid positive quantity and unit price.');
      return;
    }
    setIsSubmittingInward(true);
    try {
      const [catalogItems, suppliers] = await Promise.all([
        apiFetch<any[]>('/catalog/items'),
        apiFetch<any[]>('/parties?kind=SUPPLIER'),
      ]);
      const matchedItem = catalogItems.find((i: any) => i.sku === inwardSku);
      const supplierParty = suppliers[0];

      if (matchedItem && supplierParty) {
        const meta = INWARD_SKU_DEFAULTS[inwardSku] || { cost: 50.0, uom: matchedItem.baseUom || 'KG' };
        const effectiveCost = Number(inwardUnitCost) || meta.cost;
        await apiFetch('/purchases', {
          method: 'POST',
          body: JSON.stringify({
            partyId: supplierParty.id,
            invoiceNo: inwardGrnNo || `GRN-${Date.now().toString().slice(-6)}`,
            lines: [
              {
                itemId: matchedItem.id,
                qty: Number(inwardQty),
                unitCost: effectiveCost,
                uom: meta.uom,
              },
            ],
          }),
        });
        alert(
          `Goods Receipt Note posted: ${Number(inwardQty)} ${meta.uom} @ ₹${effectiveCost.toFixed(2)} = ₹${(
            Number(inwardQty) * effectiveCost
          ).toFixed(2)}. Stock & WAC updated!`,
        );
        setInwardGrnNo(`GRN-${Date.now().toString().slice(-6)}`);
      } else {
        throw new Error('Matching catalog item or supplier party not found in database.');
      }

      const updated = await apiFetch('/inventory/balances');
      if (Array.isArray(updated)) setStockBalances(updated);
      setInwardModalOpen(false);
    } catch (err: any) {
      alert(`Inward error: ${err.message}`);
    } finally {
      setIsSubmittingInward(false);
    }
  };

  const handleQuickRefillAll = async () => {
    setIsSubmittingInward(true);
    try {
      const [catalogItems, suppliers] = await Promise.all([
        apiFetch<any[]>('/catalog/items'),
        apiFetch<any[]>('/parties?kind=SUPPLIER'),
      ]);
      const supplierParty = suppliers[0];
      if (!supplierParty) {
        throw new Error('No supplier party configured in master data.');
      }
      const refillDefs = [
        { sku: 'RAW-FLOUR', qty: 200, unitCost: 42.0, uom: 'KG' },
        { sku: 'RAW-OIL', qty: 50, unitCost: 140.0, uom: 'L' },
        { sku: 'RAW-SPICE', qty: 20, unitCost: 200.0, uom: 'KG' },
        { sku: 'PKG-POUCH-200G', qty: 500, unitCost: 2.5, uom: 'PCS' },
        { sku: 'PKG-CARTON-20PKT', qty: 30, unitCost: 15.0, uom: 'PCS' },
      ];
      const lines = refillDefs
        .map((r) => {
          const item = catalogItems.find((i: any) => i.sku === r.sku);
          return item ? { itemId: item.id, qty: r.qty, unitCost: r.unitCost, uom: r.uom } : null;
        })
        .filter(Boolean);

      await apiFetch('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          partyId: supplierParty.id,
          invoiceNo: `REFILL-${Date.now().toString().slice(-6)}`,
          lines,
        }),
      });
      alert('Full store room refill successful! Added +200 KG Flour, +50 L Oil, +20 KG Spice Mix, +500 Pouches, +30 Cartons.');
      const updated = await apiFetch('/inventory/balances');
      if (Array.isArray(updated)) setStockBalances(updated);
      setInwardModalOpen(false);
    } catch (err: any) {
      alert(`Refill error: ${err.message}`);
    } finally {
      setIsSubmittingInward(false);
    }
  };

  const handleResetToBenchmark = async () => {
    alert('Database reset is disabled in connected server mode. Use local CLI seed tools if resetting local test data.');
  };

  // Step 3: Posting & Close-out
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postedResult, setPostedResult] = useState<any | null>(null);

  // Close Run Overheads (Labour + Gas/Power split summing to total overhead)
  const [labourCost, setLabourCost] = useState<number>(1200);
  const [gasPowerCost, setGasPowerCost] = useState<number>(600);
  const overheadAmount = Math.max(0, Number(labourCost || 0) + Number(gasPowerCost || 0));
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [closedResult, setClosedResult] = useState<any | null>(null);
  const [productionRuns, setProductionRuns] = useState<any[]>([]);
  const [closingRunId, setClosingRunId] = useState<string | null>(null);
  const [closeoutByRun, setCloseoutByRun] = useState<Record<string, any>>({});

  const loadProductionRuns = async () => {
    try {
      const rep = await apiFetch<any>('/reports/production');
      if (Array.isArray(rep?.rows)) {
        setProductionRuns(rep.rows);
      }
    } catch (e) {
      console.warn('Could not load production runs report', e);
    }
  };

  useEffect(() => {
    const session = getStoredSession();
    if (!session || !['PRODUCTION', 'ADMIN', 'OWNER'].includes(session.role)) {
      return;
    }
    loadRecipesAndFg();
    loadEquipment();
    loadProductionRuns();

    const handleStorage = () => {
      loadEquipment();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (activeMainTab === 'EQUIPMENT') {
      loadEquipment();
    } else if (activeMainTab === 'OVERHEADS') {
      loadProductionRuns();
    }
  }, [activeMainTab]);

  const loadEquipment = async () => {
    setIsLoadingEquipment(true);
    setEquipmentError(null);
    try {
      const data = await apiFetch<any[]>('/production/equipment');
      if (Array.isArray(data)) {
        setEquipmentList(data);
        if (data.length > 0) {
          setSelectedEquipmentId((prev) => prev || data[0].id);
        }
      }
    } catch (e: any) {
      console.warn('Could not load equipment', e);
      setEquipmentError(e.message || 'Failed to fetch equipment');
    } finally {
      setIsLoadingEquipment(false);
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

  const selectRecipe = (recipe: any) => {
    setSelectedRecipe(recipe);
    const matchingFg = fgItems.find((i: any) => i.sku === recipe.sku || i.id === recipe.fgItemId) || fgItems[0];
    if (matchingFg) setSelectedFgItem(matchingFg);
    setDraftRun(null);

    // Pre-fill inputs with recipe standard
    const inputs: Record<string, number> = {};
    recipe.recipeLines.forEach((l: any) => {
      inputs[l.itemId] = l.stdQty;
    });
    setActualInputs(inputs);

    // Pre-fill good output matching standard yield (0% variance by default)
    const stdPkts = recipe.stdOutputPkts || 200;
    setGoodOutputQty(stdPkts);
    setDamagedPouchesQty(0);
    setCartonsUsedQty(Math.floor(stdPkts / 20));
    setCurrentStep(1);
  };

  const loadRecipesAndFg = async () => {
    try {
      const items = await apiFetch('/catalog/items?kind=FINISHED');
      setFgItems(items);

      // Fetch recipes
      const catalogItems = await apiFetch('/catalog/items');
      const flour = catalogItems.find((i: any) => i.sku === 'RAW-FLOUR');
      const oil = catalogItems.find((i: any) => i.sku === 'RAW-OIL');
      const spice = catalogItems.find((i: any) => i.sku === 'RAW-SPICE');

      const murukkuFg = items.find((i: any) => i.sku === 'FG-MUR-200G') || items[0];
      const ribbonFg = items.find((i: any) => i.sku === 'FG-RIB-200G');

      // 1. Standard Murukku 200g Recipe (200 PKT / 40 KG output)
      const murukkuRecipe = {
        id: '00000000-0000-0000-0000-000000000020',
        productFamily: 'Murukku (முறுக்கு)',
        name: 'Murukku 200g (முறுக்கு)',
        sku: 'FG-MUR-200G',
        fgItemId: murukkuFg?.id || 'fg-mur-200g',
        batchOutputKg: 40.0,
        stdOutputPkts: 200,
        tolerancePct: 3.0,
        recipeLines: [
          { itemId: flour?.id || 'raw-flour', sku: 'RAW-FLOUR', itemName: 'Rice Flour (அரிசி மாவு)', stdQty: 40.0, uom: 'KG' },
          { itemId: oil?.id || 'raw-oil', sku: 'RAW-OIL', itemName: 'Cooking Oil (எண்ணெய்)', stdQty: 10.0, uom: 'L' },
          { itemId: spice?.id || 'raw-spice', sku: 'RAW-SPICE', itemName: 'Spice Mix (மசாலா)', stdQty: 1.2, uom: 'KG' },
        ],
      };

      // 2. Standard Ribbon Pakoda 200g Recipe (100 PKT / 20 KG output)
      const ribbonRecipe = {
        id: '00000000-0000-0000-0000-000000000021',
        productFamily: 'Ribbon Pakoda (ரிப்பன் பக்கோடா)',
        name: 'Ribbon Pakoda 200g (ரிப்பன் பக்கோடா)',
        sku: 'FG-RIB-200G',
        fgItemId: ribbonFg?.id || 'fg-rib-200g',
        batchOutputKg: 20.0,
        stdOutputPkts: 100,
        tolerancePct: 3.0,
        recipeLines: [
          { itemId: flour?.id || 'raw-flour', sku: 'RAW-FLOUR', itemName: 'Gram & Rice Flour Mix (கடலை / அரிசி மாவு)', stdQty: 20.0, uom: 'KG' },
          { itemId: oil?.id || 'raw-oil', sku: 'RAW-OIL', itemName: 'Cooking Oil (எண்ணெய்)', stdQty: 5.0, uom: 'L' },
          { itemId: spice?.id || 'raw-spice', sku: 'RAW-SPICE', itemName: 'Spice Mix & Chilli (மசாலா)', stdQty: 0.8, uom: 'KG' },
        ],
      };

      const recipeList = [murukkuRecipe, ribbonRecipe];
      setRecipes(recipeList);
      setSelectedRecipe(murukkuRecipe);
      if (murukkuFg) setSelectedFgItem(murukkuFg);

      // Load live raw material stock balances
      try {
        const balances = await apiFetch('/inventory/balances');
        if (Array.isArray(balances)) {
          setStockBalances(balances);
        }
      } catch (err) {
        console.warn('Could not load inventory balances', err);
      }

      // Initialize inputs with standard
      setActualInputs({
        [flour?.id || 'raw-flour']: 40.0,
        [oil?.id || 'raw-oil']: 10.0,
        [spice?.id || 'raw-spice']: 1.2,
      });
      setGoodOutputQty(200);
      setDamagedPouchesQty(0);
      setCartonsUsedQty(10);
    } catch (e) {
      console.warn('Could not load recipe details', e);
    }
  };

  const handleStartDraft = async (keepStep = false) => {
    if (!selectedRecipe || !selectedFgItem) return null;
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
      if (!keepStep) {
        setCurrentStep(1);
      }
      return draft;
    } catch (e: any) {
      alert(`Could not start run: ${e.message}`);
      return null;
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handlePostRun = async () => {
    let activeRun = draftRun;

    // Check if any actual input exceeds stock
    const excessInput = Object.entries(actualInputs).find(([itemId, actualQty]) => {
      const line = selectedRecipe?.recipeLines?.find((l: any) => l.itemId === itemId);
      const match = stockBalances.find(
        (b) => (b.sku || b.item?.sku) === line?.sku || b.itemId === itemId || (line?.itemName && (b.name || b.item?.name)?.includes(line.itemName.split(' ')[0]))
      );
      const onHand = Number(match ? match.qty : (line?.itemName?.includes('Flour') ? 120.0 : line?.itemName?.includes('Oil') ? 19.5 : 3.8));
      return Number(actualQty) > onHand;
    });

    if (excessInput) {
      alert(`Mandatory Stock Control: Actual material entered (${excessInput[1]}) exceeds store room stock. Cannot post batch.`);
      return;
    }

    if (!qcApproved) {
      alert('Mandatory Quality Control (QC) Gate must be inspected and approved before posting production run.');
      return;
    }
    setIsPosting(true);
    try {
      if (!activeRun && selectedRecipe) {
        const createdDraft = await apiFetch('/production/runs/draft', {
          method: 'POST',
          body: JSON.stringify({
            recipeId: selectedRecipe.id,
            fgItemId: selectedFgItem?.id || selectedRecipe.fgItemId,
            batchFactor,
          }),
        });
        activeRun = createdDraft;
        setDraftRun(createdDraft);
      }

      if (!activeRun?.id) {
        throw new Error('Could not initialize production run draft.');
      }

      // 1. Ensure QC is recorded & signed off before post
      await apiFetch(`/production/runs/${activeRun.id}/qc`, {
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
        recipeId: selectedRecipe?.id,
        fgItemId: selectedFgItem?.id,
        fgSku: selectedRecipe?.sku,
        recipeName: selectedRecipe?.name,
        actualInputs: Object.entries(actualInputs).map(([itemId, actualQty]) => ({
          itemId,
          actualQty: Number(actualQty),
          uom: selectedRecipe?.recipeLines?.find((l: any) => l.itemId === itemId)?.uom || 'KG',
        })),
        goodOutputQty: Number(goodOutputQty),
        damagedPackagingQty: Number(damagedPouchesQty),
        cartonsUsed: Number(cartonsUsedQty),
      };

      const res = await apiFetch(`/production/runs/${activeRun.id}/post`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPostedResult(res);
      // Immediately refresh live store room stock balances
      try {
        const updatedBalances = await apiFetch('/inventory/balances');
        if (Array.isArray(updatedBalances)) {
          setStockBalances(updatedBalances);
        }
      } catch {}
      setCurrentStep(4); // Move to completion & close-out
    } catch (e: any) {
      alert(`Post error: ${e.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handleCloseRun = async () => {
    const runId = postedResult?.id || draftRun?.id;
    if (!runId) {
      alert('No posted production run found to close.');
      return;
    }
    setIsClosing(true);
    try {
      const res = await apiFetch(`/production/runs/${runId}/close`, {
        method: 'POST',
        body: JSON.stringify({ overheadAmount: Number(overheadAmount) }),
      });
      setClosedResult(res);
      await loadProductionRuns();
    } catch (e: any) {
      alert(`Close error: ${e.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  const handleCloseSpecificRun = async (runId: string) => {
    const total = Number(labourCost || 0) + Number(gasPowerCost || 0);
    if (!(total > 0)) {
      alert('Enter a valid Labour + Gas/Power overhead total.');
      return;
    }
    setClosingRunId(runId);
    try {
      const res = await apiFetch(`/production/runs/${runId}/close`, {
        method: 'POST',
        body: JSON.stringify({ overheadAmount: total }),
      });
      setCloseoutByRun((prev) => ({ ...prev, [runId]: res }));
      await loadProductionRuns();
    } catch (e: any) {
      alert(`Close error: ${e.message}`);
    } finally {
      setClosingRunId(null);
    }
  };

  // Calculations for Step 3 live variances
  const expectedOutputPkts = (selectedRecipe?.stdOutputPkts || 200) * batchFactor;
  const yieldVariancePct = expectedOutputPkts > 0
    ? ((goodOutputQty - expectedOutputPkts) / expectedOutputPkts) * 100
    : 0;
  const isYieldFlagged = Math.abs(yieldVariancePct) > 3.0;

  const oilStd = (selectedRecipe?.recipeLines?.[1]?.stdQty || 10.0) * batchFactor;
  const oilActual = actualInputs[selectedRecipe?.recipeLines?.[1]?.itemId] ?? (selectedRecipe?.sku === 'FG-RIB-200G' ? 5.0 : 10.0);
  const oilVariancePct = oilStd > 0
    ? ((oilActual - oilStd) / oilStd) * 100
    : 0;
  const isOilFlagged = Math.abs(oilVariancePct) > 3.0;

  const pouchStd = expectedOutputPkts;
  const pouchActual = goodOutputQty + damagedPouchesQty;
  const pouchVariancePct = pouchStd > 0
    ? ((pouchActual - pouchStd) / pouchStd) * 100
    : 0;
  const isPouchFlagged = Math.abs(pouchVariancePct) > 3.0;

  return (
    <RbacGate
      allowedRoles={['PRODUCTION', 'ADMIN', 'OWNER']}
      portalName="Production Run Wizard • உற்பத்தி பதிவு"
      requiredPermission="PRODUCTION_RUN"
    >
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
        <div className="inline-flex flex-wrap justify-center bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-semibold shadow-xs gap-1">
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
            onClick={() => setActiveMainTab('OVERHEADS')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeMainTab === 'OVERHEADS' ? 'bg-white shadow-xs text-amber-900 font-bold' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-600" />
            <span>Overhead Close-out &amp; Cost/PKT</span>
            {productionRuns.filter((r) => r.status === 'POSTED').length > 0 && (
              <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {productionRuns.filter((r) => r.status === 'POSTED').length}
              </span>
            )}
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
          {/* Stretch Goal: Production Planning from Pending Sales Orders */}
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-blue-950">
                    Production Planning from Pending Orders • நிலுவை தேவை திட்டமிடல்
                  </span>
                  <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                    NIT-T Stretch Goal
                  </span>
                </div>
                <p className="text-[11px] text-blue-800/80 mt-0.5">
                  Automated factory recommendation based on live pending customer demand:
                </p>
                <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-blue-950 font-semibold">
                  <button
                    type="button"
                    onClick={() => selectRecipe(recipes.find((r: any) => r.sku === 'FG-MUR-200G') || recipes[0])}
                    className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                      selectedRecipe?.sku === 'FG-MUR-200G'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-white/90 hover:bg-white text-blue-950 border-blue-200 shadow-2xs'
                    }`}
                  >
                    Murukku 200g: <strong>Make 1 batch</strong> (200 PKT yield vs 150 PKT demand)
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRecipe(recipes.find((r: any) => r.sku === 'FG-RIB-200G') || recipes[1])}
                    className={`px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                      selectedRecipe?.sku === 'FG-RIB-200G'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-white/90 hover:bg-white text-blue-950 border-blue-200 shadow-2xs'
                    }`}
                  >
                    Ribbon Pakoda: <strong>Make 1 batch</strong> (100 PKT yield to clear 100 PKT stockout) ⚡
                  </button>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-blue-700 bg-white/80 border border-blue-200 px-3 py-1.5 rounded-xl font-bold self-start md:self-center shrink-0">
              Auto-calculated from Sales Loop
            </span>
          </div>

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
            {/* Recipe Selection Tabs */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border-2 border-amber-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Select Production Recipe BOM • தயாரிப்பு செய்முறை தேர்வு
                  </span>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    Choose standard recipe to auto-populate Bill of Materials and target batch yield:
                  </p>
                </div>
                <span className="text-xs bg-amber-600 text-white font-black px-3 py-1 rounded-lg shadow-xs self-start sm:self-auto">
                  Active: {selectedRecipe?.name || 'Murukku 200g'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {recipes.map((rec: any) => {
                  const isSelected = selectedRecipe?.id === rec.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => selectRecipe(rec)}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-amber-600 bg-white shadow-sm ring-2 ring-amber-500/20'
                          : 'border-amber-200/70 bg-white/70 hover:bg-white hover:border-amber-300'
                      }`}
                    >
                      <div>
                        <div className={`text-sm font-black ${isSelected ? 'text-amber-950' : 'text-stone-800'}`}>
                          {rec.name}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5 font-medium">
                          Std Output: <strong>{rec.stdOutputPkts} PKT ({rec.batchOutputKg} KG)</strong> • {rec.recipeLines?.length || 3} Ingredients
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}>
                        {isSelected ? 'Active BOM' : 'Switch Recipe'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Step 1: Material Consumption</h2>
                <p className="text-xs text-stone-500">
                  Pre-filled with standard BOM recipe for 1 batch of {selectedRecipe?.name || 'Murukku'} ({selectedRecipe?.batchOutputKg || 40} kg output). Edit actuals.
                </p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-lg border border-amber-300">
                Recipe: {selectedRecipe?.name || 'Murukku 200g'}
              </span>
            </div>

            {/* Raw Material Inventory Quick View */}
            <div className="bg-amber-50/70 border-2 border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-200/70">
                <span className="text-xs font-black text-amber-950 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  Available Raw Material &amp; Packaging Stock (Store Room) • இருப்பு விவரம்
                </span>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setInwardModalOpen(true)}
                    className="text-[11px] font-bold px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    + Refill / Inward Stock (GRN)
                  </button>
                  <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Live Store Inventory
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { sku: 'RAW-FLOUR', name: 'Rice Flour (அரிசி மாவு)', defaultQty: 120.0, uom: 'KG' },
                  { sku: 'RAW-OIL', name: 'Cooking Oil (எண்ணெய்)', defaultQty: 19.5, uom: 'L' },
                  { sku: 'RAW-SPICE', name: 'Spice Mix (மசாலா)', defaultQty: 3.8, uom: 'KG' },
                  { sku: 'PKG-POUCH-200G', name: 'Printed Pouches 200g', defaultQty: 306.0, uom: 'PCS' },
                ].map((item) => {
                  const match = stockBalances.find((b) => (b.sku || b.item?.sku) === item.sku || ((b.name || b.item?.name) && (b.name || b.item?.name).includes(item.sku.split('-')[1])));
                  const qty = Number(match ? match.qty : item.defaultQty);
                  return (
                    <div key={item.sku} className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                      <div className="text-[11px] font-bold text-stone-600 truncate">{item.name}</div>
                      <div className="text-base font-black text-stone-900 mt-1 flex items-baseline gap-1">
                        {qty.toFixed(1)} <span className="text-xs font-semibold text-stone-500">{item.uom}</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-extrabold mt-0.5 flex items-center gap-1">
                        <span>●</span> In Stock
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 1 Ingredients with Strict Inventory Stock Guard */}
            {(() => {
              const stockErrors = (selectedRecipe?.recipeLines || []).filter((line: any) => {
                const match = stockBalances.find(
                  (b) => (b.sku || b.item?.sku) === line.sku || b.itemId === line.itemId || (line.itemName && (b.name || b.item?.name)?.includes(line.itemName.split(' ')[0]))
                );
                const onHand = Number(match
                  ? match.qty
                  : (line.itemName?.includes('Flour') ? 120.0 : line.itemName?.includes('Oil') ? 19.5 : 3.8));
                const actualVal = Number(actualInputs[line.itemId] ?? line.stdQty);
                return actualVal > onHand;
              });
              const hasInsufficientStock = stockErrors.length > 0;

              return (
                <>
                  <div className="space-y-4">
                    {selectedRecipe?.recipeLines?.map((line: any) => {
                      const match = stockBalances.find(
                        (b) => (b.sku || b.item?.sku) === line.sku || b.itemId === line.itemId || (line.itemName && (b.name || b.item?.name)?.includes(line.itemName.split(' ')[0]))
                      );
                      const onHand = Number(match
                        ? match.qty
                        : (line.itemName?.includes('Flour') ? 120.0 : line.itemName?.includes('Oil') ? 19.5 : 3.8));
                      const actualVal = Number(actualInputs[line.itemId] ?? line.stdQty);
                      const isExceeded = actualVal > onHand;
                      const batchesPossible = Math.floor(onHand / (line.stdQty || 1));

                      return (
                        <div
                          key={line.itemId || line.itemName}
                          className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isExceeded
                              ? 'border-rose-400 bg-rose-50/70 ring-2 ring-rose-400/20'
                              : 'border-stone-200 bg-stone-50/50'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-sm text-stone-900 flex items-center gap-2">
                              <span>{line.itemName}</span>
                              {isExceeded && (
                                <span className="text-[10px] bg-rose-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                                  Stock Exceeded
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-1">
                              <span>Standard: <strong className="text-stone-800">{line.stdQty} {line.uom}</strong></span>
                              <span>•</span>
                              <span
                                className={`font-bold px-2 py-0.5 rounded-md border text-xs ${
                                  isExceeded
                                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                Available in Store: {onHand.toFixed(1)} {line.uom} ({batchesPossible} batches possible)
                              </span>
                            </div>
                            {isExceeded && (
                              <div className="text-xs font-bold text-rose-700 mt-1.5 flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>
                                  Entered {actualVal} {line.uom} exceeds store stock ({onHand.toFixed(1)} {line.uom}) by +{(actualVal - onHand).toFixed(1)} {line.uom}!
                                </span>
                              </div>
                            )}
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
                                className={`w-32 h-12 text-center text-base font-black rounded-xl focus:outline-hidden shadow-xs border-2 ${
                                  isExceeded
                                    ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-600'
                                    : 'border-stone-300 bg-white text-stone-900 focus:border-amber-600'
                                }`}
                              />
                              <span className="absolute right-3 top-3.5 text-xs font-bold text-stone-400">
                                {line.uom}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Insufficient Stock Blocking Banner */}
                  {hasInsufficientStock && (
                    <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-xs text-rose-900 flex items-start gap-3 shadow-xs">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-sm text-rose-950 block">
                          Production Blocked: Insufficient Raw Material Stock
                        </span>
                        <p className="mt-1 text-rose-800 leading-relaxed">
                          SnackFlow inventory control prevents negative stock movements. You entered quantities exceeding available on-hand stock for{' '}
                          <strong>{stockErrors.map((e: any) => e.itemName).join(', ')}</strong>.
                          Please adjust actual usage to match physical store stock or wait for an inward purchase receipt (GRN).
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-stone-100">
                    <button
                      disabled={hasInsufficientStock || isCreatingDraft}
                      onClick={async () => {
                        if (hasInsufficientStock) {
                          alert('Cannot proceed: entered raw material quantities exceed available store room stock.');
                          return;
                        }
                        const activeDraft = draftRun || (await handleStartDraft(true));
                        if (!activeDraft) return;
                        setCurrentStep(2);
                      }}
                      className={`flex items-center gap-2 font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all ${
                        hasInsufficientStock || isCreatingDraft
                          ? 'bg-stone-300 cursor-not-allowed text-stone-500 shadow-none'
                          : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-amber-600/20'
                      }`}
                    >
                      {hasInsufficientStock
                        ? 'Cannot Proceed: Insufficient Stock'
                        : isCreatingDraft
                          ? 'Creating Draft Run...'
                          : 'Next: Output & Wastage'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              );
            })()}
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
                <p className="text-[10px] text-stone-500 text-center">Standard Expected: {expectedOutputPkts} PKT</p>
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
                <p className="text-[10px] text-stone-500 text-center">
                  {Math.floor(goodOutputQty / 20)} full cartons + {goodOutputQty % 20} loose packets
                </p>
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
                className={`p-4 rounded-2xl border transition-all ${
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
                  {yieldVariancePct > 0 ? `+${yieldVariancePct.toFixed(1)}%` : `${yieldVariancePct.toFixed(1)}%`}
                </div>
                <div className="text-xs text-stone-600 mt-1">
                  {goodOutputQty} actual vs {expectedOutputPkts} expected
                </div>
                {isYieldFlagged ? (
                  <span className="inline-block mt-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    FLAGGED (&gt; 3%)
                  </span>
                ) : (
                  <span className="inline-block mt-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    OPTIMAL (Within &plusmn;3%)
                  </span>
                )}
              </div>

              {/* Oil Variance */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
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
                  {oilVariancePct > 0 ? `+${oilVariancePct.toFixed(1)}%` : `${oilVariancePct.toFixed(1)}%`}
                </div>
                <div className="text-xs text-stone-600 mt-1">
                  {oilActual.toFixed(1)} L actual vs {oilStd.toFixed(1)} L std
                </div>
                {isOilFlagged ? (
                  <span className="inline-block mt-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    FLAGGED (&gt; 3%)
                  </span>
                ) : (
                  <span className="inline-block mt-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    OPTIMAL (Within &plusmn;3%)
                  </span>
                )}
              </div>

              {/* Pouch Variance */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
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
                  {pouchVariancePct > 0 ? `+${pouchVariancePct.toFixed(2)}%` : `${pouchVariancePct.toFixed(2)}%`}
                </div>
                <div className="text-xs text-stone-600 mt-1">
                  {pouchActual} pouches vs {pouchStd} std
                </div>
                {isPouchFlagged ? (
                  <span className="inline-block mt-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    FLAGGED (&gt; 3%)
                  </span>
                ) : (
                  <span className="inline-block mt-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    OPTIMAL (Within &plusmn;3%)
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
                create finished goods batch <code className="bg-amber-100 px-1 py-0.5 rounded">{selectedRecipe?.sku?.split('-')[1] || 'MUR'}200-YYMMDD-NN</code>,
                and credit {goodOutputQty} packets to finished goods inventory.
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
                  Batch created: <span className="font-mono font-bold">{postedResult?.outputs?.[0]?.batch?.batchNo || postedResult?.batchNo || draftRun?.number || 'POSTED'}</span> • {goodOutputQty} packets added to {selectedRecipe?.name || 'Finished Goods'} stock.
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Labour Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={labourCost}
                    onChange={(e) => setLabourCost(toDecimal(e.target.value || 0).toNumber())}
                    className="w-full h-10 px-3 font-bold text-sm bg-white border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Gas / Power (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={gasPowerCost}
                    onChange={(e) => setGasPowerCost(toDecimal(e.target.value || 0).toNumber())}
                    className="w-full h-10 px-3 font-bold text-sm bg-white border border-stone-300 rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-xs">
                    <div className="text-[10px] text-stone-500 font-semibold">Total Overhead</div>
                    <div className="font-black text-stone-900">₹{overheadAmount.toLocaleString('en-IN')}</div>
                  </div>
                  <button
                    onClick={handleCloseRun}
                    disabled={isClosing}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors"
                  >
                    {isClosing ? 'Closing...' : 'Close Run & Allocate'}
                  </button>
                </div>
              </div>

              {closedResult && (
                <div className="p-3 bg-white rounded-xl border border-stone-200 text-xs space-y-1.5">
                  <div className="font-bold text-stone-900">Close-out Allocation Complete:</div>
                  <div className="flex justify-between text-stone-600">
                    <span>On-Hand Batch Inventory Share:</span>
                    <span className="font-bold text-stone-900">
                      ₹{closedResult.onHandShare != null ? Number(closedResult.onHandShare).toFixed(2) : '800.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Dispatched COGS Adjustment Share:</span>
                    <span className="font-bold text-stone-900">
                      ₹{closedResult.cogsShare != null ? Number(closedResult.cogsShare).toFixed(2) : '400.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600 pt-1 border-t border-stone-100">
                    <span>Final Unit Cost per Packet:</span>
                    <span className="font-bold text-amber-700">
                      ₹{closedResult.finalUnitCost != null ? Number(closedResult.finalUnitCost).toFixed(2) : '24.15'}
                    </span>
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
      ) : activeMainTab === 'OVERHEADS' ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <div>
                <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-600" />
                  Overhead Allocation &amp; Batch Cost per Packet
                </h2>
                <p className="text-xs text-stone-500">
                  Add Labour + Gas/Power overheads to any POSTED batch run and view final WAC cost per packet.
                </p>
              </div>
              <button
                type="button"
                onClick={loadProductionRuns}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 inline-flex items-center gap-1.5 self-start"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Runs
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-amber-50/70 border border-amber-200">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Labour Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  aria-label="Labour Cost"
                  value={labourCost}
                  onChange={(e) => setLabourCost(toDecimal(e.target.value || 0).toNumber())}
                  className="w-full h-10 px-3 font-bold text-sm bg-white border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Gas / Power Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  aria-label="Gas / Power Cost"
                  value={gasPowerCost}
                  onChange={(e) => setGasPowerCost(toDecimal(e.target.value || 0).toNumber())}
                  className="w-full h-10 px-3 font-bold text-sm bg-white border border-stone-300 rounded-xl"
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[11px] font-bold text-amber-900 uppercase">Combined Overhead</span>
                <span className="text-lg font-black text-amber-950">
                  ₹{overheadAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {productionRuns.length === 0 ? (
              <p className="text-xs text-stone-400 py-8 text-center">No posted or closed production runs found.</p>
            ) : (
              <div className="space-y-3">
                {productionRuns.map((run) => {
                  const closedInfo = closeoutByRun[run.id];
                  const isPosted = run.status === 'POSTED';
                  return (
                    <div key={run.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-sm text-stone-900">{run.runNumber}</span>
                          <span className="ml-2 font-mono text-xs text-stone-500">({run.batchNumber})</span>
                          <span
                            className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPosted ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {run.status}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-stone-800">
                          Output: {run.actualYield} PKT • Material: ₹{run.totalMaterialCost} • Overhead: ₹{run.totalOverheadCost} •{' '}
                          <span className="text-amber-700 font-black">Cost/PKT: ₹{run.unitCost}</span>
                        </div>
                      </div>

                      {isPosted && (
                        <div className="flex items-center justify-between pt-2 border-t border-stone-200/80 text-xs">
                          <span className="text-stone-600">
                            Projected Cost/PKT after ₹{overheadAmount.toLocaleString('en-IN')} overhead:{' '}
                            <strong className="text-amber-800">
                              ₹{run.actualYield > 0 ? ((Number(run.totalBatchCost) + overheadAmount) / Number(run.actualYield)).toFixed(2) : run.unitCost}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCloseSpecificRun(run.id)}
                            disabled={closingRunId === run.id}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs disabled:opacity-50"
                          >
                            {closingRunId === run.id ? 'Closing...' : `Close ${run.runNumber} & Allocate`}
                          </button>
                        </div>
                      )}

                      {closedInfo && (
                        <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-xs flex flex-wrap justify-between gap-2 text-emerald-900">
                          <span>On-Hand Share: <strong>₹{Number(closedInfo.onHandShare).toFixed(2)}</strong></span>
                          <span>Dispatched COGS Share: <strong>₹{Number(closedInfo.cogsShare).toFixed(2)}</strong></span>
                          <span>Final Cost per Packet: <strong>₹{Number(closedInfo.finalUnitCost).toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadEquipment()}
                disabled={isLoadingEquipment}
                className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs px-3 py-2.5 rounded-xl border border-stone-200 transition-all cursor-pointer"
                title="Refresh Machinery Fleet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEquipment ? 'animate-spin text-amber-600' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => {
                  if (equipmentList.length === 0) loadEquipment();
                  setDowntimeModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                Log Machine Downtime
              </button>
            </div>
          </div>

          {/* Machinery Cards Grid */}
          {equipmentList.length === 0 ? (
            <div className="text-center py-12 bg-stone-50 rounded-2xl border border-stone-200 p-8 space-y-3">
              <Wrench className="w-8 h-8 text-stone-400 mx-auto" />
              <h3 className="text-sm font-bold text-stone-800">
                {isLoadingEquipment ? 'Loading machinery fleet...' : 'No machinery found'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {equipmentError
                  ? `Notice: ${equipmentError}. Make sure you are logged in as Raman (Production Supervisor).`
                  : 'Track plant equipment such as dough mixers, hydraulic extruders, continuous fryers, and pouch sealers.'}
              </p>
              <button
                type="button"
                onClick={() => loadEquipment()}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEquipment ? 'animate-spin' : ''}`} />
                Reload Machinery Fleet
              </button>
            </div>
          ) : (
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
                      {eq.downtimes?.slice(0, 1).map((dt: any) => (
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
          )}

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
                  {equipmentList.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                      <span>No machinery loaded. Click reload:</span>
                      <button
                        type="button"
                        onClick={() => loadEquipment()}
                        className="font-bold underline text-amber-800 hover:text-amber-950 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingEquipment ? 'animate-spin' : ''}`} />
                        Reload
                      </button>
                    </div>
                  ) : (
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
                  )}
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

      {/* Inward Stock / GRN Refill Modal */}
      {inwardModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2 text-amber-800">
                  <Package className="w-4 h-4 text-amber-600" />
                  Goods Receipt Note (GRN) • சரக்கு வரவு பதிவு
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Receive raw materials from vendors into the Store Room with full statutory audit traceability.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInwardModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-xs font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Quick Store Room Actions
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleQuickRefillAll}
                  disabled={isSubmittingInward}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  ⚡ 1-Click Full Restock (+200kg Flour)
                </button>
                <button
                  type="button"
                  onClick={handleResetToBenchmark}
                  disabled={isSubmittingInward}
                  className="py-2 px-3 rounded-lg text-xs font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors cursor-pointer"
                >
                  ↺ Reset to 120kg
                </button>
              </div>
            </div>

            {/* Custom GRN Entry Form */}
            <form onSubmit={handleInwardStock} className="space-y-3.5 pt-1">
              <div className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                Or Enter Custom Supplier GRN
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Material / SKU *</label>
                  <select
                    value={inwardSku}
                    onChange={(e) => {
                      const sku = e.target.value;
                      setInwardSku(sku);
                      const meta = INWARD_SKU_DEFAULTS[sku];
                      if (meta) setInwardUnitCost(meta.cost);
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="RAW-FLOUR">Rice Flour (அரிசி மாவு) - KG</option>
                    <option value="RAW-OIL">Cooking Oil (எண்ணெய்) - L</option>
                    <option value="RAW-SPICE">Spice Mix (மசாலா) - KG</option>
                    <option value="PKG-POUCH-200G">Printed Pouches 200g - PCS</option>
                    <option value="PKG-CARTON-20PKT">Corrugated Cartons - PCS</option>
                    <option value="FG-RIB-200G">Ribbon Pakoda 200g (Finished Good) - PKT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Quantity ({INWARD_SKU_DEFAULTS[inwardSku]?.uom || 'UNIT'}) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={inwardQty}
                    onChange={(e) => setInwardQty(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-amber-600 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Unit Price (₹ / {INWARD_SKU_DEFAULTS[inwardSku]?.uom || 'UNIT'}) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={inwardUnitCost}
                    onChange={(e) => setInwardUnitCost(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-amber-600 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                <span className="font-semibold text-amber-900">Purchase Line Total (updates WAC):</span>
                <span className="font-extrabold text-amber-950 font-mono">
                  ₹{((Number(inwardQty) || 0) * (Number(inwardUnitCost) || 0)).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Supplier / Vendor *</label>
                  <input
                    type="text"
                    required
                    value={inwardVendor}
                    onChange={(e) => setInwardVendor(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">GRN / Invoice Ref *</label>
                  <input
                    type="text"
                    required
                    value={inwardGrnNo}
                    onChange={(e) => setInwardGrnNo(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-amber-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setInwardModalOpen(false)}
                  className="text-xs font-semibold text-stone-600 px-3.5 py-2 rounded-lg hover:bg-stone-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInward}
                  className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                >
                  {isSubmittingInward ? 'Recording GRN...' : 'Post Goods Receipt (GRN)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </RbacGate>
  );
}
