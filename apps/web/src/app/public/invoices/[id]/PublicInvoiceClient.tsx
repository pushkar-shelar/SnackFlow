'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FileText, CheckCircle2, AlertTriangle, Printer, ExternalLink } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function PublicInvoiceContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [resolvedId, setResolvedId] = useState<string>('');
  const expires = searchParams.get('expires') || '';
  const sig = searchParams.get('sig') || '';

  const [invoice, setInvoice] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const pathId =
      typeof window !== 'undefined'
        ? window.location.pathname.split('/').filter(Boolean).pop() || ''
        : '';
    const candidateId = params?.id && params.id !== 'sample' ? params.id : pathId;
    setResolvedId(candidateId);
  }, [params?.id]);

  useEffect(() => {
    if (!resolvedId) return;
    if (!expires || !sig) {
      setError('Invalid or incomplete invoice share link.');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetch(
      `${API_BASE_URL}/invoices/public/${encodeURIComponent(resolvedId)}?expires=${encodeURIComponent(expires)}&sig=${encodeURIComponent(sig)}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.message || 'Invalid or expired invoice share link');
        }
        return res.json();
      })
      .then((data) => setInvoice(data))
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load invoice');
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [resolvedId, expires, sig]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-sm font-semibold text-stone-500">Verifying invoice signature...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3">
        <div className="flex items-center gap-2 font-bold text-base">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          Invoice Link Unavailable
        </div>
        <p className="text-xs text-rose-800">{error || 'Invoice not found.'}</p>
      </div>
    );
  }

  const party = invoice.order?.party;
  const totalAmount = Number(invoice.total || 0).toFixed(2);
  const upiUri = `upi://pay?pa=srimurugansnacks@okhdfcbank&pn=Sri%20Murugan%20Snacks&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(
    `Invoice ${invoice.number}`,
  )}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              HMAC Verified Tax Invoice
            </div>
            <h1 className="text-xl font-black text-stone-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600" />
              {invoice.number}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Sri Murugan Snacks • Tiruchirappalli, Tamil Nadu • GSTIN: 33AAAAA0000A1Z5
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <a
              href={upiUri}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
            >
              Pay via UPI (₹{totalAmount})
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
            <div className="font-bold text-stone-500 uppercase text-[10px]">Billed To</div>
            <div className="font-bold text-stone-900 mt-1">{party?.name || 'Customer'}</div>
            <div className="text-stone-600 mt-0.5">{party?.address}</div>
            {party?.gstin && <div className="font-mono text-stone-500 mt-1">GSTIN: {party.gstin}</div>}
          </div>
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
            <div className="font-bold text-stone-500 uppercase text-[10px]">Invoice Metadata</div>
            <div>Status: <strong className="text-stone-900">{invoice.status}</strong></div>
            <div>Supply Type: <strong className="text-stone-900">{invoice.supplyType}</strong></div>
            <div>Place of Supply: <strong className="text-stone-900">State {invoice.placeOfSupply}</strong></div>
            {invoice.irn && <div className="font-mono text-[10px] truncate text-stone-500">IRN: {invoice.irn}</div>}
          </div>
        </div>

        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-bold border-b border-stone-200">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">HSN</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Rate</th>
                <th className="p-3 text-right">Taxable</th>
                <th className="p-3 text-right">GST</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {(invoice.lines || []).map((line: any) => {
                const gst = Number(line.cgst || 0) + Number(line.sgst || 0) + Number(line.igst || 0);
                return (
                  <tr key={line.id}>
                    <td className="p-3 font-semibold text-stone-900">{line.item?.name || line.itemId}</td>
                    <td className="p-3 font-mono text-stone-500">{line.hsn}</td>
                    <td className="p-3 text-right">{Number(line.qty)} {line.uom}</td>
                    <td className="p-3 text-right">₹{Number(line.rate).toFixed(2)}</td>
                    <td className="p-3 text-right">₹{Number(line.taxable).toFixed(2)}</td>
                    <td className="p-3 text-right">₹{gst.toFixed(2)} ({Number(line.gstRate)}%)</td>
                    <td className="p-3 text-right font-bold text-stone-900">₹{Number(line.total).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full sm:w-64 space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Taxable Value</span>
              <span className="font-mono">₹{Number(invoice.taxable || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>CGST + SGST + IGST</span>
              <span className="font-mono">
                ₹{(Number(invoice.cgst || 0) + Number(invoice.sgst || 0) + Number(invoice.igst || 0)).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-stone-900 font-black text-sm pt-2 border-t border-stone-200">
              <span>Grand Total</span>
              <span className="font-mono">₹{totalAmount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicInvoiceClient() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-stone-500">Loading invoice...</div>}>
      <PublicInvoiceContent />
    </Suspense>
  );
}
