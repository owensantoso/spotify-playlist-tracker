# Comments Data Model

This note translates the timestamped song comments product spec into implementation-oriented constraints for this codebase.

Related docs:

- [`docs/specs/timestamped-song-comments.md`](/Users/macintoso/Documents/VSCode/spotify-playlist-tracker/docs/specs/timestamped-song-comments.md)

## Current App Constraints

- The app already has public reads and signed-in Spotify viewer sessions.
- Admin and viewer sessions must remain distinct.
- The now-playing UI already polls every 5 seconds and can schedule faster follow-up refreshes after user actions.
- Public reads should not depend on a live Spotify lookup for every comment row.

## Proposed Entities

### `SongComment`

Use one row per comment or reply, with both `threadRootId` and `parentCommentId`.

Top-level comment:

- `id = threadRootId`
- `parentCommentId = null`
- owns the canonical `timestampMs`
- owns the `markerBucketSecond`

Reply:

- `threadRootId = root comment id`
- `parentCommentId = direct parent id`
- keeps `trackSpotifyId`
- does not create a marker

Recommended snapshots on write:

- `authorDisplayNameSnapshot`
- `authorProfileUrlSnapshot`
- `authorImageUrlSnapshot`
- `clientSubmissionId`

Those avoid public read amplification against Spotify and keep comment history stable if a user renames themselves later.

Recommended uniqueness rule:

- unique `(authorSpotifyUserId, clientSubmissionId)`

### `SongCommentAttachment`

Keep attachments in a separate table from the start.

Suggested columns:

- `id`
- `commentId`
- `kind`
- `storageUrl` or `storageKey`
- `mimeType`
- `byteSize`
- `durationMs`
- `status`
- `createdAt`

## Relationship Boundaries

- Reference `Track.spotifyTrackId` directly.
- Reference `SpotifyUser.spotifyUserId` directly.
- Do not couple comment writes to `UserAccount`; that migration has already been fragile in some environments.

## Write Path

### Top-Level Comment

1. Require viewer session.
2. Read fresh playback state server-side.
3. Validate `expectedTrackId` against the live server track.
4. Validate progress drift with tolerance.
5. Save top-level comment with:
   - `threadRootId = id`
   - `timestampMs = server progress`
   - `markerBucketSecond = floor(timestampMs / 1000)`
   - author snapshots
   - `clientSubmissionId` for idempotency

### Reply

1. Require viewer session.
2. Validate parent comment exists.
3. Inherit `trackSpotifyId`, `threadRootId`, and marker bucket context from the thread root.
4. Save reply without creating a new marker.

## Read Models

### Marker Summary

Use a compact endpoint for the progress bar:

- `trackId`
- `version`
- grouped markers

Each marker should already be grouped server-side by `markerBucketSecond`.

Each marker response should also carry one canonical freshness token for the track comment set:

- preferred: server-generated monotonic `version`
- fallback: `lastUpdatedAt = max(updatedAt)` across comments and replies for that track

### Thread List

Use a separate endpoint for the expandable comments panel:

- top-level comments ordered by `timestampMs asc`
- replies nested by `createdAt asc`

Do not overload marker reads with full thread trees.

## Playback Validation

The client snapshot is advisory only.

Recommended request fields for top-level comment creation:

- `expectedTrackId`
- `expectedProgressMs`
- `capturedAt`
- `clientSubmissionId`
- `body`

Suggested acceptance rule:

- reject if live track id differs
- accept same-track progress if drift is within `max(2500ms, request latency window)`

Suggested response classes:

- `401` viewer not signed in
- `403` scope or playback access missing
- `409` active track changed
- `412` progress drift too large
- `428` no active playback or no active device
- `429` rate limited

## Popup And Polling

The popup system should be driven from marker buckets, not individual replies.

Dedupe key:

- `trackSpotifyId`
- `markerBucketSecond`
- `playbackSessionKey`

The playback session key should reset on:

- track change
- deliberate backward seek across the bucket threshold

The marker endpoint can be refreshed:

- on track change
- after successful local writes
- optionally on panel open

The thread endpoint should not be polled every 5 seconds by default.

## Migration And Degradation

This repo has already had runtime issues caused by unapplied Prisma migrations. The comments feature should degrade cleanly if its tables are missing.

Required behavior:

- public read endpoints return an empty or feature-disabled payload instead of throwing
- write endpoints return a typed unavailable response instead of crashing
- UI should surface the feature as temporarily unavailable rather than failing the whole now-playing section
