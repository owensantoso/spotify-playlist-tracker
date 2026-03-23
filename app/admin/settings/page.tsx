export const dynamic = "force-dynamic";

import { requireAuthenticatedAdmin } from "@/lib/auth";
import { getOrCreateSettings } from "@/lib/services/settings-service";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSettingsPage({ searchParams }: SettingsPageProps) {
  await requireAuthenticatedAdmin();
  const settings = await getOrCreateSettings();
  const params = await searchParams;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8">
      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[--color-accent]">Admin settings</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-100">Configuration</h2>
        <p className="mt-2 text-sm text-stone-400">
          Default scheduler guidance is hourly on free hosting. You can still lower the interval if your deployment budget permits the extra churn.
        </p>
        {params.saved ? <p className="mt-4 text-sm text-emerald-300">Settings saved.</p> : null}
        {params.error ? <p className="mt-4 text-sm text-rose-300">{String(params.error)}</p> : null}
        <form action="/api/admin/settings" method="post" className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-stone-200">
            Main playlist ID
            <input className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-stone-100 outline-none" name="mainPlaylistId" defaultValue={settings.mainPlaylistId} />
          </label>
          <label className="grid gap-2 text-sm text-stone-200">
            Archive playlist ID
            <input className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-stone-100 outline-none" name="archivePlaylistId" defaultValue={settings.archivePlaylistId} />
          </label>
          <label className="grid gap-2 text-sm text-stone-200">
            Sync interval minutes
            <input className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-stone-100 outline-none" name="syncIntervalMinutes" type="number" min="15" defaultValue={settings.syncIntervalMinutes} />
          </label>
          <label className="grid gap-2 text-sm text-stone-200">
            Discord webhook URL
            <input className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-stone-100 outline-none" name="discordWebhookUrl" defaultValue={settings.discordWebhookUrl ?? ""} />
          </label>
          <label className="flex items-center gap-3 text-sm text-stone-200">
            <input type="checkbox" name="notifyOnAdditions" defaultChecked={settings.notifyOnAdditions} />
            Notify on additions
          </label>
          <label className="flex items-center gap-3 text-sm text-stone-200">
            <input type="checkbox" name="notifyOnRemovals" defaultChecked={settings.notifyOnRemovals} />
            Notify on removals
          </label>
          <label className="flex items-center gap-3 text-sm text-stone-200">
            <input type="checkbox" name="batchedNotifications" defaultChecked={settings.batchedNotifications} />
            Batch Discord notifications
          </label>
          <label className="flex items-center gap-3 text-sm text-stone-200">
            <input type="checkbox" name="publicDashboard" defaultChecked={settings.publicDashboard} />
            Keep dashboard public read-only
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex w-fit items-center rounded-full bg-[--color-accent] px-4 py-2 text-sm font-semibold text-[--color-ink] transition hover:brightness-110"
          >
            Save settings
          </button>
        </form>
      </section>
    </div>
  );
}
