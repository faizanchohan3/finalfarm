// Whether the dashboard shows the shop's real figures or the built-in sample dataset.
export const DASHBOARD_VIEW_COOKIE = "dashboard-view"

// Accounts that always start on their real figures (no sample data unless they ask for it)
const REAL_DATA_BY_DEFAULT = ["admin@mirzatraders.com"]

// ?data=real|sample wins, then the saved choice, then the account default (sample for others)
export function showSampleData(opts: { param?: string; saved?: string; email?: string | null }) {
  if (opts.param === "real" || opts.param === "sample") return opts.param === "sample"
  if (opts.saved === "real" || opts.saved === "sample") return opts.saved === "sample"
  return !REAL_DATA_BY_DEFAULT.includes((opts.email || "").toLowerCase())
}
