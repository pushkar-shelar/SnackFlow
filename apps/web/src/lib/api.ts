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
}

export async function login(email: string, password: string = 'Password123!'): Promise<UserSession> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.title || err.message || 'Invalid email or password');
  }

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

export const loginAs = (email: string) => login(email, 'Password123!');

export function logout(): void {
  setStoredSession(null);
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
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    const message = errorJson.detail || errorJson.title || errorJson.message || `Request failed with status ${res.status}`;
    const error: any = new Error(message);
    error.status = res.status;
    error.problem = errorJson;
    throw error;
  }

  return res.json();
}

export async function downloadReport(reportType: string, format: 'excel' | 'csv'): Promise<void> {
  const session = getStoredSession();
  const url = `${API_BASE_URL}/reports/export/${reportType}?format=${format}`;
  const res = await fetch(url, {
    headers: {
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Export download failed');
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${reportType}.${format === 'excel' ? 'xlsx' : 'csv'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
