import { format } from "date-fns";

import { requireAuthenticatedAdmin } from "@/lib/auth";
import { getSyncRuns } from "@/lib/services/stats-service";

export default async function AdminLogsPage() {
  await requireAuthenticatedAdmin();
  const runs = await getSyncRuns();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[--color-accent]">Admin logs</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-100">Sync history</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.22em] text-stone-500">
              <tr>
                <th className="pb-3 pr-4">Started</th>
                <th className="pb-3 pr-4">Trigger</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Fetched</th>
                <th className="pb-3 pr-4">Additions</th>
                <th className="pb-3 pr-4">Removals</th>
                <th className="pb-3">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-stone-200">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="py-4 pr-4">{format(run.startedAt, "MMM d, yyyy HH:mm")}</td>
                  <td className="py-4 pr-4">{run.triggerSource.toLowerCase()}</td>
                  <td className="py-4 pr-4">{run.status.toLowerCase()}</td>
                  <td className="py-4 pr-4">{run.fetchedItemsCount}</td>
                  <td className="py-4 pr-4">{run.additionsCount}</td>
                  <td className="py-4 pr-4">{run.removalsCount}</td>
                  <td className="py-4">{run.warnings.length || run.errors.length ? `${run.warnings.length} warnings / ${run.errors.length} errors` : "Clean"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
