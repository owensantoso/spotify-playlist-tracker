ALTER TABLE "Track"
ADD COLUMN "nameRomanized" TEXT,
ADD COLUMN "artistNamesRomanized" TEXT[] DEFAULT ARRAY[]::TEXT[];
