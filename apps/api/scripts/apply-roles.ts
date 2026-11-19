import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  console.log('Applying least-privilege roles (app_runtime, app_readonly)...');

  // Create roles if not exist
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
        CREATE ROLE app_runtime WITH LOGIN PASSWORD 'app_runtime_dev_pass';
      END IF;
    END
    $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_readonly') THEN
        CREATE ROLE app_readonly WITH LOGIN PASSWORD 'app_readonly_dev_pass';
      END IF;
    END
    $$;
  `);

  // Grant schema usage
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO app_runtime;`);
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO app_readonly;`);

  // app_readonly: SELECT only
  await prisma.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;`);
  await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly;`);

  // app_runtime: business CRUD
  await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;`);
  await prisma.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;`);

  // Defence in depth: Revoke UPDATE/DELETE on immutable tables
  await prisma.$executeRawUnsafe(`REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.stock_ledger FROM app_runtime;`);
  await prisma.$executeRawUnsafe(`REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_log FROM app_runtime;`);

  await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;`);
  await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;`);

  console.log('✅ Successfully applied least-privilege roles (app_runtime, app_readonly).');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Failed to apply roles:', err);
  process.exit(1);
});
