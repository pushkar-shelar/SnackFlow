import { Role } from '../enums/index.js';

export enum Permission {
  // Orders
  ORDER_CREATE = 'order:create',
  ORDER_READ_OWN = 'order:read:own',
  ORDER_READ_ALL = 'order:read:all',
  ORDER_APPROVE = 'order:approve',

  // Invoicing & Dispatch
  INVOICE_POST = 'invoice:post',
  INVOICE_CANCEL = 'invoice:cancel',
  DISPATCH_CREATE = 'dispatch:create',

  // Payments
  PAYMENT_CREATE = 'payment:create',

  // Purchasing & Masters
  PURCHASE_CREATE = 'purchase:create',
  BOM_MANAGE = 'bom:manage',
  MASTER_MANAGE = 'master:manage',

  // Production
  PRODUCTION_RUN = 'production:run',
  PRODUCTION_POST = 'production:post',
  PRODUCTION_CLOSE = 'production:close',
  OVERHEAD_CREATE = 'overhead:create',

  // Reports & Auditing
  REPORT_READ = 'report:read',
  REPORT_EXPORT = 'report:export',
  DASHBOARD_READ = 'dashboard:read',
  AUDIT_READ = 'audit:read',
  USER_MANAGE = 'user:manage',
}

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.SALESMAN]: [
    Permission.ORDER_CREATE,
    Permission.ORDER_READ_OWN,
  ],
  [Role.ADMIN]: [
    Permission.ORDER_READ_ALL,
    Permission.ORDER_APPROVE,
    Permission.INVOICE_POST,
    Permission.INVOICE_CANCEL,
    Permission.DISPATCH_CREATE,
    Permission.PAYMENT_CREATE,
    Permission.BOM_MANAGE,
    Permission.MASTER_MANAGE,
    Permission.OVERHEAD_CREATE,
    Permission.PRODUCTION_CLOSE,
    Permission.REPORT_READ,
    Permission.REPORT_EXPORT,
  ],
  [Role.PRODUCTION]: [
    Permission.PURCHASE_CREATE,
    Permission.PRODUCTION_RUN,
    Permission.PRODUCTION_POST,
    Permission.BOM_MANAGE,
    Permission.OVERHEAD_CREATE,
    Permission.PRODUCTION_CLOSE,
    Permission.REPORT_READ, // Stock and production reports
  ],
  [Role.AUDITOR]: [
    Permission.REPORT_READ,
    Permission.REPORT_EXPORT,
    Permission.AUDIT_READ,
    // Zero mutating permissions
  ],
  [Role.OWNER]: [
    Permission.ORDER_READ_ALL,
    Permission.INVOICE_CANCEL,
    Permission.MASTER_MANAGE,
    Permission.OVERHEAD_CREATE,
    Permission.PRODUCTION_CLOSE,
    Permission.REPORT_READ,
    Permission.REPORT_EXPORT,
    Permission.DASHBOARD_READ,
    Permission.AUDIT_READ,
    Permission.USER_MANAGE,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
