import { auth } from "@/auth"
import { NextResponse } from "next/server"

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth
  const pathname = req.nextUrl.pathname
  const isLoginPage = pathname === "/login"
  const role = req.auth?.user?.role
  const isSuperAdmin = role === "SUPER_ADMIN"

  // Only redirect page routes to login — never redirect API routes
  if (!isLoggedIn && !isLoginPage && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  if (isLoggedIn && isLoginPage) {
    // Super admin always lands on /shops
    const dest = isSuperAdmin ? "/shops" : "/dashboard"
    return NextResponse.redirect(new URL(dest, req.nextUrl))
  }

  // Super admin can ONLY access /shops and /profile — but never redirect API routes
  const superAdminAllowed = pathname.startsWith("/shops") || pathname.startsWith("/profile")
  if (isLoggedIn && isSuperAdmin && !superAdminAllowed && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/shops", req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
