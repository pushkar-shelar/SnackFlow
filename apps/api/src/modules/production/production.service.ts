import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  RunStatus,
  MovementType,
  WastageReason,
  calculateIngredientVariance,
  calculatePackagingVariance,
  calculateYieldVariance,
  calculateRemainderSplit,
  canTransitionRun,
  Decimal,
  roundMoney,
  roundUnitCost,
  toDecimal,
} from '@snackflow/shared';

@Injectable()
export class ProductionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Step 1: Create a Draft Production Run pre-filling standard recipe and pack-spec consumption
   */
  async createDraftRun(companyId: string, recipeId: string, fgItemId: string, batchFactor: number = 1.0) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { recipeLines: { include: { item: true } } },
    });
    if (!recipe || recipe.companyId !== companyId) {
      throw new NotFoundException('Recipe not found');
    }

    const fgItem = await this.prisma.item.findUnique({
      where: { id: fgItemId },
    });
    if (!fgItem || fgItem.companyId !== companyId) {
      throw new NotFoundException('Finished goods item not found');
    }

    const bf = toDecimal(batchFactor);
    const expectedBatchKg = toDecimal(recipe.batchOutputKg).times(bf);
    const netWeightKg = fgItem.netWeightG ? toDecimal(fgItem.netWeightG).dividedBy(1000) : new Decimal(0.2);
    const expectedOutputQty = expectedBatchKg.dividedBy(netWeightKg).round();

    const runNumber = `RUN-${Date.now().toString().slice(-6)}`;

    return this.prisma.productionRun.create({
      data: {
        companyId,
        number: runNumber,
        recipeId,
        fgItemId,
        status: RunStatus.DRAFT,
        batchFactor: bf.toNumber(),
        runDate: new Date(),
        inputs: {
          create: recipe.recipeLines.map((line) => {
            const stdQty = toDecimal(line.qtyPerBatch).times(bf);
            return {
              itemId: line.itemId,
              stdQty: stdQty.toNumber(),
              actualQty: stdQty.toNumber(), // Pre-filled with standard
              uom: line.uom,
              unitCost: 0,
              value: 0,
              variancePct: 0,
              flagged: false,
            };
          }),
        },
        outputs: {
          create: [
            {
              fgItemId,
              expectedQty: expectedOutputQty.toNumber(),
              goodQty: expectedOutputQty.toNumber(),
            },
          ],
        },
      },
      include: {
        recipe: true,
        inputs: { include: { item: true } },
        outputs: { include: { fgItem: true } },
      },
    });
  }

  /**
   * Step 2: Post the Production Run (consumes raw/pkg materials, produces FG batch, flags variances)
   */
  async postRun(
    companyId: string,
    runId: string,
    payload: {
      actualInputs: { itemId: string; actualQty: number; uom: string }[];
      goodOutputQty: number;
      damagedPackagingQty?: number;
      cartonsUsed?: number;
    },
    createdBy?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.productionRun.findUnique({
        where: { id: runId },
        include: {
          recipe: { include: { recipeLines: true } },
          inputs: true,
          outputs: true,
        },
      });

      if (!run || run.companyId !== companyId) {
        throw new NotFoundException('Production run not found');
      }

      if (!canTransitionRun(run.status as RunStatus, RunStatus.POSTED)) {
        throw new BadRequestException(`Cannot post production run in state ${run.status}`);
      }

      const fgItem = await tx.item.findUnique({ where: { id: run.fgItemId } });
      const packSpec = await tx.packSpec.findUnique({
        where: { companyId_fgItemId: { companyId, fgItemId: run.fgItemId } },
        include: { packSpecLines: true },
      });

      const bf = toDecimal(run.batchFactor);
      const goodOutput = toDecimal(payload.goodOutputQty);
      const damagedPouches = toDecimal(payload.damagedPackagingQty || 0);
      const cartonsUsed = toDecimal(payload.cartonsUsed || Math.ceil(goodOutput.toNumber() / 20));

      const expectedBatchKg = toDecimal(run.recipe.batchOutputKg).times(bf);
      const netWeightKg = fgItem?.netWeightG ? toDecimal(fgItem.netWeightG).dividedBy(1000) : new Decimal(0.2);
      const expectedOutput = expectedBatchKg.dividedBy(netWeightKg).round();

      // 1. Calculate and update yield variance
      const _yieldVariance = calculateYieldVariance(expectedOutput, goodOutput, run.recipe.tolerancePct);

      // 2. Process Raw Material Issues
      const movements: any[] = [];
      let totalMaterialValue = new Decimal(0);

      for (const inputDto of payload.actualInputs) {
        const recipeLine = run.recipe.recipeLines.find((rl) => rl.itemId === inputDto.itemId);
        const stdQty = recipeLine ? toDecimal(recipeLine.qtyPerBatch).times(bf) : toDecimal(inputDto.actualQty);
        const actualQty = toDecimal(inputDto.actualQty);

        const ingVariance = calculateIngredientVariance(stdQty, actualQty, run.recipe.tolerancePct);

        // Fetch current WAC from stock balance
        const balance = await tx.stockBalance.findFirst({
          where: { companyId, itemId: inputDto.itemId, batchId: null },
        });
        const currentWac = balance ? toDecimal(balance.wac) : new Decimal(0);
        const lineValue = roundMoney(actualQty.times(currentWac));
        totalMaterialValue = totalMaterialValue.plus(lineValue);

        // Update run_input row
        await tx.runInput.updateMany({
          where: { runId: run.id, itemId: inputDto.itemId },
          data: {
            actualQty: actualQty.toNumber(),
            unitCost: currentWac.toNumber(),
            value: lineValue.toNumber(),
            variancePct: ingVariance.variancePct.toNumber(),
            flagged: ingVariance.flagged,
          },
        });

        movements.push({
          companyId,
          itemId: inputDto.itemId,
          qty: actualQty,
          unitCost: currentWac,
          movementType: MovementType.ISSUE,
          sourceType: 'PRODUCTION_RUN',
          sourceId: run.id,
          createdBy,
        });
      }

      // 3. Process Packaging Material Issues
      // Pouch packaging item
      const pouchLine = packSpec?.packSpecLines.find((l) => l.qtyPerPacket.toNumber() === 1.0);
      if (pouchLine) {
        const totalPouchesUsed = goodOutput.plus(damagedPouches);
        const _pkgVariance = calculatePackagingVariance(goodOutput, 1.0, totalPouchesUsed, run.recipe.tolerancePct);

        const pouchBal = await tx.stockBalance.findFirst({
          where: { companyId, itemId: pouchLine.packagingItemId, batchId: null },
        });
        const pouchWac = pouchBal ? toDecimal(pouchBal.wac) : new Decimal(0);
        const pouchValue = roundMoney(totalPouchesUsed.times(pouchWac));
        totalMaterialValue = totalMaterialValue.plus(pouchValue);

        movements.push({
          companyId,
          itemId: pouchLine.packagingItemId,
          qty: totalPouchesUsed,
          unitCost: pouchWac,
          movementType: MovementType.ISSUE,
          sourceType: 'PRODUCTION_RUN',
          sourceId: run.id,
          createdBy,
        });

        // Record damaged packaging wastage
        if (damagedPouches.greaterThan(0)) {
          await tx.runWastage.create({
            data: {
              runId: run.id,
              itemId: pouchLine.packagingItemId,
              qty: damagedPouches.toNumber(),
              uom: 'PCS',
              reason: WastageReason.DAMAGED_PACKAGING,
            },
          });
        }
      }

      // Carton packaging item
      const cartonLine = packSpec?.packSpecLines.find((l) => l.qtyPerPacket.toNumber() < 1.0);
      if (cartonLine) {
        const cartonBal = await tx.stockBalance.findFirst({
          where: { companyId, itemId: cartonLine.packagingItemId, batchId: null },
        });
        const cartonWac = cartonBal ? toDecimal(cartonBal.wac) : new Decimal(0);
        const cartonValue = roundMoney(cartonsUsed.times(cartonWac));
        totalMaterialValue = totalMaterialValue.plus(cartonValue);

        movements.push({
          companyId,
          itemId: cartonLine.packagingItemId,
          qty: cartonsUsed,
          unitCost: cartonWac,
          movementType: MovementType.ISSUE,
          sourceType: 'PRODUCTION_RUN',
          sourceId: run.id,
          createdBy,
        });
      }

      // 4. Create Finished Goods Batch (MUR200-YYMMDD-NN)
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const countToday = await tx.stockBatch.count({
        where: {
          companyId,
          itemId: run.fgItemId,
          batchNo: { startsWith: `MUR200-${dateStr}-` },
        },
      });
      const seqStr = String(countToday + 1).padStart(2, '0');
      const batchNo = `MUR200-${dateStr}-${seqStr}`;
      const mfgDate = new Date();
      const expiryDate = new Date(mfgDate.getTime() + (fgItem?.shelfLifeDays || 90) * 24 * 60 * 60 * 1000);

      // Provisional Cost per packet = material cost / good output
      const provisionalUnitCost = goodOutput.isZero()
        ? new Decimal(0)
        : roundUnitCost(totalMaterialValue.dividedBy(goodOutput));

      const batch = await tx.stockBatch.create({
        data: {
          companyId,
          itemId: run.fgItemId,
          batchNo,
          mfgDate,
          expiryDate,
          unitCost: provisionalUnitCost.toNumber(),
        },
      });

      // 5. Finished Goods IN movement
      movements.push({
        companyId,
        itemId: run.fgItemId,
        batchId: batch.id,
        qty: goodOutput,
        unitCost: provisionalUnitCost,
        movementType: MovementType.PRODUCE,
        sourceType: 'PRODUCTION_RUN',
        sourceId: run.id,
        createdBy,
      });

      // Execute all movements atomically via InventoryService
      await this.inventoryService.postMovements(tx, movements);

      // Update output row with actual batch and yield
      await tx.runOutput.updateMany({
        where: { runId: run.id },
        data: {
          goodQty: goodOutput.toNumber(),
          batchId: batch.id,
        },
      });

      // Update run status to POSTED
      return tx.productionRun.update({
        where: { id: run.id },
        data: { status: RunStatus.POSTED },
        include: {
          recipe: true,
          inputs: { include: { item: true } },
          outputs: { include: { fgItem: true, batch: true } },
          wastages: true,
        },
      });
    });
  }

  /**
   * Step 3: Close Run — absorbs attached overheads and splits remainder between on-hand batch and COGS
   */
  async closeRun(companyId: string, runId: string, overheadAmount: number, createdBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.productionRun.findUnique({
        where: { id: runId },
        include: { outputs: true },
      });

      if (!run || run.companyId !== companyId) {
        throw new NotFoundException('Production run not found');
      }

      if (!canTransitionRun(run.status as RunStatus, RunStatus.CLOSED)) {
        throw new BadRequestException(`Cannot close run in status ${run.status}`);
      }

      const output = run.outputs[0];
      if (!output || !output.batchId) {
        throw new BadRequestException('Production run has no output batch');
      }

      const totalGoodQty = toDecimal(output.goodQty);
      const overhead = roundMoney(overheadAmount);

      // Attach overhead entry
      await tx.overheadEntry.create({
        data: {
          companyId,
          runId: run.id,
          type: 'LABOUR',
          amount: overhead.toNumber(),
          period: new Date().toISOString().slice(0, 7),
        },
      });

      // Check current on-hand quantity for this batch vs dispatched quantity
      const onHandBalance = await tx.stockBalance.findFirst({
        where: { companyId, itemId: run.fgItemId, batchId: output.batchId },
      });
      const onHandQty = onHandBalance ? toDecimal(onHandBalance.qty) : new Decimal(0);
      const dispatchedQty = totalGoodQty.minus(onHandQty);

      // Remainder method: split overhead between on-hand inventory and COGS adjustment
      const split = calculateRemainderSplit(overhead, [
        { id: 'cogs_dispatched', weight: dispatchedQty },
        { id: 'inventory_on_hand', weight: onHandQty },
      ]);

      const onHandShare = split.find((s) => s.id === 'inventory_on_hand')!.amount;
      const _cogsShare = split.find((s) => s.id === 'cogs_dispatched')!.amount;

      // Update batch unit_cost
      const batch = await tx.stockBatch.findUnique({ where: { id: output.batchId } });
      const oldUnitCost = batch ? toDecimal(batch.unitCost) : new Decimal(0);
      const addedCostPerPacket = totalGoodQty.isZero() ? new Decimal(0) : overhead.dividedBy(totalGoodQty);
      const finalUnitCost = roundUnitCost(oldUnitCost.plus(addedCostPerPacket));

      await tx.stockBatch.update({
        where: { id: output.batchId },
        data: { unitCost: finalUnitCost.toNumber() },
      });

      // Post value-only COST_ADJ movement to on-hand inventory batch
      if (onHandQty.greaterThan(0)) {
        await this.inventoryService.postMovements(tx, [
          {
            companyId,
            itemId: run.fgItemId,
            batchId: output.batchId,
            qty: 0,
            unitCost: onHandShare, // Value adjustment
            movementType: MovementType.COST_ADJ,
            sourceType: 'OVERHEAD_CLOSEOUT',
            sourceId: run.id,
            createdBy,
          },
        ]);
      }

      // Transition to CLOSED
      const closedRun = await tx.productionRun.update({
        where: { id: run.id },
        data: { status: RunStatus.CLOSED },
        include: {
          outputs: { include: { batch: true } },
          overheads: true,
        },
      });

      return {
        run: closedRun,
        onHandShare: onHandShare.toNumber(),
        cogsShare: _cogsShare.toNumber(),
        finalUnitCost: finalUnitCost.toNumber(),
      };
    });
  }

  /**
   * Reverse Run — reverses all movements in opposite direction
   */
  async reverseRun(companyId: string, runId: string, createdBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.productionRun.findUnique({
        where: { id: runId },
        include: { outputs: true },
      });

      if (!run || run.companyId !== companyId) {
        throw new NotFoundException('Production run not found');
      }

      if (!canTransitionRun(run.status as RunStatus, RunStatus.REVERSED)) {
        throw new BadRequestException(`Cannot reverse production run in status ${run.status}`);
      }

      // Fetch all original movements for this run
      const originalMovements = await tx.stockLedger.findMany({
        where: { companyId, sourceType: 'PRODUCTION_RUN', sourceId: run.id },
      });

      // Create offsetting movements
      const reverseMovements = originalMovements.map((m) => {
        if (m.qtyIn.toNumber() > 0) {
          // Reverse IN -> make it an OUT
          return {
            companyId,
            itemId: m.itemId,
            batchId: m.batchId,
            qty: m.qtyIn,
            unitCost: m.unitCost,
            movementType: MovementType.ADJUST,
            sourceType: 'PRODUCTION_REVERSAL',
            sourceId: run.id,
            createdBy,
          };
        } else {
          // Reverse OUT -> make it an IN
          return {
            companyId,
            itemId: m.itemId,
            batchId: m.batchId,
            qty: m.qtyOut,
            unitCost: m.unitCost,
            movementType: MovementType.ADJUST,
            sourceType: 'PRODUCTION_REVERSAL',
            sourceId: run.id,
            createdBy,
          };
        }
      });

      await this.inventoryService.postMovements(tx, reverseMovements);

      return tx.productionRun.update({
        where: { id: run.id },
        data: { status: RunStatus.REVERSED },
      });
    });
  }

  async getRun(companyId: string, runId: string) {
    return this.prisma.productionRun.findFirst({
      where: { id: runId, companyId },
      include: {
        recipe: { include: { recipeLines: { include: { item: true } } } },
        inputs: { include: { item: true } },
        outputs: { include: { fgItem: true, batch: true } },
        wastages: { include: { item: true } },
        overheads: true,
      },
    });
  }
}
