export function ShelfSkeleton({ title }: { title: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-10 w-64 max-w-full rounded bg-muted" />
      </div>
      <p className="text-sm text-muted-foreground">Opening {title}…</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-xl border border-border bg-card" />
        <div className="h-24 rounded-xl border border-border bg-card" />
        <div className="h-24 rounded-xl border border-border bg-card" />
      </div>
      <div className="h-48 rounded-xl border border-border bg-card" />
    </div>
  );
}
