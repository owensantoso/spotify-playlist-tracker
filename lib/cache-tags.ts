export const cacheTags = {
  appSettings: "app-settings",
  appShell: "app-shell",
  overviewStats: "overview-stats",
  lengthStats: "length-stats",
  activeSongs: "active-songs",
  recentHistory: "recent-history",
  contributorLeaderboard: "contributor-leaderboard",
  longestLastingSongs: "longest-lasting-songs",
  dashboardCharts: "dashboard-charts",
  syncRuns: "sync-runs",
} as const;

export function getAllStatsCacheTags() {
  return [
    cacheTags.overviewStats,
    cacheTags.lengthStats,
    cacheTags.activeSongs,
    cacheTags.recentHistory,
    cacheTags.contributorLeaderboard,
    cacheTags.longestLastingSongs,
    cacheTags.dashboardCharts,
    cacheTags.syncRuns,
  ] as const;
}
