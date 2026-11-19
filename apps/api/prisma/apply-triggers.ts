import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function applyTriggers() {
  console.log('Applying append-only immutability trigger on stock_ledger...');

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION prevent_stock_ledger_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Immutability violation: stock_ledger entries cannot be updated or deleted';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS trg_stock_ledger_append_only ON stock_ledger;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_stock_ledger_append_only
    BEFORE UPDATE OR DELETE ON stock_ledger
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_ledger_mutation();
  `);

  console.log('Successfully applied stock_ledger append-only trigger!');
}

if (require.main === module) {
  applyTriggers()
    .catch((err) => {
      console.error('Failed to apply triggers:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
