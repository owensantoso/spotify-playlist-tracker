ALTER TABLE "Track"
ADD COLUMN "artistSpotifyUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Track"
SET "artistSpotifyUrls" = ARRAY[]::TEXT[]
WHERE "artistSpotifyUrls" IS NULL;

ALTER TABLE "Track"
ALTER COLUMN "artistSpotifyUrls" SET NOT NULL,
ALTER COLUMN "artistSpotifyUrls" SET DEFAULT ARRAY[]::TEXT[];
