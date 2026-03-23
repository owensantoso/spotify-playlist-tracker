CREATE TABLE "UserAccount" (
    "spotifyUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "grantedScopes" TEXT[],
    "lastAuthenticatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("spotifyUserId")
);

ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_spotifyUserId_fkey" FOREIGN KEY ("spotifyUserId") REFERENCES "SpotifyUser"("spotifyUserId") ON DELETE CASCADE ON UPDATE CASCADE;
