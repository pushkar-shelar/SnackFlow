import { PrismaClient, Role, ItemKind, CostMethod, PartyKind, MovementType } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { generateValidGstin, getFinancialYear } from '@snackflow/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SnackFlow database with Section 5 benchmark data...');

  // 1. Company
  const companyGstin = generateValidGstin('33', 'AABCM1234F', '1');
  const company = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Murukku Delights Private Limited',
      gstin: companyGstin,
      stateCode: '33',
      address: 'Plot 42, SIDCO Industrial Estate, Thuvakudi, Tiruchirappalli, Tamil Nadu 620015',
    },
  });

  // 2. Users (One per role per §0 & §6)
  const defaultPasswordHash = await hash('Password123!', {
    memoryCost: 65536,
    timeCost: 3,
  });

  const users = [
    { email: 'salesman@snackflow.local', name: 'Karthik (Salesman)', role: Role.SALESMAN },
    { email: 'admin@snackflow.local', name: 'Meenakshi (Admin)', role: Role.ADMIN },
    { email: 'production@snackflow.local', name: 'Raman (Production Supervisor)', role: Role.PRODUCTION },
    { email: 'auditor@snackflow.local', name: 'Sundaram & Co (Auditor)', role: Role.AUDITOR },
    { email: 'owner@snackflow.local', name: 'Annamalai (Owner)', role: Role.OWNER },
    { email: 'salesman@snackflow.com', name: 'Karthik (Salesman)', role: Role.SALESMAN },
    { email: 'admin@snackflow.com', name: 'Meenakshi (Admin)', role: Role.ADMIN },
    { email: 'production@snackflow.com', name: 'Raman (Production Supervisor)', role: Role.PRODUCTION },
    { email: 'auditor@snackflow.com', name: 'Sundaram & Co (Auditor)', role: Role.AUDITOR },
    { email: 'owner@snackflow.com', name: 'Annamalai (Owner)', role: Role.OWNER },
  ];

  const createdUsers: Record<string, any> = {};
  for (const u of users) {
    createdUsers[u.role] = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, passwordHash: defaultPasswordHash },
      create: {
        companyId: company.id,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: defaultPasswordHash,
      },
    });
  }

  // 3. Price List
  const priceList = await prisma.priceList.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      companyId: company.id,
      name: 'Standard Wholesale Price List',
      isDefault: true,
      validFrom: new Date('2026-04-01'),
    },
  });

  // 4. Items (Raw, Packaging, Finished Goods)
  const rawFlour = await prisma.item.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'RAW-FLOUR' } },
    update: {},
    create: {
      companyId: company.id,
      sku: 'RAW-FLOUR',
      name: 'Rice Flour',
      kind: ItemKind.RAW,
      baseUom: 'KG',
      hsn: '11029000',
      gstRate: 5.0,
      reorderLevel: 50.0,
      costMethod: CostMethod.WAC,
    },
  });

  const rawOil = await prisma.item.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'RAW-OIL' } },
    update: {},
    create: {
      companyId: company.id,
      sku: 'RAW-OIL',
      name: 'Cooking Oil',
      kind: ItemKind.RAW,
      baseUom: 'L',
      hsn: '15121910',
      gstRate: 5.0,
      reorderLevel: 20.0,
      costMethod: CostMethod.WAC,
    },
  });

  const rawSpice = await prisma.item.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'RAW-SPICE' } },
    update: {},
    create: {
      companyId: company.id,
      sku: 'RAW-SPICE',
      name: 'Spice Mix',
      kind: ItemKind.RAW,
      baseUom: 'KG',
      hsn: '09109929',
      gstRate: 5.0,
      reorderLevel: 5.0,
      costMethod: CostMethod.WAC,
    },
  });

  const pkgPouch = await prisma.item.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'PKG-POUCH-200G' } },
    update: {},
    create: {
      companyId: company.id,
      sku: 'PKG-POUCH-200G',
      name: 'Printed Pouches 200g',
      kind: ItemKind.PACKAGING,
      baseUom: 'PCS',
      hsn: '39232100',
      gstRate: 18.0,
      reorderLevel: 500.0,
      costMethod: CostMethod.WAC,
    },
  });

  const pkgCarton = await prisma.item.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'PKG-CARTON-20PKT' } },
    update: {},
    create: {
      companyId: company.id,
      sku: 'PKG-CARTON-20PKT',
      name: 'Corrugated Cartons (20 PKT)',
      kind: ItemKind.PACKAGING,
      baseUom: 'PCS',
      hsn: '48191010',
      gstRate: 12.0,
      reorderLevel: 20.0,
      costMethod: CostMethod.WAC,
    },
  });

  const fgMurukku = await prisma.item.upsert({
    where: { companyId_sku: { companyId: company.id, sku: 'FG-MUR-200G' } },
    update: {},
    create: {
      companyId: company.id,
      sku: 'FG-MUR-200G',
      name: 'Murukku 200g',
      kind: ItemKind.FINISHED,
      baseUom: 'PKT',
      hsn: '21069099',
      gstRate: 5.0,
      netWeightG: 200.0,
      shelfLifeDays: 90,
      costMethod: CostMethod.BATCH_ACTUAL,
    },
  });

  // 5. Item UoM: 1 CTN = 20 PKT for Murukku 200g
  await prisma.itemUom.upsert({
    where: { itemId_uom: { itemId: fgMurukku.id, uom: 'CTN' } },
    update: {},
    create: {
      companyId: company.id,
      itemId: fgMurukku.id,
      uom: 'CTN',
      factorToBase: 20.0,
    },
  });

  // Price List Item: Murukku 200g = ₹50.00
  await prisma.priceListItem.upsert({
    where: { priceListId_itemId: { priceListId: priceList.id, itemId: fgMurukku.id } },
    update: { rate: 50.0 },
    create: {
      priceListId: priceList.id,
      itemId: fgMurukku.id,
      rate: 50.0,
    },
  });

  // 6. Recipe: Murukku 40 kg batch
  const recipe = await prisma.recipe.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      companyId: company.id,
      productFamily: 'Murukku',
      batchOutputKg: 40.0,
      tolerancePct: 3.0,
      description: 'Standard 40 kg kettle batch Murukku',
    },
  });

  // Recipe Lines
  await prisma.recipeLine.deleteMany({ where: { recipeId: recipe.id } });
  await prisma.recipeLine.createMany({
    data: [
      { recipeId: recipe.id, itemId: rawFlour.id, qtyPerBatch: 40.0, uom: 'KG' },
      { recipeId: recipe.id, itemId: rawOil.id, qtyPerBatch: 10.0, uom: 'L' },
      { recipeId: recipe.id, itemId: rawSpice.id, qtyPerBatch: 1.2, uom: 'KG' },
    ],
  });

  // 7. Pack Spec: Murukku 200g
  const packSpec = await prisma.packSpec.upsert({
    where: { companyId_fgItemId: { companyId: company.id, fgItemId: fgMurukku.id } },
    update: {},
    create: {
      companyId: company.id,
      fgItemId: fgMurukku.id,
      description: 'Murukku 200g packet packaging spec',
    },
  });

  await prisma.packSpecLine.deleteMany({ where: { packSpecId: packSpec.id } });
  await prisma.packSpecLine.createMany({
    data: [
      { packSpecId: packSpec.id, packagingItemId: pkgPouch.id, qtyPerPacket: 1.0 },
      { packSpecId: packSpec.id, packagingItemId: pkgCarton.id, qtyPerPacket: 0.05 }, // 1 carton per 20 packets
    ],
  });

  // 8. Parties
  const gstinTN = generateValidGstin('33', 'AABCS1234A', '1');
  const gstinKA = generateValidGstin('29', 'AABCB5678B', '1');

  const retailerA = await prisma.party.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      companyId: company.id,
      name: 'Sri Murugan Stores (Retailer A)',
      kind: PartyKind.CUSTOMER_RETAILER,
      gstin: gstinTN,
      stateCode: '33',
      address: 'Shop 14, Main Bazaar, Tiruchirappalli, Tamil Nadu 620001',
      priceListId: priceList.id,
      assignedSalesmanId: createdUsers[Role.SALESMAN].id,
      creditDays: 30,
    },
  });

  const distributorB = await prisma.party.upsert({
    where: { id: '00000000-0000-0000-0000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000031',
      companyId: company.id,
      name: 'Bangalore Snacks Wholesale (Distributor B)',
      kind: PartyKind.CUSTOMER_DISTRIBUTOR,
      gstin: gstinKA,
      stateCode: '29',
      address: 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka 560022',
      priceListId: priceList.id,
      creditDays: 45,
    },
  });

  // 9. Document Sequences for FY
  const currentFy = getFinancialYear(new Date());
  const docTypes = ['INV', 'ORD', 'RUN', 'DISP', 'CRN', 'PAY', 'PUR'];
  for (const dt of docTypes) {
    await prisma.documentSequence.upsert({
      where: { companyId_docType_fy: { companyId: company.id, docType: dt, fy: currentFy } },
      update: {},
      create: {
        companyId: company.id,
        docType: dt,
        fy: currentFy,
        nextNo: 1,
      },
    });
  }

  // Helper to upsert stock balance cleanly
  async function upsertStockBalance(companyId: string, itemId: string, batchId: string | null, qty: number, value: number, wac: number) {
    const existing = await prisma.stockBalance.findFirst({
      where: { companyId, itemId, batchId },
    });
    if (existing) {
      return prisma.stockBalance.update({
        where: { id: existing.id },
        data: { qty, value, wac },
      });
    }
    return prisma.stockBalance.create({
      data: { companyId, itemId, batchId, qty, value, wac },
    });
  }

  // 10. Opening Stock Batches & Balances per §14 Benchmark
  // Flour: 100 kg @ ₹42.00 = ₹4,200.00
  await upsertStockBalance(company.id, rawFlour.id, null, 100.0, 4200.0, 42.0);

  // Oil: 30 L @ ₹140.00 = ₹4,200.00
  await upsertStockBalance(company.id, rawOil.id, null, 30.0, 4200.0, 140.0);

  // Spice Mix: 5 kg @ ₹200.00 = ₹1,000.00
  await upsertStockBalance(company.id, rawSpice.id, null, 5.0, 1000.0, 200.0);

  // Pouches: 500 pcs @ ₹2.50 = ₹1,250.00
  await upsertStockBalance(company.id, pkgPouch.id, null, 500.0, 1250.0, 2.5);

  // Cartons: 30 pcs @ ₹15.00 = ₹450.00
  await upsertStockBalance(company.id, pkgCarton.id, null, 30.0, 450.0, 15.0);

  // Finished Goods: 50 packets @ ₹19.85 (Batch OPENING, earlier expiry)
  const openingBatch = await prisma.stockBatch.upsert({
    where: { companyId_itemId_batchNo: { companyId: company.id, itemId: fgMurukku.id, batchNo: 'OPENING' } },
    update: {},
    create: {
      companyId: company.id,
      itemId: fgMurukku.id,
      batchNo: 'OPENING',
      mfgDate: new Date('2026-10-01'),
      expiryDate: new Date('2026-12-30'),
      unitCost: 19.85,
    },
  });

  await upsertStockBalance(company.id, fgMurukku.id, openingBatch.id, 50.0, 992.5, 19.85);

  // 11. Machinery & Equipment Master Data
  const defaultMachinery = [
    { code: 'EQ-MIXER-01', name: 'Dough Kneader & Flour Blender 50kg', type: 'MIXER', healthScore: 96, operatingHours: 1420.5 },
    { code: 'EQ-EXTRUDER-01', name: 'Traditional Murukku Hydraulic Press / Extruder', type: 'EXTRUDER', healthScore: 92, operatingHours: 1850.0 },
    { code: 'EQ-FRYER-01', name: 'Continuous Gas Deep Fryer with Heat Exchanger', type: 'FRYER', healthScore: 88, operatingHours: 2110.0 },
    { code: 'EQ-SEALER-01', name: 'Continuous Band Nitrogen Flushing Pouch Sealer', type: 'SEALER', healthScore: 95, operatingHours: 1675.0 },
  ];

  for (const m of defaultMachinery) {
    await prisma.equipment.upsert({
      where: { companyId_code: { companyId: company.id, code: m.code } },
      update: {},
      create: {
        companyId: company.id,
        code: m.code,
        name: m.name,
        type: m.type,
        status: 'OPERATIONAL',
        healthScore: m.healthScore,
        totalOperatingHours: m.operatingHours,
        lastServicedAt: new Date('2026-11-01'),
        nextMaintenanceDue: new Date('2026-12-01'),
      },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
