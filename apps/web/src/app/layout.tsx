import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnackFlow — Order-to-Audit System',
  description: 'Production-grade packaged food manufacturing ERP, inventory ledger, and GST billing',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
