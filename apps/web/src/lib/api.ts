const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: 'SALESMAN' | 'ADMIN' | 'PRODUCTION' | 'AUDITOR' | 'OWNER';
  companyId: string;
  token: string;
}

export const SEEDED_ACCOUNTS = [
  { role: 'SALESMAN', name: 'Karthik (Salesman)', email: 'salesman@snackflow.local', path: '/sales', description: 'Field sales orders, offline mobile PWA' },
  { role: 'SALESMAN', name: 'Salesman B', email: 'salesmanb@snackflow.local', path: '/sales', description: 'Territory B field sales orders, offline mobile PWA' },
  { role: 'ADMIN', name: 'Meenakshi (Admin)', email: 'admin@snackflow.local', path: '/admin/orders', description: 'Order approval, invoicing & dispatch' },
  { role: 'PRODUCTION', name: 'Raman (Supervisor)', email: 'production@snackflow.local', path: '/production', description: 'Batch execution, yield & variance wizard' },
  { role: 'AUDITOR', name: 'Sundaram & Co (Auditor)', email: 'auditor@snackflow.local', path: '/audit', description: 'Statutory compliance & stock ledger drill-down' },
  { role: 'OWNER', name: 'Annamalai (Owner)', email: 'owner@snackflow.local', path: '/owner', description: 'Executive margin control & P&L sensitivity' },
] as const;

export function getStoredSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('snackflow_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredSession(session: UserSession | null): void {
  if (typeof window === 'undefined') return;
  if (session) {
    localStorage.setItem('snackflow_session', JSON.stringify(session));
  } else {
    localStorage.removeItem('snackflow_session');
  }
  window.dispatchEvent(new Event('snackflow-session-change'));
}

/**
 * Returns true if running in an HTTPS browser environment while API_BASE_URL points to localhost.
 * In this scenario, calling localhost causes browser Mixed Content / ERR_CONNECTION_REFUSED.
 */
function shouldBypassLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'https:' &&
    API_BASE_URL.startsWith('http://localhost')
  );
}

export async function login(email: string, password: string = 'Password123!'): Promise<UserSession> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Attempt live API login when live backend URL is reachable
  if (!shouldBypassLocalhost()) {
    let networkUnreachable = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
        credentials: 'include',
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const data = await res.json();
        const session: UserSession = {
          userId: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          companyId: data.user.companyId,
          token: data.accessToken,
        };
        setStoredSession(session);
        return session;
      }

      // Server responded (e.g. 401/400/403): NEVER bypass authentication via mock fallback
      setStoredSession(null);
      const errBody = await res.json().catch(() => ({}));
      const fieldErrors = Array.isArray(errBody.errors) && errBody.errors.length > 0
        ? `: ${errBody.errors.map((e: any) => `${e.field}: ${e.message}`).join('; ')}`
        : '';
      throw new Error((errBody.detail || errBody.message || 'Invalid email or password') + fieldErrors);
    } catch (err: any) {
      if (err?.name === 'AbortError' || err instanceof TypeError) {
        networkUnreachable = true;
      } else {
        throw err;
      }
    }

    if (!networkUnreachable) {
      throw new Error('Authentication failed');
    }
  }

  // 2. Demo offline fallback strictly for unreachable offline demo environments with demo password
  if (password === 'Password123!' && (shouldBypassLocalhost() || process.env.NEXT_PUBLIC_ALLOW_OFFLINE_DEMO === 'true')) {
    const seeded = SEEDED_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === cleanEmail,
    );

    if (seeded) {
      const session: UserSession = {
        userId: `user-${seeded.role.toLowerCase()}`,
        name: seeded.name,
        email: seeded.email,
        role: seeded.role,
        companyId: '00000000-0000-0000-0000-000000000001',
        token: `demo-jwt-token-${seeded.role.toLowerCase()}`,
      };
      setStoredSession(session);
      return session;
    }
  }

  throw new Error('Invalid email or password. Please verify your credentials.');
}

export const loginAs = (email: string) => login(email, 'Password123!');

export function logout(): void {
  setStoredSession(null);
}

// Benchmark Mock Dataset matching Neon PostgreSQL seed
const MOCK_PARTIES = [
  {
    id: '00000000-0000-0000-0000-000000000030',
    name: 'Sri Murugan Stores (Retailer A)',
    kind: 'CUSTOMER_RETAILER',
    gstin: '33AABCS1234A1Z7',
    stateCode: '33',
    address: 'Shop 14, Main Bazaar, Tiruchirappalli, Tamil Nadu 620001',
    creditDays: 30,
    outstandingPaise: 450000,
    creditLimitPaise: 1000000,
  },
  {
    id: '00000000-0000-0000-0000-000000000031',
    name: 'Bangalore Snacks Wholesale (Distributor B)',
    kind: 'CUSTOMER_DISTRIBUTOR',
    gstin: '29AABCB5678B1Z6',
    stateCode: '29',
    address: 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka 560022',
    creditDays: 45,
    outstandingPaise: 1200000,
    creditLimitPaise: 2500000,
  },
  {
    id: '00000000-0000-0000-0000-000000000032',
    name: 'Madurai Sri Krishna Sweets & Bakery',
    kind: 'CUSTOMER_RETAILER',
    gstin: '33AABCK9988C1Z2',
    stateCode: '33',
    address: 'West Masi Street, Madurai, Tamil Nadu 625001',
    creditDays: 21,
    outstandingPaise: 210000,
    creditLimitPaise: 800000,
  },
  {
    id: '00000000-0000-0000-0000-000000000033',
    name: 'Kovai Crisps Corner',
    kind: 'CUSTOMER_RETAILER',
    gstin: '33AABCC1122D1Z9',
    stateCode: '33',
    address: 'Cross Cut Road, Gandhipuram, Coimbatore 641012',
    creditDays: 30,
    outstandingPaise: 380000,
    creditLimitPaise: 1200000,
  },
];

const MOCK_ITEMS = [
  { id: 'fg-mur-200g', sku: 'FG-MUR-200G', name: 'Murukku 200g (முறுக்கு)', kind: 'FINISHED', baseUom: 'PKT', hsn: '21069099', gstRate: 5.0, rate: 50.0, netWeightG: 200.0, shelfLifeDays: 90 },
  { id: 'fg-rib-200g', sku: 'FG-RIB-200G', name: 'Ribbon Pakoda 200g (ரிப்பன் பக்கோடா)', kind: 'FINISHED', baseUom: 'PKT', hsn: '21069099', gstRate: 5.0, rate: 50.0, netWeightG: 200.0, shelfLifeDays: 75 },
  { id: 'raw-flour', sku: 'RAW-FLOUR', name: 'Rice Flour (அரிசி மாவு)', kind: 'RAW', baseUom: 'KG', hsn: '11029000', gstRate: 5.0, rate: 42.0 },
  { id: 'raw-oil', sku: 'RAW-OIL', name: 'Cooking Oil (எண்ணெய்)', kind: 'RAW', baseUom: 'L', hsn: '15121910', gstRate: 5.0, rate: 140.0 },
  { id: 'raw-spice', sku: 'RAW-SPICE', name: 'Spice Mix (மசாலா)', kind: 'RAW', baseUom: 'KG', hsn: '09109929', gstRate: 5.0, rate: 200.0 },
  { id: 'pkg-pouch', sku: 'PKG-POUCH-200G', name: 'Printed Pouches 200g', kind: 'PACKAGING', baseUom: 'PCS', hsn: '39232100', gstRate: 18.0, rate: 2.5 },
  { id: 'pkg-carton', sku: 'PKG-CARTON-20PKT', name: 'Corrugated Cartons (20 PKT)', kind: 'PACKAGING', baseUom: 'PCS', hsn: '48191010', gstRate: 12.0, rate: 15.0 },
];

export const MOCK_STOCK_BALANCES = [
  { itemId: 'raw-flour', sku: 'RAW-FLOUR', name: 'Rice Flour (அரிசி மாவு)', kind: 'RAW', uom: 'KG', qty: 120.0, wac: 43.125, value: 5175.0 },
  { itemId: 'raw-oil', sku: 'RAW-OIL', name: 'Cooking Oil (எண்ணெய்)', kind: 'RAW', uom: 'L', qty: 19.5, wac: 140.0, value: 2730.0 },
  { itemId: 'raw-spice', sku: 'RAW-SPICE', name: 'Spice Mix (மசாலா)', kind: 'RAW', uom: 'KG', qty: 3.8, wac: 200.0, value: 760.0 },
  { itemId: 'pkg-pouch', sku: 'PKG-POUCH-200G', name: 'Printed Pouches 200g', kind: 'PACKAGING', uom: 'PCS', qty: 306.0, wac: 2.5, value: 765.0 },
  { itemId: 'pkg-carton', sku: 'PKG-CARTON-20PKT', name: 'Corrugated Cartons (20 PKT)', kind: 'PACKAGING', uom: 'PCS', qty: 21.0, wac: 15.0, value: 315.0 },
  { itemId: 'fg-mur-200g', sku: 'FG-MUR-200G', name: 'Murukku 200g (முறுக்கு)', kind: 'FINISHED', uom: 'PKT', qty: 88.0, wac: 31.144, value: 2740.67 },
  { itemId: 'fg-rib-200g', sku: 'FG-RIB-200G', name: 'Ribbon Pakoda 200g (ரிப்பன் பக்கோடா)', kind: 'FINISHED', uom: 'PKT', qty: 0.0, wac: 32.0, value: 0.0 },
];

export const MOCK_STOCK_LEDGER = [
  { id: 'ledger-01', itemId: 'raw-flour', sku: 'RAW-FLOUR', itemName: 'Rice Flour (அரிசி மாவு)', movementType: 'RAW_IN', qty: 120.0, rate: 43.125, totalValue: 5175.0, batchNo: 'GRN-2026-001', txnAt: '2026-11-20T08:30:00Z', auditHash: '#sha256-a1f9' },
  { id: 'ledger-02', itemId: 'raw-oil', sku: 'RAW-OIL', itemName: 'Cooking Oil (எண்ணெய்)', movementType: 'RAW_IN', qty: 19.5, rate: 140.0, totalValue: 2730.0, batchNo: 'GRN-2026-002', txnAt: '2026-11-20T08:30:00Z', auditHash: '#sha256-b2e8' },
  { id: 'ledger-03', itemId: 'raw-spice', sku: 'RAW-SPICE', itemName: 'Spice Mix (மசாலா)', movementType: 'RAW_IN', qty: 3.8, rate: 200.0, totalValue: 760.0, batchNo: 'GRN-2026-003', txnAt: '2026-11-20T08:30:00Z', auditHash: '#sha256-c3d7' },
  { id: 'ledger-04', itemId: 'pkg-pouch', sku: 'PKG-POUCH-200G', itemName: 'Printed Pouches 200g', movementType: 'PKG_IN', qty: 306.0, rate: 2.5, totalValue: 765.0, batchNo: 'GRN-2026-004', txnAt: '2026-11-20T08:30:00Z', auditHash: '#sha256-d4c6' },
  { id: 'ledger-05', itemId: 'fg-mur-200g', sku: 'FG-MUR-200G', itemName: 'Murukku 200g (முறுக்கு)', movementType: 'PROD_IN', qty: 88.0, rate: 31.144, totalValue: 2740.67, batchNo: 'MUR200-261120-00', txnAt: '2026-11-20T09:00:00Z', auditHash: '#sha256-e5b5' },
];

const MOCK_ORDERS = [
  {
    id: 'ord-001',
    number: 'SO-2026-0001',
    clientUuid: 'a1b2c3d4-e5f6-4a1b-8c2d-9e0f1a2b3c4d',
    status: 'SUBMITTED',
    grandTotal: 7500.0,
    totalAmount: 7500.0,
    taxableTotal: 7142.86,
    taxTotal: 357.14,
    salesman: {
      id: 'user-salesman',
      name: 'Karthik (Salesman)',
      email: 'salesman@snackflow.local',
    },
    party: {
      id: '00000000-0000-0000-0000-000000000030',
      name: 'Sri Murugan Stores (Retailer A)',
      gstin: '33AABCS1234A1Z7',
      stateCode: '33',
      address: 'Shop 14, Main Bazaar, Tiruchirappalli, Tamil Nadu',
    },
    lines: [
      {
        id: 'line-01',
        itemId: 'fg-mur-200g',
        item: { name: 'Murukku 200g (முறுக்கு)', sku: 'FG-MUR-200G', baseUom: 'PKT' },
        qty: 150,
        uom: 'PKT',
        rate: 50.0,
        taxable: 7142.86,
        total: 7500.0,
        stockCoverage: 'COVERED',
      },
    ],
    invoices: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ord-002',
    number: 'SO-2026-0002',
    clientUuid: 'f5e4d3c2-b1a0-4f5e-9d8c-7b6a5f4e3d2c',
    status: 'APPROVED',
    grandTotal: 13000.0,
    totalAmount: 13000.0,
    taxableTotal: 11607.14,
    taxTotal: 1392.86,
    salesman: {
      id: 'user-salesman',
      name: 'Karthik (Salesman)',
      email: 'salesman@snackflow.local',
    },
    party: {
      id: '00000000-0000-0000-0000-000000000031',
      name: 'Bangalore Snacks Wholesale (Distributor B)',
      gstin: '29AABCB5678B1Z6',
      stateCode: '29',
      address: 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka',
    },
    lines: [
      {
        id: 'line-02',
        itemId: 'fg-rib-200g',
        item: { name: 'Ribbon Pakoda 200g (ரிப்பன் பக்கோடா)', sku: 'FG-RIB-200G', baseUom: 'PKT' },
        qty: 200,
        uom: 'PKT',
        rate: 50.0,
        taxable: 9523.81,
        total: 10000.0,
        stockCoverage: 'COVERED',
      },
    ],
    invoices: [
      {
        id: 'inv-001',
        number: 'INV/2026-27/0001',
        total: 10000.0,
        status: 'POSTED',
      },
    ],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'ord-003',
    number: 'SO-2026-0003',
    clientUuid: 'c3d2e1f0-a9b8-4c3d-8e7f-6a5b4c3d2e1f',
    status: 'SUBMITTED',
    grandTotal: 5000.0,
    totalAmount: 5000.0,
    taxableTotal: 4761.9,
    taxTotal: 238.1,
    salesman: {
      id: 'user-salesman',
      name: 'Karthik (Salesman)',
      email: 'salesman@snackflow.local',
    },
    party: {
      id: '00000000-0000-0000-0000-000000000032',
      name: 'Madurai Sri Krishna Sweets & Bakery',
      gstin: '33AABCK9988C1Z2',
      stateCode: '33',
      address: 'West Masi Street, Madurai, Tamil Nadu',
    },
    lines: [
      {
        id: 'line-03',
        itemId: 'fg-rib-200g',
        item: { name: 'Ribbon Pakoda 200g (ரிப்பன் பக்கோடா)', sku: 'FG-RIB-200G', baseUom: 'PKT' },
        qty: 100,
        uom: 'PKT',
        rate: 50.0,
        taxable: 4761.9,
        total: 5000.0,
        stockCoverage: 'OUT_OF_STOCK',
      },
    ],
    invoices: [],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

const MOCK_EQUIPMENT = [
  {
    id: 'eq-mixer-01',
    code: 'EQ-MIXER-01',
    name: 'Dough Kneader & Flour Blender 50kg',
    type: 'MIXER',
    status: 'OPERATIONAL',
    healthScore: 96,
    totalOperatingHours: 1420.5,
    nextMaintenanceDue: '2026-12-01',
    downtimes: [],
  },
  {
    id: 'eq-extruder-01',
    code: 'EQ-EXTRUDER-01',
    name: 'Traditional Murukku Hydraulic Press / Extruder',
    type: 'EXTRUDER',
    status: 'OPERATIONAL',
    healthScore: 92,
    totalOperatingHours: 1850.0,
    nextMaintenanceDue: '2026-12-05',
    downtimes: [],
  },
  {
    id: 'eq-fryer-01',
    code: 'EQ-FRYER-01',
    name: 'Continuous Gas Deep Fryer with Heat Exchanger',
    type: 'FRYER',
    status: 'OPERATIONAL',
    healthScore: 88,
    totalOperatingHours: 2110.0,
    nextMaintenanceDue: '2026-12-10',
    downtimes: [
      {
        id: 'dt-01',
        category: 'SCHEDULED_CLEANING',
        reason: 'Oil filtering and heating coil cleaning',
        startTime: '2026-11-20T08:00:00Z',
        endTime: '2026-11-20T09:30:00Z',
        durationMinutes: 90,
      },
    ],
  },
  {
    id: 'eq-sealer-01',
    code: 'EQ-SEALER-01',
    name: 'Continuous Band Nitrogen Flushing Pouch Sealer',
    type: 'SEALER',
    status: 'OPERATIONAL',
    healthScore: 95,
    totalOperatingHours: 1675.0,
    nextMaintenanceDue: '2026-12-15',
    downtimes: [],
  },
];

const MOCK_APPLICATIONS = [
  {
    id: 'app-001',
    storeName: 'Madurai Sri Meenakshi Sweets & Bakery',
    contactPerson: 'Sundarapandian',
    phone: '+91 94431 22334',
    address: '12 East Veli Street, Madurai, Tamil Nadu 625001',
    gstin: '33AABCM5566A1Z4',
    geoLat: 9.9195,
    geoLng: 78.1193,
    status: 'PENDING',
    salesman: { name: 'Karthik (Salesman)' },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'app-002',
    storeName: 'Trichy Ananda Vilas Hot Chips',
    contactPerson: 'Muthukrishnan',
    phone: '+91 98424 55667',
    address: '45 Salai Road, Woraiyur, Tiruchirappalli 620003',
    gstin: '33AABCT7788B1Z8',
    geoLat: 10.8271,
    geoLng: 78.6946,
    status: 'APPROVED',
    creditLimit: 25000,
    creditDays: 30,
    salesman: { name: 'Karthik (Salesman)' },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

function getStoredApplications(): any[] {
  if (typeof window === 'undefined') return MOCK_APPLICATIONS;
  try {
    const raw = localStorage.getItem('snackflow_applications');
    if (raw) return JSON.parse(raw);
  } catch {}
  return MOCK_APPLICATIONS;
}

function saveStoredApplications(apps: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('snackflow_applications', JSON.stringify(apps));
  } catch {}
}

function getStoredParties(): any[] {
  if (typeof window === 'undefined') return MOCK_PARTIES;
  try {
    const raw = localStorage.getItem('snackflow_parties');
    if (raw) return JSON.parse(raw);
  } catch {}
  return MOCK_PARTIES;
}

function saveStoredParties(parties: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('snackflow_parties', JSON.stringify(parties));
  } catch {}
}

function getStoredStockBalances(): any[] {
  if (typeof window === 'undefined') return MOCK_STOCK_BALANCES;
  try {
    const raw = localStorage.getItem('snackflow_stock_balances');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Exclude removed products from old localStorage
        const allowedItemIds = ['raw-flour', 'raw-oil', 'raw-spice', 'pkg-pouch', 'pkg-carton', 'fg-mur-200g', 'fg-rib-200g'];
        return parsed.filter((b: any) => allowedItemIds.includes(b.itemId || b.id || b.sku?.toLowerCase()));
      }
    }
  } catch {}
  return MOCK_STOCK_BALANCES;
}

function saveStoredStockBalances(balances: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('snackflow_stock_balances', JSON.stringify(balances));
  } catch {}
}

function getStoredStockLedger(): any[] {
  if (typeof window === 'undefined') return MOCK_STOCK_LEDGER;
  try {
    const raw = localStorage.getItem('snackflow_stock_ledger');
    if (raw) return JSON.parse(raw);
  } catch {}
  return MOCK_STOCK_LEDGER;
}

function saveStoredStockLedger(ledger: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('snackflow_stock_ledger', JSON.stringify(ledger));
  } catch {}
}

function computeOrderStockCoverage(order: any, balances: any[]): any {
  let hasShortage = false;
  let hasFullCoverage = true;

  const lines = (order.lines || []).map((line: any) => {
    const bal = balances.find(
      (b: any) =>
        b.itemId === line.itemId ||
        b.sku === line.item?.sku ||
        (line.item?.name && b.name.includes(line.item.name.split(' ')[0]))
    );
    const onHand = bal ? Number(bal.qty) : 0;
    const required = Number(line.qty);

    let lineCoverage = 'COVERED';
    if (onHand <= 0) {
      lineCoverage = 'OUT_OF_STOCK';
      hasShortage = true;
      hasFullCoverage = false;
    } else if (onHand < required) {
      lineCoverage = 'PARTIAL';
      hasShortage = true;
      hasFullCoverage = false;
    }

    return {
      ...line,
      onHandQty: onHand,
      stockCoverage: lineCoverage,
    };
  });

  return {
    ...order,
    lines,
    hasShortage,
    hasFullCoverage,
    overallCoverage: hasFullCoverage
      ? 'COVERED'
      : lines.every((l: any) => l.stockCoverage === 'OUT_OF_STOCK')
      ? 'OUT_OF_STOCK'
      : 'PARTIAL',
  };
}

function getStoredOrders(): any[] {
  const balances = getStoredStockBalances();
  let orders = MOCK_ORDERS;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('snackflow_orders');
      if (raw) orders = JSON.parse(raw);
    } catch {}
  }
  return orders.map((ord: any) => computeOrderStockCoverage(ord, balances));
}

function saveStoredOrders(orders: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('snackflow_orders', JSON.stringify(orders));
  } catch {}
}

function getStoredEquipment(): any[] {
  if (typeof window === 'undefined') return MOCK_EQUIPMENT;
  try {
    const raw = localStorage.getItem('snackflow_equipment');
    if (raw) return JSON.parse(raw);
  } catch {}
  return MOCK_EQUIPMENT;
}

function saveStoredEquipment(equipment: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('snackflow_equipment', JSON.stringify(equipment));
  } catch {}
}

function getMockFallback(endpoint: string, options: RequestInit = {}): any {
  const path = endpoint.split('?')[0] || '';

  // Store onboarding applications
  if (path === '/parties/applications' || path.startsWith('/parties/applications/')) {
    const apps = getStoredApplications();

    // POST /parties/applications/:id/approve
    const approveMatch = path.match(/\/parties\/applications\/([^/]+)\/approve/);
    if (approveMatch) {
      const appId = approveMatch[1];
      let body: any = {};
      try {
        if (typeof options.body === 'string') body = JSON.parse(options.body);
      } catch {}

      const updated = apps.map((a) =>
        a.id === appId
          ? {
              ...a,
              status: 'APPROVED',
              creditLimit: body.creditLimit || 15000,
              creditDays: body.creditDays || 30,
            }
          : a
      );
      saveStoredApplications(updated);

      // Add to parties master list
      const approvedApp = updated.find((a) => a.id === appId);
      if (approvedApp) {
        const parties = getStoredParties();
        if (!parties.some((p) => p.name === approvedApp.storeName)) {
          parties.push({
            id: `party-${approvedApp.id}`,
            name: approvedApp.storeName,
            kind: 'CUSTOMER_RETAILER',
            gstin: approvedApp.gstin || '33AABCM0000A1Z5',
            stateCode: '33',
            address: approvedApp.address,
            creditDays: approvedApp.creditDays || 30,
            outstandingPaise: 0,
            creditLimitPaise: (approvedApp.creditLimit || 15000) * 100,
          });
          saveStoredParties(parties);
        }
      }
      return { success: true, status: 'APPROVED' };
    }

    // POST /parties/applications/:id/reject
    const rejectMatch = path.match(/\/parties\/applications\/([^/]+)\/reject/);
    if (rejectMatch) {
      const appId = rejectMatch[1];
      const updated = apps.map((a) => (a.id === appId ? { ...a, status: 'REJECTED' } : a));
      saveStoredApplications(updated);
      return { success: true, status: 'REJECTED' };
    }

    // POST /parties/applications (New application from salesman)
    if (options.method === 'POST') {
      let body: any = {};
      try {
        if (typeof options.body === 'string') body = JSON.parse(options.body);
      } catch {}

      const newApp = {
        id: `app-${Date.now()}`,
        storeName: body.storeName || 'New Store',
        contactPerson: body.contactPerson || '',
        phone: body.phone || '',
        address: body.address || '',
        gstin: body.gstin || '',
        geoLat: body.geoLat,
        geoLng: body.geoLng,
        status: 'PENDING',
        salesman: { name: 'Karthik (Salesman)' },
        createdAt: new Date().toISOString(),
      };
      const updated = [newApp, ...apps];
      saveStoredApplications(updated);
      return { success: true, application: newApp };
    }

    // GET /parties/applications
    return apps;
  }

  if (path === '/parties' || path.startsWith('/parties/')) {
    return getStoredParties();
  }
  if (path === '/catalog/items' || path.startsWith('/catalog/items/')) {
    if (endpoint.includes('kind=FINISHED')) {
      return MOCK_ITEMS.filter((i) => i.kind === 'FINISHED');
    }
    return MOCK_ITEMS;
  }
  if (path === '/orders' || path.startsWith('/orders/')) {
    const orders = getStoredOrders();

    // POST /orders/:id/approve
    const approveMatch = path.match(/\/orders\/([^/]+)\/approve/);
    if (approveMatch) {
      const orderId = approveMatch[1];
      let body: any = {};
      try {
        if (typeof options.body === 'string') body = JSON.parse(options.body);
      } catch {}

      const order = orders.find((o) => o.id === orderId);
      if (body.action === 'APPROVE_FULL' && order?.hasShortage) {
        throw new Error(
          'Mandatory Stock Gate: Cannot approve full order because items are OUT OF STOCK or insufficient on hand. Please use "Approve Available & Backorder" or "Hold".'
        );
      }

      const nextStatus =
        body.action === 'REJECT'
          ? 'REJECTED'
          : body.action === 'HOLD'
          ? 'HOLD'
          : body.action === 'APPROVE_AVAILABLE_BACKORDER'
          ? 'PARTIALLY_APPROVED'
          : 'APPROVED';

      const updated = orders.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o));
      saveStoredOrders(updated);
      return { success: true, status: nextStatus };
    }

    // POST /orders (New order from salesman)
    if (options.method === 'POST') {
      let body: any = {};
      try {
        if (typeof options.body === 'string') body = JSON.parse(options.body);
      } catch {}

      const parties = getStoredParties();
      const party = parties.find((p) => p.id === body.partyId) || parties[0] || {
        id: body.partyId || 'party-new',
        name: 'Selected Retailer',
        gstin: '33AABCM1234F1Z0',
        stateCode: '33',
        address: 'Tiruchirappalli, Tamil Nadu',
      };

      const items = MOCK_ITEMS;
      const lines = (body.lines || []).map((l: any, idx: number) => {
        const item = items.find((i) => i.id === l.itemId) || {
          name: l.itemName || 'Snack Item',
          sku: 'FG-SNK-01',
          baseUom: 'PKT',
        };
        const taxable = Number(l.qty) * Number(l.rate);
        return {
          id: `line-${idx + 1}`,
          itemId: l.itemId,
          item,
          qty: Number(l.qty),
          uom: l.uom || 'PKT',
          rate: Number(l.rate),
          taxable,
          total: taxable * 1.05,
          stockCoverage: 'COVERED',
        };
      });

      const taxableTotal = lines.reduce((acc: number, l: any) => acc + l.taxable, 0);
      const taxTotal = taxableTotal * 0.05;
      const grandTotal = taxableTotal + taxTotal;

      const newOrder = {
        id: `ord-${Date.now()}`,
        number: `SO-2026-${String(orders.length + 1).padStart(4, '0')}`,
        clientUuid: body.clientUuid || `uuid-${Date.now()}`,
        status: 'SUBMITTED',
        grandTotal,
        totalAmount: grandTotal,
        taxableTotal,
        taxTotal,
        salesman: {
          id: 'user-salesman',
          name: 'Karthik (Salesman)',
          email: 'salesman@snackflow.local',
        },
        party,
        lines,
        invoices: [],
        createdAt: new Date().toISOString(),
      };

      const updated = [newOrder, ...orders];
      saveStoredOrders(updated);
      return { success: true, number: newOrder.number, order: newOrder };
    }

    // GET /orders/:id
    const idMatch = path.match(/\/orders\/([^/]+)/);
    if (idMatch && idMatch[1]) {
      const found = orders.find((o) => o.id === idMatch[1]);
      if (found) return found;
      return orders[0];
    }

    // GET /orders
    return orders;
  }

  if (path === '/invoices' && options.method === 'POST') {
    let body: any = {};
    try {
      if (typeof options.body === 'string') body = JSON.parse(options.body);
    } catch {}

    const orders = getStoredOrders();
    const order = orders.find((o) => o.id === body.orderId) || orders[0];
    const invNo = `INV/2026-27/${String(Date.now()).slice(-4)}`;
    const invoice = {
      id: `inv-${Date.now()}`,
      number: invNo,
      total: order ? order.grandTotal : 7500.0,
      status: 'POSTED',
      createdAt: new Date().toISOString(),
    };

    if (order) {
      order.status = 'INVOICED';
      order.invoices = [...(order.invoices || []), invoice];
      saveStoredOrders([...orders]);
    }

    return invoice;
  }

  if (path === '/dispatches' && options.method === 'POST') {
    let body: any = {};
    try {
      if (typeof options.body === 'string') body = JSON.parse(options.body);
    } catch {}

    const orders = getStoredOrders();
    const order = orders.find((o) => o.invoices?.some((i: any) => i.id === body.invoiceId)) || orders[0];
    const dispatchNo = `DISP/2026-27/${String(Date.now()).slice(-4)}`;

    if (order) {
      order.status = 'DISPATCHED';
      saveStoredOrders([...orders]);

      // Deduct Finished Goods from stock balances and record in stock ledger
      const balances = getStoredStockBalances();
      const ledger = getStoredStockLedger();
      const nowIso = new Date().toISOString();

      (order.lines || []).forEach((line: any) => {
        const bal = balances.find(
          (b: any) =>
            b.itemId === line.itemId ||
            b.sku === line.item?.sku ||
            (line.item?.name && b.name.includes(line.item.name.split(' ')[0]))
        );
        const qtyDispatched = Number(line.qty) || 0;
        if (bal) {
          bal.qty = Math.max(0, Number((bal.qty - qtyDispatched).toFixed(4)));
          bal.value = Number((bal.qty * bal.wac).toFixed(2));
        }

        ledger.unshift({
          id: `ledger-disp-${Date.now()}-${line.id || Math.random()}`,
          itemId: line.itemId || bal?.itemId || 'fg-item',
          sku: line.item?.sku || bal?.sku || 'FG-ITEM',
          itemName: `${line.item?.name || 'Finished Good'} (Dispatched ${order.number})`,
          movementType: 'DISP_OUT',
          qty: -qtyDispatched,
          rate: Number(line.rate) || 50.0,
          totalValue: -Number((qtyDispatched * (Number(line.rate) || 50.0)).toFixed(2)),
          batchNo: `FEFO-${order.number}`,
          txnAt: nowIso,
          auditHash: `#sha256-${Math.random().toString(36).substring(2, 7)}`,
        });
      });

      saveStoredStockBalances(balances);
      saveStoredStockLedger(ledger);
      getStoredOrders(); // Refresh order coverage
    }

    return {
      success: true,
      id: `disp-${Date.now()}`,
      dispatchNo,
    };
  }

  if (path === '/inventory/balances' || path.startsWith('/inventory/balances')) {
    return getStoredStockBalances();
  }

  if (path === '/inventory/ledger' || path.startsWith('/inventory/ledger')) {
    return getStoredStockLedger();
  }

  if (path === '/inventory/inward' && options.method === 'POST') {
    let body: any = {};
    try {
      if (typeof options.body === 'string') body = JSON.parse(options.body);
    } catch {}

    const balances = getStoredStockBalances();
    const ledger = getStoredStockLedger();
    const nowIso = new Date().toISOString();
    const grnNo = body.grnNo || `GRN-2026-${String(Date.now()).slice(-4)}`;
    const vendor = body.vendor || 'Thanjavur Agro Mills, Tiruchirappalli';

    if (body.quickRefillAll) {
      // 1-Click Full Restock: adds 200 KG Flour, 50 L Oil, 10 KG Spice, 500 Pouches, 50 Cartons
      const refillItems = [
        { sku: 'RAW-FLOUR', addQty: 200, uom: 'KG', rate: 43.125, type: 'RAW_IN' },
        { sku: 'RAW-OIL', addQty: 50, uom: 'L', rate: 140.0, type: 'RAW_IN' },
        { sku: 'RAW-SPICE', addQty: 10, uom: 'KG', rate: 200.0, type: 'RAW_IN' },
        { sku: 'PKG-POUCH-200G', addQty: 500, uom: 'PCS', rate: 2.5, type: 'PKG_IN' },
        { sku: 'PKG-CARTON-20PKT', addQty: 50, uom: 'PCS', rate: 15.0, type: 'PKG_IN' },
      ];

      refillItems.forEach((ref) => {
        const bal = balances.find((b: any) => b.sku === ref.sku);
        if (bal) {
          bal.qty = Number((bal.qty + ref.addQty).toFixed(4));
          bal.value = Number((bal.qty * bal.wac).toFixed(2));

          ledger.unshift({
            id: `ledger-grn-${Date.now()}-${ref.sku}`,
            itemId: bal.itemId,
            sku: bal.sku,
            itemName: `${bal.name} (Supplier: ${vendor})`,
            movementType: ref.type,
            qty: ref.addQty,
            rate: ref.rate,
            totalValue: Number((ref.addQty * ref.rate).toFixed(2)),
            batchNo: grnNo,
            txnAt: nowIso,
            auditHash: `#sha256-${Math.random().toString(36).substring(2, 7)}`,
          });
        }
      });
    } else {
      // Single item inward
      const sku = body.sku || 'RAW-FLOUR';
      const addQty = Number(body.qty) || 50.0;
      const rate = Number(body.rate) || 43.125;
      const bal = balances.find((b: any) => b.sku === sku || b.itemId === sku);

      if (bal) {
        bal.qty = Number((bal.qty + addQty).toFixed(4));
        bal.value = Number((bal.qty * bal.wac).toFixed(2));

        const movementType = bal.kind === 'RAW' ? 'RAW_IN' : bal.kind === 'PACKAGING' ? 'PKG_IN' : 'PROD_IN';
        ledger.unshift({
          id: `ledger-grn-${Date.now()}-${sku}`,
          itemId: bal.itemId,
          sku: bal.sku,
          itemName: `${bal.name} (Supplier: ${vendor})`,
          movementType,
          qty: addQty,
          rate,
          totalValue: Number((addQty * rate).toFixed(2)),
          batchNo: grnNo,
          txnAt: nowIso,
          auditHash: `#sha256-${Math.random().toString(36).substring(2, 7)}`,
        });
      }
    }

    saveStoredStockBalances(balances);
    saveStoredStockLedger(ledger);
    getStoredOrders(); // Refresh order stock coverage

    return {
      success: true,
      message: `Goods Receipt Note (${grnNo}) posted successfully! Stock added to store room.`,
      balances,
    };
  }

  if (path === '/inventory/reset' && options.method === 'POST') {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('snackflow_stock_balances');
      localStorage.removeItem('snackflow_stock_ledger');
      localStorage.removeItem('snackflow_orders');
    }
    return { success: true, message: 'Inventory and orders reset to initial benchmark opening balances.' };
  }

  if (path === '/production/equipment' || path.startsWith('/production/equipment')) {
    const equipment = getStoredEquipment();

    // Resolve downtime: POST /production/equipment/downtime/:id/resolve
    const resolveMatch = path.match(/\/production\/equipment\/downtime\/([^/]+)\/resolve/);
    if (resolveMatch) {
      const dtId = resolveMatch[1];
      const updated = equipment.map((eq) => {
        const hasDt = eq.downtimes?.some((d: any) => d.id === dtId);
        if (hasDt) {
          return {
            ...eq,
            status: 'OPERATIONAL',
            healthScore: Math.min(96, (eq.healthScore || 70) + 18),
            downtimes: eq.downtimes.map((d: any) =>
              d.id === dtId
                ? { ...d, endTime: new Date().toISOString(), durationMinutes: 45 }
                : d
            ),
          };
        }
        return eq;
      });
      saveStoredEquipment(updated);
      return { success: true, message: 'Equipment restored to operational' };
    }

    // Log downtime: POST /production/equipment/downtime
    if (path.includes('/downtime') && options.method === 'POST') {
      let body: any = {};
      try {
        if (typeof options.body === 'string') body = JSON.parse(options.body);
      } catch {}

      const updated = equipment.map((eq) => {
        if (eq.id === body.equipmentId) {
          const newDt = {
            id: `dt-${Date.now()}`,
            category: body.category || 'UNPLANNED_STOP',
            reason: body.reason || 'Mechanical inspection required',
            startTime: new Date().toISOString(),
            durationMinutes: null,
          };
          return {
            ...eq,
            status: 'BREAKDOWN',
            healthScore: Math.max(35, (eq.healthScore || 90) - 22),
            downtimes: [newDt, ...(eq.downtimes || [])],
          };
        }
        return eq;
      });
      saveStoredEquipment(updated);
      return { success: true, message: 'Downtime event logged' };
    }

    return equipment;
  }

  if (path === '/production/runs/draft') {
    let body: any = {};
    try {
      if (typeof options.body === 'string') body = JSON.parse(options.body);
    } catch {}
    const isRibbon = body.fgItemId === 'fg-rib-200g' || body.recipeId?.includes('ribbon') || body.recipeId === '00000000-0000-0000-0000-000000000021';
    const fgSku = isRibbon ? 'FG-RIB-200G' : 'FG-MUR-200G';
    const fgName = isRibbon ? 'Ribbon Pakoda 200g (ரிப்பன் பக்கோடா)' : 'Murukku 200g (முறுக்கு)';
    const batchPrefix = isRibbon ? 'RIB200' : 'MUR200';
    return {
      id: `run-draft-${Date.now()}`,
      batchNo: `${batchPrefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-01`,
      recipeId: body.recipeId || (isRibbon ? '00000000-0000-0000-0000-000000000021' : '00000000-0000-0000-0000-000000000020'),
      fgItemId: isRibbon ? 'fg-rib-200g' : 'fg-mur-200g',
      fgItem: { name: fgName, sku: fgSku },
      batchFactor: body.batchFactor || 1.0,
      stdOutputKg: isRibbon ? 20.0 : 40.0,
      status: 'DRAFT',
      qcStatus: 'PENDING',
    };
  }

  if (path.includes('/close')) {
    return {
      id: 'run-draft-001',
      batchNo: 'MUR200-261120-01',
      status: 'CLOSED',
      onHandShare: 800.0,
      cogsShare: 400.0,
      finalUnitCost: 24.15,
      success: true,
      message: 'Overhead allocated and run closed successfully',
    };
  }

  if (path.includes('/production/runs/') && (path.endsWith('/post') || options.method === 'POST')) {
    let body: any = {};
    try {
      if (typeof options.body === 'string') body = JSON.parse(options.body);
    } catch {}

    const balances = getStoredStockBalances();
    const ledger = getStoredStockLedger();
    const targetFgItemId = body.fgItemId || (body.recipeId?.includes('rib') ? 'fg-rib-200g' : 'fg-mur-200g');
    const isRibbon = targetFgItemId.includes('rib') || body.fgSku === 'FG-RIB-200G' || body.recipeName?.includes('Ribbon');
    const batchPrefix = isRibbon ? 'RIB200' : 'MUR200';
    const batchNo = `${batchPrefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-01`;
    const nowIso = new Date().toISOString();

    const actualInputs = body.actualInputs || [
      { itemId: 'raw-flour', actualQty: 40.0, uom: 'KG' },
      { itemId: 'raw-oil', actualQty: 10.5, uom: 'L' },
      { itemId: 'raw-spice', actualQty: 1.2, uom: 'KG' },
    ];
    const goodOutputQty = Number(body.goodOutputQty) || 188.0;
    const damagedPackagingQty = Number(body.damagedPackagingQty) || 12.0;
    const cartonsUsed = Number(body.cartonsUsed) || 10.0;
    const pouchesConsumed = goodOutputQty + damagedPackagingQty;

    // 1. Deduct raw materials consumed
    actualInputs.forEach((inp: any) => {
      const bal = balances.find(
        (b: any) =>
          b.itemId === inp.itemId ||
          b.sku === inp.itemId ||
          (inp.itemId && b.itemId.includes(inp.itemId.replace('raw-', '')))
      );
      const qtyUsed = Number(inp.actualQty) || 0;
      if (bal) {
        bal.qty = Math.max(0, Number((bal.qty - qtyUsed).toFixed(4)));
        bal.value = Number((bal.qty * bal.wac).toFixed(2));

        ledger.unshift({
          id: `ledger-prod-raw-${Date.now()}-${bal.sku}`,
          itemId: bal.itemId,
          sku: bal.sku,
          itemName: `${bal.name} (Consumed in ${batchNo})`,
          movementType: 'RAW_OUT',
          qty: -qtyUsed,
          rate: bal.wac,
          totalValue: -Number((qtyUsed * bal.wac).toFixed(2)),
          batchNo,
          txnAt: nowIso,
          auditHash: `#sha256-${Math.random().toString(36).substring(2, 7)}`,
        });
      }
    });

    // 2. Deduct packaging consumed (pouches & cartons)
    const pouchBal = balances.find((b: any) => b.sku === 'PKG-POUCH-200G' || b.itemId === 'pkg-pouch');
    if (pouchBal) {
      pouchBal.qty = Math.max(0, Number((pouchBal.qty - pouchesConsumed).toFixed(4)));
      pouchBal.value = Number((pouchBal.qty * pouchBal.wac).toFixed(2));

      ledger.unshift({
        id: `ledger-prod-pkg-${Date.now()}-pouch`,
        itemId: pouchBal.itemId,
        sku: pouchBal.sku,
        itemName: `${pouchBal.name} (Consumed in ${batchNo})`,
        movementType: 'PKG_OUT',
        qty: -pouchesConsumed,
        rate: pouchBal.wac,
        totalValue: -Number((pouchesConsumed * pouchBal.wac).toFixed(2)),
        batchNo,
        txnAt: nowIso,
        auditHash: `#sha256-${Math.random().toString(36).substring(2, 7)}`,
      });
    }

    const cartonBal = balances.find((b: any) => b.sku === 'PKG-CARTON-20PKT' || b.itemId === 'pkg-carton');
    if (cartonBal) {
      cartonBal.qty = Math.max(0, Number((cartonBal.qty - cartonsUsed).toFixed(4)));
      cartonBal.value = Number((cartonBal.qty * cartonBal.wac).toFixed(2));

      ledger.unshift({
        id: `ledger-prod-pkg-${Date.now()}-carton`,
        itemId: cartonBal.itemId,
        sku: cartonBal.sku,
        itemName: `${cartonBal.name} (Consumed in ${batchNo})`,
        movementType: 'PKG_OUT',
        qty: -cartonsUsed,
        rate: cartonBal.wac,
        totalValue: -Number((cartonsUsed * cartonBal.wac).toFixed(2)),
        batchNo,
        txnAt: nowIso,
        auditHash: `#sha256-${Math.random().toString(36).substring(2, 7)}`,
      });
    }

    // 3. Credit Finished Goods produced
    const fgBal = balances.find(
      (b: any) =>
        b.itemId === targetFgItemId ||
        b.sku === (isRibbon ? 'FG-RIB-200G' : 'FG-MUR-200G') ||
        (isRibbon ? b.name?.includes('Ribbon') : b.name?.includes('Murukku'))
    );
    if (fgBal) {
      fgBal.qty = Number((fgBal.qty + goodOutputQty).toFixed(4));
      fgBal.value = Number((fgBal.qty * fgBal.wac).toFixed(2));

      ledger.unshift({
        id: `ledger-prod-fg-${Date.now()}`,
        itemId: fgBal.itemId,
        sku: fgBal.sku,
        itemName: `${fgBal.name} (Batch ${batchNo})`,
        movementType: 'PROD_IN',
        qty: goodOutputQty,
        rate: isRibbon ? 32.0 : 24.15,
        totalValue: Number((goodOutputQty * (isRibbon ? 32.0 : 24.15)).toFixed(2)),
        batchNo,
        txnAt: nowIso,
        auditHash: `#sha256-${Math.random().toString(36).substring(2, 7)}`,
      });
    }

    saveStoredStockBalances(balances);
    saveStoredStockLedger(ledger);
    getStoredOrders(); // Refresh order coverage

    return {
      id: 'run-draft-001',
      batchNo,
      status: 'POSTED',
      yieldKg: Number((goodOutputQty * 0.2).toFixed(2)),
      variancePct: isRibbon ? Number((((goodOutputQty - 100) / 100) * 100).toFixed(1)) : -6.0,
      onHandShare: isRibbon ? 400.0 : 800.0,
      cogsShare: isRibbon ? 200.0 : 400.0,
      finalUnitCost: isRibbon ? 32.0 : 24.15,
      success: true,
      message: 'Batch posted successfully! Raw materials deducted, Finished Goods credited to inventory.',
    };
  }

  if (path.startsWith('/production/runs/')) {
    return {
      id: 'run-draft-001',
      batchNo: 'MUR200-261120-01',
      status: 'POSTED',
      yieldKg: 40.0,
      variancePct: -6.0,
      onHandShare: 800.0,
      cogsShare: 400.0,
      finalUnitCost: 24.15,
      success: true,
    };
  }

  // Default fallback for any mutation or endpoint
  return { success: true, message: 'Operation executed successfully' };
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const session = getStoredSession();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  // 1. If safe to call live backend API, call it and never mask HTTP error status codes
  if (!shouldBypassLocalhost()) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        if (res.status === 204) return {} as T;
        return await res.json();
      }

      if (res.status === 401) {
        setStoredSession(null);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
        throw new Error('Session expired or unauthorized. Please sign in again.');
      }

      const errData = await res.json().catch(() => ({}));
      const fieldErrors = Array.isArray(errData.errors) && errData.errors.length > 0
        ? `: ${errData.errors.map((e: any) => `${e.field}: ${e.message}`).join('; ')}`
        : '';
      throw new Error(
        (errData.detail || errData.message || errData.error || `Request failed with status ${res.status}`) +
          fieldErrors,
      );
    } catch (err: any) {
      const isNetworkFailure = err?.name === 'AbortError' || err instanceof TypeError;
      if (!isNetworkFailure) {
        throw err;
      }
      // Genuine network unavailability -> fall through only for offline PWA resilience
    }
  }

  // 2. Return benchmark dataset when genuinely offline or static HTTPS demo mode
  const fallback = getMockFallback(endpoint, options);
  if (fallback !== undefined) {
    return fallback as T;
  }

  throw new Error(`Network unavailable and no offline handler for ${endpoint}`);
}

export async function downloadReport(
  reportType: string,
  format: 'excel' | 'csv' | 'pdf',
  query?: { startDate?: string; endDate?: string },
): Promise<void> {
  const session = getStoredSession();
  const params = new URLSearchParams({ format });
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);
  const url = `${API_BASE_URL}/reports/export/${reportType}?${params.toString()}`;

  if (!shouldBypassLocalhost()) {
    const res = await fetch(url, {
      headers: {
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      credentials: 'include',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.detail || `Export failed with status ${res.status}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${reportType}.${format === 'excel' ? 'xlsx' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    return;
  }

  // Instant client-side statutory export fallback strictly for offline demo mode
  const csvContent = `Report,${reportType.toUpperCase()}\nCompany,Murukku Delights Private Limited (Sri Murugan Snacks)\nGSTIN,33AABCM1234F1Z0\nGeneratedAt,${new Date().toISOString()}\nItem,SKU,UOM,Quantity,Rate,Amount\nMurukku 200g,FG-MUR-200G,PKT,150,50.00,7500.00\nRibbon Pakoda 200g,FG-RIB-200G,PKT,100,50.00,5000.00\n`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${reportType}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
