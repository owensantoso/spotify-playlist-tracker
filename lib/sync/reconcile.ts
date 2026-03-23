import type { LifecycleStatus } from "@prisma/client";

import type { NormalizedPlaylistTrack } from "@/lib/spotify/types";

export type ActiveLifecycleRecord = {
  id: string;
  matchFingerprint: string;
  occurrenceOrdinal: number;
  status: LifecycleStatus;
};

export type ReconcileResult = {
  matchedLifecycleIds: string[];
  lifecyclesToCreate: NormalizedPlaylistTrack[];
  lifecyclesToRemove: string[];
  warnings: string[];
};

function recordKey(matchFingerprint: string, occurrenceOrdinal: number) {
  return `${matchFingerprint}::${occurrenceOrdinal}`;
}

export function reconcileLifecycles(
  currentItems: NormalizedPlaylistTrack[],
  existingActiveLifecycles: ActiveLifecycleRecord[],
) {
  const warnings: string[] = [];
  const existingMap = new Map<string, ActiveLifecycleRecord>();

  for (const lifecycle of existingActiveLifecycles) {
    const key = recordKey(lifecycle.matchFingerprint, lifecycle.occurrenceOrdinal);
    if (existingMap.has(key)) {
      warnings.push(`Duplicate active lifecycle detected for key ${key}; the older duplicate will be closed`);
      continue;
    }
    existingMap.set(key, lifecycle);
  }

  const matchedLifecycleIds: string[] = [];
  const lifecyclesToCreate: NormalizedPlaylistTrack[] = [];

  for (const currentItem of currentItems) {
    const key = recordKey(currentItem.matchFingerprint, currentItem.occurrenceOrdinal);
    const existing = existingMap.get(key);

    if (existing) {
      matchedLifecycleIds.push(existing.id);
      existingMap.delete(key);
    } else {
      lifecyclesToCreate.push(currentItem);
    }
  }

  return {
    matchedLifecycleIds,
    lifecyclesToCreate,
    lifecyclesToRemove: [...existingMap.values()].map((lifecycle) => lifecycle.id),
    warnings,
  } satisfies ReconcileResult;
}
