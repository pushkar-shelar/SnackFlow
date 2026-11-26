import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/common/Header';

export const metadata: Metadata = {
  title: 'SnackFlow — Order-to-Audit System',
  description: 'Production-grade packaged food manufacturing ERP, inventory ledger, and GST billing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#d97706" />
      </head>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
