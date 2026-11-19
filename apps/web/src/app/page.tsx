import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
          NIT Trichy CDI Internship Benchmark Prototype
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          SnackFlow
        </h1>
        <p className="text-lg text-muted-foreground">
          Production-grade Order-to-Audit ERP for Packaged Snack Manufacturing.
          Featuring an append-only stock ledger, moving weighted average costing, GST billing, and offline PWA.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Access Portal
          </Link>
          <a
            href="http://localhost:4000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            API Docs (OpenAPI)
          </a>
        </div>
      </div>
    </main>
  );
}
