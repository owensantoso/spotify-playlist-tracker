export function RunSyncButton() {
  return (
    <form action="/api/admin/sync?redirect=1" method="post" className="flex flex-col gap-2">
      <button
        type="submit"
        className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[--color-accent] px-4 py-2 text-sm font-semibold text-[--color-ink] transition hover:brightness-110"
      >
        Run Sync Now
      </button>
      <p className="text-xs text-stone-500">
        Manual sync runs as a normal form submit, so it still works even if client hydration is delayed.
      </p>
    </form>
  );
}
