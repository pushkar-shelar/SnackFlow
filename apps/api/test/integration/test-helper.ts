import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@snackflow/shared';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  jwtService: JwtService;
  companyId: string;
  users: Record<Role, { id: string; email: string; token: string }>;
  parties: {
    retailerA: any;
    distributorB: any;
  };
  items: {
    fgMurukku: any;
    rmFlour: any;
    rmOil: any;
    pmPouch: any;
  };
}

export async function createTestContext(): Promise<TestContext> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);
  const jwtService = app.get(JwtService);

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error('Database not seeded! Please run prisma seed.');
  }

  const dbUsers = await prisma.user.findMany({
    where: { companyId: company.id },
  });

  const users = {} as Record<Role, { id: string; email: string; token: string }>;

  for (const role of [Role.ADMIN, Role.SALESMAN, Role.PRODUCTION, Role.AUDITOR, Role.OWNER]) {
    const user = dbUsers.find((u) => u.role === role);
    if (!user) {
      throw new Error(`Seeded user for role ${role} not found`);
    }

    const token = jwtService.sign({
      userId: user.id,
      companyId: company.id,
      email: user.email,
      role: user.role,
    });

    users[role] = {
      id: user.id,
      email: user.email,
      token,
    };
  }

  const retailerA = await prisma.party.findFirst({
    where: { companyId: company.id, name: { contains: 'Retailer A' } },
  });
  const distributorB = await prisma.party.findFirst({
    where: { companyId: company.id, name: { contains: 'Distributor B' } },
  });

  const fgMurukku = await prisma.item.findFirst({
    where: { companyId: company.id, sku: 'FG-MUR-200G' },
  });
  const rmFlour = await prisma.item.findFirst({
    where: { companyId: company.id, sku: 'RAW-FLOUR' },
  });
  const rmOil = await prisma.item.findFirst({
    where: { companyId: company.id, sku: 'RAW-OIL' },
  });
  const pmPouch = await prisma.item.findFirst({
    where: { companyId: company.id, sku: 'PKG-POUCH-200G' },
  });

  return {
    app,
    prisma,
    jwtService,
    companyId: company.id,
    users,
    parties: { retailerA, distributorB },
    items: { fgMurukku, rmFlour, rmOil, pmPouch },
  };
}

export async function resetSalesAndStock(ctx: TestContext) {
  await ctx.prisma.dispatchLine.deleteMany();
  await ctx.prisma.dispatch.deleteMany();
  await ctx.prisma.creditNote.deleteMany();
  await ctx.prisma.paymentAllocation.deleteMany();
  await ctx.prisma.payment.deleteMany();
  await ctx.prisma.invoiceLine.deleteMany();
  await ctx.prisma.invoice.deleteMany();
  await ctx.prisma.stockReservation.deleteMany();
  await ctx.prisma.salesOrderLine.deleteMany();
  await ctx.prisma.salesOrder.deleteMany();

  // Reset non-opening batches qty to 0 (so FEFO only sees opening batch)
  await ctx.prisma.stockBalance.updateMany({
    where: {
      companyId: ctx.companyId,
      itemId: ctx.items.fgMurukku.id,
      batch: { batchNo: { not: 'OPENING' } },
    },
    data: { qty: 0, value: 0 },
  });

  // Reset opening FG stock to 50 packets
  const fgBal = await ctx.prisma.stockBalance.findFirst({
    where: {
      companyId: ctx.companyId,
      itemId: ctx.items.fgMurukku.id,
      batch: { batchNo: 'OPENING' },
    },
  });
  if (fgBal) {
    await ctx.prisma.stockBalance.update({
      where: { id: fgBal.id },
      data: { qty: 50, value: 50 * 20 },
    });
  }
}
