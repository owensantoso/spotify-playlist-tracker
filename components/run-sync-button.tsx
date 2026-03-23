"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[--color-accent] px-4 py-2 text-sm font-semibold text-[--color-ink] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Running sync..." : "Run Sync Now"}
    </button>
  );
}

export function RunSyncButton() {
  return (
    <form action="/api/admin/sync?redirect=1" method="post" className="flex flex-col gap-2">
      <SubmitButton />
      <p className="text-xs text-stone-500">
        Manual sync runs as a normal form submit, so it still works even if client hydration is delayed.
      </p>
    </form>
  );
}
