-- 01-roles.sql: Idempotent role creation and least-privilege grants for SnackFlow (Local Docker)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime WITH LOGIN PASSWORD 'app_runtime_dev_pass';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_readonly') THEN
    CREATE ROLE app_readonly WITH LOGIN PASSWORD 'app_readonly_dev_pass';
  END IF;
END
$$;

-- Schema usage
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_readonly;

-- app_readonly privileges: Strict SELECT only on all current and future tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly;

-- app_runtime privileges: Full operational access, but explicit REVOKE on immutable tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- Defence in Depth: explicitly revoke UPDATE/DELETE on immutable audit and stock ledger tables
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.stock_ledger FROM app_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_log FROM app_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
