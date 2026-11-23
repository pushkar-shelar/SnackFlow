'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getStoredSession, UserSession, logout } from '@/lib/api';
import { ShieldAlert, ArrowLeft, LogIn, Lock, UserCheck } from 'lucide-react';

interface RbacGateProps {
  allowedRoles: Array<'SALESMAN' | 'ADMIN' | 'PRODUCTION' | 'AUDITOR' | 'OWNER'>;
  portalName: string;
  requiredPermission?: string;
  children: React.ReactNode;
}

export function RbacGate({
  allowedRoles,
  portalName,
  requiredPermission = 'PORTAL_ACCESS',
  children,
}: RbacGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    const current = getStoredSession();
    setSession(current);
    setIsChecking(false);

    if (!current) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in -> handled by redirect in useEffect
  if (!session) {
    return null;
  }

  // Authorized role -> render protected content
  if (allowedRoles.includes(session.role)) {
    return <>{children}</>;
  }

  // Unauthorized role -> Render 403 Forbidden Access Denied
  const getRoleDefaultPath = (role: string): string => {
    switch (role) {
      case 'SALESMAN':
        return '/sales';
      case 'ADMIN':
        return '/admin/orders';
      case 'PRODUCTION':
        return '/production';
      case 'AUDITOR':
        return '/audit';
      case 'OWNER':
        return '/owner';
      default:
        return '/';
    }
  };

  const handleSwitchAccount = () => {
    logout();
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="bg-white rounded-3xl border border-rose-200/80 shadow-xl overflow-hidden">
        {/* Top Warning Banner */}
        <div className="bg-gradient-to-r from-rose-600 to-red-700 p-6 text-white text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3 ring-4 ring-white/20">
            <ShieldAlert className="w-9 h-9 text-white" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-white/20 text-[11px] font-extrabold tracking-wider uppercase mb-1">
            HTTP 403 Forbidden • Default-Deny RBAC
          </div>
          <h1 className="text-2xl font-black tracking-tight">Access Denied</h1>
          <p className="text-xs text-rose-100 mt-1 max-w-md mx-auto">
            You do not have the required statutory authorization to view or execute operations in {portalName}.
          </p>
        </div>

        {/* Diagnostic Details */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs pb-3 border-b border-stone-200">
              <span className="text-stone-500 font-medium">Active Authenticated User:</span>
              <div className="flex items-center gap-1.5 font-bold text-stone-900">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>{session.name}</span>
                <span className="bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded text-[10px]">
                  {session.email}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pb-3 border-b border-stone-200">
              <span className="text-stone-500 font-medium">Current User Role:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                {session.role}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pb-3 border-b border-stone-200">
              <span className="text-stone-500 font-medium">Permitted Roles for this Route:</span>
              <div className="flex gap-1.5">
                {allowedRoles.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">Missing Privilege:</span>
              <span className="font-mono text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {requiredPermission}
              </span>
            </div>
          </div>

          <div className="text-xs text-stone-600 bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Statutory Compliance Guard:</strong> Sri Murugan Snacks operates under strict segregation of duties (SoD).
              Field representatives ({session.role}) cannot approve wholesale orders, post tax invoices, or tamper with plant batches.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => router.push(getRoleDefaultPath(session.role))}
              className="flex-1 py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to My Portal ({getRoleDefaultPath(session.role)})
            </button>

            <button
              onClick={handleSwitchAccount}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 transition"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Authorized Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
