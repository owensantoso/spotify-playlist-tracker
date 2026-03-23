# Timestamped Song Comments

## Summary

Add public, timestamped comments to songs identified by Spotify track ID. Signed-in Spotify users can create comments from the now-playing section. The saved timestamp must come from a fresh server-side playback read, not from the browser clock. Comments are visible to everyone, scoped globally to the Spotify track ID, and support nested replies in the database from v1. The initial UI covers creating top-level comments, rendering timeline markers, showing comment previews on hover/focus/tap, showing a show-all-comments panel inside the now-playing section, and surfacing upcoming comments with a small popup shortly before playback reaches a marker.

This spec also reserves attachment support for future image and voice-note uploads without implementing uploads yet.

Related docs:

- [`docs/architecture/comments-data-model.md`](/Users/macintoso/Documents/VSCode/spotify-playlist-tracker/docs/architecture/comments-data-model.md)

## Goals

- Let signed-in Spotify users attach a comment to the currently playing Spotify track at the authoritative current playback timestamp.
- Make comments publicly readable without requiring sign-in.
- Render marker pins on the now-playing progress bar wherever the current track has comment threads.
- Show comment previews on hover, focus, and tap.
- Show an upcoming-comment popup roughly three seconds before a marker.
- Keep the full thread list available inside the now-playing section through a show-all-comments panel.
- Support nested replies in the data model from day one.
- Reserve attachment support for future image and audio comments.

## Non-Goals

- Anonymous comment creation.
- Edit and delete UI in v1.
- Reply composer UI in v1.
- Reactions, likes, rich text, or moderation UI in v1.
- Track-lifecycle-scoped comments. Comments are tied only to Spotify track ID.
- Upload or playback UI for image/audio attachments in v1.

## Product Decisions

- Comment scope is `trackSpotifyId`.
- Public visitors can read comments.
- Only signed-in Spotify viewers can create comments or replies.
- Admin session fallback must not be used for comment writes.
- The authoritative comment timestamp comes from a fresh server-side playback read.
- The browser playback snapshot is advisory only and is used to detect mismatch and reduce false saves.
- Only top-level comments create timeline markers.
- Replies belong to the parent thread and do not create their own markers.
- Marker grouping is server-defined and normalized to one marker bucket per displayed second.
- Track variants with different Spotify track IDs are intentionally treated as separate discussion threads for now.

## Primary User Flows

### Create A Top-Level Comment

1. A signed-in Spotify viewer is listening to a track.
2. The now-playing row shows a `Comment` button.
3. Clicking `Comment` opens an inline composer in the now-playing section.
4. The composer shows:
   - current track title
   - currently displayed playback time
   - multiline text input
   - submit button
   - cancel button
5. When the user submits:
   - the UI enters a clear in-progress state with disabled submit affordance, spinner/progress animation, and preserved draft text
   - the request sends the browser’s expected track ID, expected progress, capture time, and a client submission id
6. The server performs a fresh playback read, validates the active viewer session, and checks track/progress consistency.
7. If validation succeeds, the server saves a top-level thread anchor comment using the server-side playback timestamp.
8. The UI closes the composer or shows an inline success state, then updates the marker overlay and comments panel immediately.

### Recover From Playback Change

1. If the server finds a different track than the browser expected, the request fails with a typed mismatch response.
2. The UI keeps the draft text intact.
3. The composer enters a recoverable mismatch state:
   - `Playback changed. Re-capture current song and timestamp?`
   - one-click retry action
4. Retrying first refreshes the now-playing state, then resubmits against the new track only if the user confirms.
5. The client automatically retries once only for benign drift where the track matches and progress is still within tolerance.

### Browse Comments On The Current Track

1. The now-playing section shows a `Show all comments` toggle whenever a current track is known.
2. Opening the panel shows all top-level comments for the current track in ascending timestamp order.
3. Replies render nested beneath their parent comment in ascending creation order.
4. The panel remains part of the now-playing section rather than opening a separate page or modal.
5. If the track changes while the panel is open, the panel stays open and swaps to the new track’s comments.
6. If there is no active track, the panel remains visible but shows an empty disabled state rather than stale comments.

### Marker Preview And Upcoming Popup

1. Top-level comment threads are grouped by second-level marker bucket on the progress bar.
2. Each marker is interactive by hover, keyboard focus, and tap.
3. The marker preview shows:
   - timestamp label
   - one or more commenter avatars
   - comment count for the bucket
   - a preview of the newest or representative top-level comment
4. Roughly three seconds before playback reaches a marker bucket, the UI shows a compact popup for that bucket.
5. A marker bucket popup appears at most once per playback session unless playback seeks backward past the threshold and re-approaches it intentionally.

## UI Requirements

### Now-Playing Section

- Add a `Comment` button beside the existing playback controls or comment metadata area.
- Add a `Show all comments` toggle inside the now-playing section.
- Overlay comment markers directly on the existing progress bar.
- Markers should use a pin-like visual with the commenter profile image when available.
- If multiple top-level comment threads share a marker bucket, show stacked avatars or a `+N` indicator.

### Composer

- Visible only to signed-in viewers.
- Hidden or replaced with a sign-in CTA for signed-out visitors.
- Disabled with explanation if there is no active playable track.
- Preserve draft text through transient failures, mismatch recovery, and rate-limit errors.
- Surface typed failure messages instead of a generic submission failure.

### Comments Panel

- Publicly visible.
- Ordered by top-level comment timestamp ascending.
- Replies nested below parent comments.
- Replies visible in the read UI, even though reply creation UI is deferred.
- Show author avatar, display name, timestamp, body, and future attachment placeholder if present.

### Marker Interaction

- Hover is an enhancement, not the primary interaction model.
- Every marker must be keyboard focusable.
- Focus and tap must expose the same preview content as hover.
- Each marker needs an accessible name such as `Comment at 1:23 by Alice`.
- On touch devices, tapping a marker opens its preview.
- Tapping a different marker switches the open preview.
- Tapping outside the preview closes it.
- Only one marker preview may be open at a time.

## UX States

### Viewer/Auth States

- Signed out: read-only comments visible, composer replaced with `Sign in with Spotify to comment`.
- Signed in with active playback: composer enabled.
- Signed in with no active playback: composer disabled with explanation and the comments panel shows a no-active-track state rather than stale comments.
- Signed in but playback validation failed: composer remains open, draft preserved, retry CTA visible.

### Composer States

- Idle
- Open
- Validating playback
- Submitting
- Submission succeeded
- Drift auto-retrying
- Playback mismatch awaiting user confirmation
- No active playback
- Rate limited
- Network failure
- Unauthorized viewer session

### Comments Panel States

- Closed
- Loading
- Loaded with comments
- Loaded empty
- No active track
- Public read-only view
- Error with retry

### Marker States

- No comments
- Single-thread marker
- Multi-thread grouped marker
- Preview open
- Upcoming popup pending
- Upcoming popup already shown for the current playback session

## Data Model Requirements

Use a thread-aware model instead of relying only on a raw parent chain.

### SongComment

- `id`
- `trackSpotifyId`
- `threadRootId`
- `parentCommentId` nullable
- `authorSpotifyUserId`
- `authorDisplayNameSnapshot`
- `authorProfileUrlSnapshot`
- `authorImageUrlSnapshot`
- `clientSubmissionId`
- `timestampMs`
- `markerBucketSecond`
- `body`
- `replyCount`
- `attachmentCount`
- `createdAt`
- `updatedAt`
- `deletedAt` nullable for future moderation/tombstones
- `moderationState` nullable or enum reserved for future moderation

Rules:

- Top-level comments have `threadRootId = id` and `parentCommentId = null`.
- Replies point to both `parentCommentId` and `threadRootId`.
- Only top-level comments own the marker bucket and timeline timestamp.
- Replies inherit thread membership and may copy the parent marker bucket for easier querying, but they do not render as separate markers.

### SongCommentAttachment

- `id`
- `commentId`
- `kind` enum with at least `IMAGE` and `AUDIO`
- `storageUrl` or future storage key
- `mimeType`
- `byteSize`
- `durationMs` nullable for audio
- `status` for future processing/moderation
- `createdAt`

### Relationships

- `SongComment.trackSpotifyId` references `Track.spotifyTrackId`.
- `SongComment.authorSpotifyUserId` references `SpotifyUser.spotifyUserId`.
- Do not depend on `UserAccount` for reads or writes.

### Indexes

- `(trackSpotifyId, markerBucketSecond)` for marker queries
- `(trackSpotifyId, timestampMs)` for ordered top-level reads
- `(threadRootId, createdAt)` for thread expansion
- `(parentCommentId, createdAt)` for nested reply assembly
- `(authorSpotifyUserId, createdAt)` for future profile and moderation work
- unique or semi-unique support for `clientSubmissionId` + author to provide idempotent writes
- recommended unique constraint: `(authorSpotifyUserId, clientSubmissionId)`

## API Requirements

Keep read models split by use case.

### `GET /api/comments/markers?trackId=...`

Purpose:

- lightweight public marker data for the progress bar overlay and popup system

Response shape:

- `trackId`
- `version`
- `markers[]`

Each marker includes:

- `markerBucketSecond`
- `timestampMsRepresentative`
- `commentCount`
- `threadCount`
- `authors[]` with avatar/display name snapshots
- `previewComment`
- `topLevelCommentIds[]` or compact ids for follow-up fetches

Rules:

- server groups comments into one marker per displayed second
- replies do not create new markers
- `version` is the canonical freshness token for the track comment set and changes whenever any top-level comment or reply on that track changes

### `GET /api/comments/threads?trackId=...`

Purpose:

- public read of full top-level comments plus nested replies for the current track

Response shape:

- `trackId`
- `version` or `lastUpdatedAt`
- `threads[]`

Each thread includes:

- top-level comment metadata
- nested replies in chronological ascending order
- author snapshots
- attachment placeholders if any exist later

Support future incremental fetching with:

- optional `updatedAfter`
- optional `sinceVersion`

Canonical freshness rule:

- prefer a server-generated monotonic `version`
- if a monotonic version is not implemented immediately, use `lastUpdatedAt = max(updatedAt)` across the track comment set as the single authoritative fallback token

### `POST /api/comments`

Purpose:

- create a top-level comment thread anchor

Request body:

- `expectedTrackId`
- `expectedProgressMs`
- `capturedAt`
- `body`
- `clientSubmissionId`

Server behavior:

- require an explicit viewer session
- do not fall back to admin session identity
- perform a fresh playback read with current viewer tokens
- verify that the current track matches `expectedTrackId`
- compare progress drift with a tolerance window
- if accepted, save the comment using the server playback timestamp and marker bucket
- snapshot author display name, profile url, and image url at write time

Suggested tolerance:

- accept same-track drift within `max(2500ms, estimated request latency window)`

### `POST /api/comments/:commentId/replies`

Purpose:

- create a nested reply beneath an existing comment thread

Request body:

- `body`
- `clientSubmissionId`

Server behavior:

- require viewer session
- validate that parent comment exists
- inherit `trackSpotifyId`, `threadRootId`, and marker bucket from the top-level thread
- do not create a new marker

## Error Model

Use typed failures so the client can recover correctly.

### Comment Creation

- `401`: not signed in as a viewer
- `403`: viewer session lacks required Spotify permissions or playback access
- `409`: active playback moved to another track
- `412`: active playback is still the same track but progress drift exceeded tolerance
- `428`: no active playable session or no active device could be validated
- `429`: rate limited
- `5xx`: unexpected server error

Client handling requirements:

- preserve draft text for all retryable failures
- auto-retry only once for same-track drift within a recoverable window
- require explicit user confirmation for cross-track mismatch

## Polling And State Sync

- Marker reads should refresh when the current now-playing track changes.
- Marker reads should also refresh after successful comment creation without waiting for the normal 5-second playback poll.
- The comments thread panel should fetch full thread data only when the panel is opened, the track changes, or a local write succeeds.
- The popup dedupe key should include:
  - track id
  - marker bucket
  - playback session key
- A playback session key should reset when:
  - the track changes
  - the user seeks backward across a marker threshold in a way that should permit a new popup
- Polling should not refetch full thread trees on every now-playing refresh.

## Marker Grouping Rules

- Group top-level comments into one marker per displayed second.
- If several top-level comments fall into the same second, render one grouped marker.
- Replies do not create separate markers.
- Grouped marker preview shows one summary popup, not one popup per comment.
- Marker visual should show up to three avatars and a `+N` indicator if more threads are present.

## Accessibility Requirements

- Markers must be focusable by keyboard.
- Marker preview content must be available on hover, focus, and tap.
- Popup and preview content must be dismissible and not trap focus.
- Screen-reader labels must include timestamp, author, and count context.
- Nested replies in the full comments list should preserve semantic parent-child structure.

## Abuse And Moderation Baseline

- Reserve moderation fields in the schema now.
- Design for future soft-delete/tombstone behavior so replies can survive parent moderation if needed.
- No moderation UI is required in v1, but the data model must not block it later.

## Rollout Plan

1. Add Prisma schema and migration for comment and attachment tables.
   - if the migration is missing in an environment, public reads must degrade to empty/feature-disabled responses and writes must return a typed unavailable response instead of crashing routes
2. Add server APIs for marker reads, thread reads, top-level writes, and reply writes.
3. Add public read-only comments panel in now-playing.
4. Add signed-in top-level comment composer with fresh playback validation and typed mismatch recovery.
5. Add progress-bar markers and hover/focus/tap previews.
6. Add upcoming marker popup with once-per-session dedupe.
7. Add reply composer UI later.
8. Add attachment upload and rendering later.

## Acceptance Criteria

- Public visitors can read comments for the current track without signing in.
- Signed-in viewers can create top-level comments.
- Admin-only session presence never creates comments on behalf of a logged-out viewer.
- Successful writes use server-side playback timestamp, not browser timestamp.
- Idempotent write protection exists through `clientSubmissionId` uniqueness per author.
- Cross-track mismatch never saves a comment silently.
- Draft text survives mismatch and retryable failure states.
- Timeline markers render for top-level comments and group by second.
- Marker previews work on desktop hover, keyboard focus, and touch tap.
- On touch, only one marker preview is open at a time and outside taps dismiss it.
- The show-all-comments panel stays inside the now-playing section and updates when the track changes.
- If there is no active track, the panel shows a no-active-track state instead of stale comments.
- Replies are visible in the full list and excluded from separate marker rendering.
- Marker popup shows once per marker bucket per playback session unless the user explicitly seeks back and re-approaches it.
- The schema supports future image/audio attachments without redesigning the comment table.

## Testing Requirements

- Unit tests for marker bucket calculation and grouping.
- Unit tests for same-track progress tolerance handling.
- Unit tests for reply insertion and nested thread serialization.
- Unit tests for popup dedupe key behavior.
- Integration tests for:
  - public marker and thread reads
  - signed-in comment creation
  - viewer-only write enforcement
  - cross-track mismatch handling
  - same-track drift tolerance
  - grouped marker response shape
  - reply creation without marker creation

## Open Questions

- For grouped markers, should the preview prioritize newest comment, oldest comment, or a compact mini-list?
- When reply composer UI is added later, should replies inherit the parent timestamp visually or show their own creation time only?
- If moderation is added later, should deleted top-level comments leave a tombstone thread root with replies still visible?
