import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function applyTriggers() {
  console.log('Applying append-only immutability triggers, partial unique indexes, and CHECK constraints...');

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

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Immutability violation: audit_log entries cannot be updated or deleted';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_audit_log_append_only
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_mutation();
  `);

  // Enforce uniqueness for raw/packaging stock_balance rows where batch_id IS NULL
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_balance_company_item_null_batch
    ON stock_balance (company_id, item_id)
    WHERE batch_id IS NULL;
  `);

  // Domain integrity CHECK constraints (idempotent)
  const checkStatements = [
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_balance_qty_nonneg') THEN ALTER TABLE stock_balance ADD CONSTRAINT chk_stock_balance_qty_nonneg CHECK (qty >= 0); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_ledger_qty_nonneg') THEN ALTER TABLE stock_ledger ADD CONSTRAINT chk_stock_ledger_qty_nonneg CHECK (qty_in >= 0 AND qty_out >= 0); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sales_order_line_nonneg') THEN ALTER TABLE sales_order_line ADD CONSTRAINT chk_sales_order_line_nonneg CHECK (qty >= 0 AND rate >= 0); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_total_nonneg') THEN ALTER TABLE invoice ADD CONSTRAINT chk_invoice_total_nonneg CHECK (total >= 0); END IF; END $$;`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_amount_pos') THEN ALTER TABLE payment ADD CONSTRAINT chk_payment_amount_pos CHECK (amount > 0); END IF; END $$;`,
  ];

  for (const sql of checkStatements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('Successfully applied triggers, NULL-batch partial index, and CHECK constraints!');
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
