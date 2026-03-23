import Link from "next/link";

import { cn } from "@/lib/utils";

type NavigationProps = {
  isAdmin: boolean;
  playlistName: string;
  playlistUrl: string | null;
};

const publicLinks = [
  { href: "/", label: "Overview" },
  { href: "/active", label: "Active songs" },
  { href: "/history", label: "History" },
  { href: "/contributors", label: "Contributors" },
];

const adminLinks = [
  { href: "/setup", label: "Setup" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Logs" },
];

export function Navigation({ isAdmin, playlistName, playlistUrl }: NavigationProps) {
  return (
    <header className="border-b border-white/10 bg-[rgba(15,23,20,0.86)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[--color-accent]">
            Main playlist
          </p>
          {playlistUrl ? (
            <a
              href={playlistUrl}
              target="_blank"
              rel="noreferrer"
              className="text-2xl font-semibold tracking-tight text-stone-100 transition hover:text-[--color-accent]"
            >
              {playlistName}
            </a>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight text-stone-100">{playlistName}</h1>
          )}
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full border border-white/10 px-4 py-2 text-sm text-stone-200 transition hover:border-[--color-accent] hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin &&
            adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-[--color-accent]/40 bg-[--color-accent]/10 px-4 py-2 text-sm text-[--color-accent] transition hover:bg-[--color-accent]/20"
              >
                {link.label}
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
