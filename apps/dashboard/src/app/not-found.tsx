import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl font-bold text-primary/20">404</div>
        <h1 className="text-2xl font-bold tracking-tight">Page Not Found</h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Login
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/60" data-unicore-branding>
          UniCore by BeMind Technology
        </p>
      </div>
    </div>
  );
}
