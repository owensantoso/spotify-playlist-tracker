import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { Navigation } from "@/components/navigation";
import { getNowPlayingTrack } from "@/lib/services/now-playing-service";
import { getMainPlaylistHeader } from "@/lib/services/stats-service";
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Flavor of the Moment Tracker",
  description: "Track a collaborative Spotify playlist, preserve its history, and keep an always-growing archive.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [playlistHeader, nowPlaying] = await Promise.all([
    getMainPlaylistHeader(),
    getNowPlayingTrack(),
  ]);

  return (
    <html
      lang="en"
        className={`${displayFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[--color-ink] text-stone-100">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,181,91,0.18),_transparent_32%),radial-gradient(circle_at_80%_0%,_rgba(107,167,128,0.18),_transparent_30%),linear-gradient(180deg,_#10201a,_#08110d_58%,_#050907)]">
          <Navigation
            playlistName={playlistHeader.name}
            playlistUrl={playlistHeader.spotifyUrl}
            nowPlaying={nowPlaying}
          />
          <main className="pb-16">{children}</main>
        </div>
      </body>
    </html>
  );
}
