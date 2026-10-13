import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { DASHBOARD_VIEW_COOKIE } from "@/lib/dashboard-view"

// Dashboard header buttons: remember whether this browser shows the shop's real figures or the
// sample dataset, then go back to the dashboard. GET /api/dashboard-view?mode=real|sample
export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get("mode") === "sample" ? "sample" : "real"
  const store = await cookies()
  store.set(DASHBOARD_VIEW_COOKIE, mode, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" })
  return NextResponse.redirect(new URL("/dashboard", req.url))
}
