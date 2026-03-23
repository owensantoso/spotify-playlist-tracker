# Flavor of the Moment Tracker

Flavor of the Moment Tracker is a small full-stack app for watching one collaborative Spotify playlist over time.

It preserves playlist history, tracks each song’s lifecycle, mirrors unique songs into an archive playlist, surfaces contributor and longevity stats, and can optionally post Discord notifications when new songs appear.

## Feature Summary

- Single-admin Spotify OAuth flow with server-side token storage and refresh
- Historical lifecycle tracking for playlist additions, removals, and re-additions
- Archive playlist automation with local dedupe tracking
- Public read-only dashboard for overview, active songs, history, and contributors
- Private admin pages for setup, settings, sync control, and sync logs
- Protected manual sync endpoint and protected scheduler endpoint
- Discord webhook notifications for additions
- Prisma schema plus bootstrap SQL migration

## Stack

- [Next.js](https://nextjs.org/) App Router
- TypeScript
- PostgreSQL
- Prisma ORM
- Spotify Web API
- Discord webhooks
- GitHub Actions for free-tier scheduling by default

## How It Works

The app monitors one main Spotify playlist and stores historical lifecycle rows for each observed appearance of a track.

Lifecycle matching uses:

- Spotify track ID
- Spotify `added_at`
- Spotify `added_by`
- occurrence ordinal for duplicate identical playlist entries

That means:

- repeated syncs with no playlist changes are idempotent
- removed songs get a `removedObservedAt` timestamp
- re-added songs create a new lifecycle row instead of reopening an old one

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Variables:

- `DATABASE_URL`: PostgreSQL connection string
- `APP_URL`: base URL for the app, such as `http://localhost:3000`
- `SESSION_SECRET`: long random string used for signed admin session cookies
- `TOKEN_ENCRYPTION_KEY`: long random string used to encrypt Spotify tokens in the database
- `CRON_SECRET`: shared secret used by the protected scheduler endpoint
- `SPOTIFY_CLIENT_ID`: Spotify app client ID
- `SPOTIFY_CLIENT_SECRET`: Spotify app client secret
- `SPOTIFY_REDIRECT_URI`: Spotify callback URL, usually `http://localhost:3000/api/auth/spotify/callback`
- `MAIN_PLAYLIST_ID`: Spotify ID of the tracked playlist
- `ARCHIVE_PLAYLIST_ID`: Spotify ID of the archive playlist
- `SYNC_INTERVAL_MINUTES`: display/config value for expected sync cadence; default is `60`
- `DISCORD_WEBHOOK_URL`: optional Discord webhook URL

## Spotify Developer App Setup

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add your callback URL to the app settings.
3. Set `SPOTIFY_REDIRECT_URI` to the same callback URL.
4. The first Spotify account that completes setup becomes the stored admin account.
5. The app requests these scopes:
   - `user-read-private`
   - `playlist-read-private`
   - `playlist-read-collaborative`
   - `playlist-modify-private`
   - `playlist-modify-public`

Notes:

- The main playlist only needs to be readable by the admin account.
- The archive playlist must be writable by the admin account.
- The current archive validation is best-effort based on playlist ownership/collaborative status because Spotify does not provide a pure write-permission probe without mutation.

## Database Setup

The repo includes both:

- the Prisma schema: [`prisma/schema.prisma`](/Users/macintoso/Documents/VSCode/spotify-playlist-tracker/prisma/schema.prisma)
- a bootstrap SQL migration: [`prisma/migrations/0001_init/migration.sql`](/Users/macintoso/Documents/VSCode/spotify-playlist-tracker/prisma/migrations/0001_init/migration.sql)

For local development:

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
```

If you prefer a development migration flow against a local Postgres instance:

```bash
npm run prisma:migrate
```

## Running Locally

1. Start PostgreSQL locally.
2. Create and fill `.env.local`.
3. Install dependencies.
4. Apply migrations.
5. Start the app.

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Authentication Flow

1. Visit `/setup`.
2. Click `Connect Spotify`.
3. Complete Spotify OAuth with the Spotify account you want to become the admin.
4. Return to `/setup` and confirm playlist validation.
5. Optionally seed archive dedupe entries from the existing archive playlist before the first sync.

Admin session state is stored in an HTTP-only signed cookie. Spotify access and refresh tokens are encrypted before being written to the database. The first successful Spotify login wins and establishes the admin account for that database.

## Configuring Playlist IDs

You can provide playlist IDs in env vars for first boot:

- `MAIN_PLAYLIST_ID`
- `ARCHIVE_PLAYLIST_ID`

After boot, the values are seeded into the `AppSettings` record and can be edited in `/admin/settings`.

## Running a Sync Manually

As an authenticated admin:

- open `/setup` and use `Run Sync Now`, or
- `POST` to `/api/admin/sync` with the admin session cookie

The response is JSON and includes the sync outcome.

## Scheduling Syncs

This repo is set up for a no-cost-friendly scheduling path rather than paid cron hosting.

Default approach:

- protected endpoint: `POST /api/cron/sync`
- auth: `Authorization: Bearer $CRON_SECRET`
- scheduler: GitHub Actions workflow at [`.github/workflows/scheduled-sync.yml`](/Users/macintoso/Documents/VSCode/spotify-playlist-tracker/.github/workflows/scheduled-sync.yml)

The included workflow runs hourly by default:

- this is friendlier to free hosting limits
- it reduces unnecessary Spotify/API churn
- it can be changed later if you are comfortable with the tradeoff

GitHub Actions setup:

1. Add repo secret `APP_URL`
2. Add repo secret `CRON_SECRET`
3. Enable Actions for the repo
4. Optionally trigger the workflow manually with `workflow_dispatch`

If you want a more aggressive cadence later, update the workflow cron expression and `SYNC_INTERVAL_MINUTES`.

## Discord Notifications

Discord notifications are optional and off by default.

When enabled in settings:

- new additions can be posted as a batch or one-by-one
- payloads include track name, artist, contributor, and Spotify link
- failures are logged in the sync run record and do not roll back the successful sync snapshot

## Deployment

Recommended low-cost deployment path:

- frontend/app hosting: Vercel Hobby
- database: Supabase Postgres or another low-cost Postgres host
- scheduler: GitHub Actions hitting `/api/cron/sync`

Deployment checklist:

1. Provision PostgreSQL.
2. Set all environment variables in your hosting platform.
3. Run Prisma migrations against production.
4. Configure GitHub Actions secrets.
5. Visit `/setup` and complete Spotify auth.
6. Seed archive entries if your archive playlist already contains tracks.

## Testing

Available checks:

```bash
npm run lint
npm run test
npm run build
```

Current automated tests focus on:

- normalization of Spotify playlist items
- lifecycle reconciliation logic
- Discord payload formatting

## Known Limitations

- No true real-time Spotify playlist webhooks; this app relies on polling.
- Removal timestamps are inferred from the first observed absence, not exact Spotify removal times.
- Archive dedupe is based on Spotify track ID only in v1.
- Playlist write validation for the archive playlist is best-effort rather than a mutation-free guarantee.
- Public dashboard pages assume the app settings keep `publicDashboard` enabled.
- Full browser QA requires a configured database and valid Spotify credentials.

## Assumptions

- Single-admin app, not multi-user.
- Public dashboard is enabled by default, while settings and admin actions stay private.
- Default free-tier cadence is hourly, even though the sync engine itself supports shorter intervals.
- Median lifetime is computed from completed lifecycles only.

## Future Ideas

- Track detail and contributor detail pages
- archive repair job for historical backfills
- richer sync failure diagnostics
- exportable CSV reports
- notification templates for removals and weekly summaries
