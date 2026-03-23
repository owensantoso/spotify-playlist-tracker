import type { TrackLifecycle } from "@prisma/client";

export type AdditionPayload = {
  lifecycles: Array<
    Pick<TrackLifecycle, "trackSpotifyId"> & {
      trackName: string;
      artistNames: string[];
      spotifyUrl: string;
      addedByDisplayName: string | null;
      addedBySpotifyUserId: string | null;
    }
  >;
};

export function buildDiscordMessage(payload: AdditionPayload, batchedNotifications: boolean) {
  if (batchedNotifications) {
    return {
      content: `New playlist additions: ${payload.lifecycles.length}`,
      embeds: payload.lifecycles.slice(0, 10).map((lifecycle) => ({
        title: lifecycle.trackName,
        description: [
          lifecycle.artistNames.join(", "),
          lifecycle.addedByDisplayName || lifecycle.addedBySpotifyUserId
            ? `Added by ${lifecycle.addedByDisplayName ?? lifecycle.addedBySpotifyUserId}`
            : "Contributor unknown",
          lifecycle.spotifyUrl,
        ].join("\n"),
      })),
    };
  }

  return payload.lifecycles.map((lifecycle) => ({
    content: `New track: ${lifecycle.trackName} by ${lifecycle.artistNames.join(", ")}${
      lifecycle.addedByDisplayName || lifecycle.addedBySpotifyUserId
        ? `, added by ${lifecycle.addedByDisplayName ?? lifecycle.addedBySpotifyUserId}`
        : ""
    }\n${lifecycle.spotifyUrl}`,
  }));
}
