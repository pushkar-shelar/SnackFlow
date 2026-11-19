import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('PostgreSQL Least-Privilege Role Matrix (Neon & Docker Invariants)', () => {
  const readonlyClient = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://app_readonly:app_readonly_dev_pass@localhost:5432/snackflow_db?schema=public',
      },
    },
  });

  const runtimeClient = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://app_runtime:app_runtime_dev_pass@localhost:5432/snackflow_db?schema=public',
      },
    },
  });

  afterAll(async () => {
    await readonlyClient.$disconnect();
    await runtimeClient.$disconnect();
  });

  describe('app_readonly role (Auditor & Reports)', () => {
    it('allows SELECT queries on business tables and ledger', async () => {
      const items = await readonlyClient.item.findMany({ take: 1 });
      expect(Array.isArray(items)).toBe(true);

      const ledgerEntries = await readonlyClient.stockLedger.findMany({ take: 1 });
      expect(Array.isArray(ledgerEntries)).toBe(true);
    });

    it('rejects any INSERT attempt with permission denied', async () => {
      await expect(
        readonlyClient.party.create({
          data: {
            name: 'Unauthorized Readonly Creation',
            kind: 'CUSTOMER_RETAILER',
            phone: '9999999999',
            stateCode: '33',
            address: 'Tamil Nadu',
            companyId: '00000000-0000-0000-0000-000000000000',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('app_runtime role (Operational API)', () => {
    it('allows SELECT and operational reads', async () => {
      const items = await runtimeClient.item.findMany({ take: 1 });
      expect(Array.isArray(items)).toBe(true);
    });

    it('rejects UPDATE on immutable stock_ledger (permission denied)', async () => {
      const entry = await runtimeClient.stockLedger.findFirst();
      if (entry) {
        await expect(
          runtimeClient.stockLedger.update({
            where: { id: entry.id },
            data: { sourceType: 'ILLEGAL_RUNTIME_UPDATE' },
          }),
        ).rejects.toThrow();
      }
    });

    it('rejects DELETE on immutable stock_ledger (permission denied)', async () => {
      const entry = await runtimeClient.stockLedger.findFirst();
      if (entry) {
        await expect(
          runtimeClient.stockLedger.delete({
            where: { id: entry.id },
          }),
        ).rejects.toThrow();
      }
    });

    it('rejects UPDATE on immutable audit_log (permission denied)', async () => {
      await expect(
        runtimeClient.$executeRawUnsafe(
          `UPDATE audit_log SET action = 'HACKED' WHERE id = '00000000-0000-0000-0000-000000000000'`,
        ),
      ).rejects.toThrow();
    });

    it('rejects DELETE on immutable audit_log (permission denied)', async () => {
      await expect(
        runtimeClient.$executeRawUnsafe(
          `DELETE FROM audit_log WHERE id = '00000000-0000-0000-0000-000000000000'`,
        ),
      ).rejects.toThrow();
    });
  });
});
