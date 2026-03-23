import Link from "next/link";

import { LogoutForm } from "@/components/logout-form";
import { RunSyncButton } from "@/components/run-sync-button";
import { SectionCard } from "@/components/section-card";
import { getCurrentAdminContext } from "@/lib/auth";
import { validateConfiguredPlaylists } from "@/lib/services/setup-service";

type SetupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = await searchParams;
  const syncDebug =
    typeof params.debug === "string"
      ? (() => {
          try {
            return JSON.parse(params.debug) as unknown;
          } catch {
            return params.debug;
          }
        })()
      : null;
  const admin = await getCurrentAdminContext();
  const validation =
    admin.isAuthenticated && admin.isConfigured
      ? await validateConfiguredPlaylists().catch((error) => ({ error: String(error) }))
      : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
      <SectionCard title="Spotify setup" eyebrow="Admin-only">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-stone-200">
              Admin session: {admin.isAuthenticated ? "active" : "not connected"}
            </p>
            <p className="text-sm text-stone-400">
              The first Spotify account that logs in becomes the admin. The app stores Spotify tokens server-side only.
            </p>
            <p className="mt-2 text-sm text-stone-400">
              The header now-playing bar and playback controls use Spotify playback access. If you connected before this update, log out and reconnect once to grant the extra permissions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {admin.isAuthenticated ? (
              <>
                <RunSyncButton />
                <LogoutForm />
              </>
            ) : (
              <Link
                href="/api/auth/spotify/login?mode=admin&next=/setup"
                className="rounded-full bg-[--color-accent] px-4 py-2 text-sm font-semibold text-[--color-ink] transition hover:brightness-110"
              >
                Connect Spotify
              </Link>
            )}
          </div>
        </div>
        {params.connected ? <p className="mt-4 text-sm text-emerald-300">Spotify account connected successfully.</p> : null}
        {params.seeded ? <p className="mt-4 text-sm text-emerald-300">Seeded {params.seeded} archive tracks into local dedupe state.</p> : null}
        {params.sync === "ok" ? (
          <p className="mt-4 text-sm text-emerald-300">
            Sync complete: {String(params.additions ?? 0)} additions, {String(params.removals ?? 0)} removals.
          </p>
        ) : null}
        {params.error ? <p className="mt-4 text-sm text-rose-300">{String(params.error)}</p> : null}
        {syncDebug ? (
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-stone-300">
            {JSON.stringify(syncDebug, null, 2)}
          </pre>
        ) : null}
      </SectionCard>

      <SectionCard title="Playlist validation" eyebrow="Main and archive access">
        {!validation ? (
          <p className="text-sm text-stone-400">Authenticate the admin account to validate playlist access.</p>
        ) : "error" in validation ? (
          <p className="text-sm text-rose-300">{validation.error}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/8 bg-black/10 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[--color-accent]">Main playlist</p>
              <p className="mt-2 text-lg font-medium text-stone-100">{validation.mainPlaylist.name}</p>
              <p className="text-sm text-stone-400">Readable: yes</p>
            </div>
            <div className="rounded-3xl border border-white/8 bg-black/10 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[--color-accent]">Archive playlist</p>
              <p className="mt-2 text-lg font-medium text-stone-100">{validation.archivePlaylist.name}</p>
              <p className="text-sm text-stone-400">
                Writable by admin: {validation.canWriteArchive ? "likely yes" : "not confirmed"}
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Archive dedupe seed" eyebrow="One-time bootstrap">
        <p className="text-sm text-stone-300">
          Seed archive entries from the existing archive playlist before the first sync so pre-existing archive tracks are not re-added.
        </p>
        <form action="/api/setup/seed-archive" method="post" className="mt-4">
          <button
            type="submit"
            className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm text-stone-200 transition hover:border-[--color-accent] hover:text-white"
          >
            Seed archive entries
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
