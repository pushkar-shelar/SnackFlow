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
  { role: 'SALESMAN', name: 'Ramu S (Sales)', email: 'salesman@snackflow.com' },
  { role: 'ADMIN', name: 'Kavitha N (Admin)', email: 'admin@snackflow.com' },
  { role: 'PRODUCTION', name: 'Muthu K (Plant Supervisor)', email: 'production@snackflow.com' },
  { role: 'AUDITOR', name: 'Sankaran & Co (Statutory Auditor)', email: 'auditor@snackflow.com' },
  { role: 'OWNER', name: 'S. Murugesan (Managing Director)', email: 'owner@snackflow.com' },
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

export async function loginAs(email: string): Promise<UserSession> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password@123' }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || 'Login failed');
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
