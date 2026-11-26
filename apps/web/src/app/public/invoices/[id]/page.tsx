import React from 'react';
import PublicInvoiceClient from './PublicInvoiceClient';

export function generateStaticParams() {
  return [{ id: 'sample' }];
}

export default function PublicInvoicePage() {
  return <PublicInvoiceClient />;
}
