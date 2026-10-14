import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { ADMIN_ONLY_DELETE, NO_EDIT_MESSAGE, canDelete, isBlockedEdit } from "@/lib/permissions"

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth
  const pathname = req.nextUrl.pathname
  const isLoginPage = pathname === "/login"
  // Public lead-capture form shared with prospects (no login)
  const isPublicPage = pathname.startsWith("/enquiry/")
  const role = req.auth?.user?.role
  const isSuperAdmin = role === "SUPER_ADMIN"

  // Only redirect page routes to login â€” never redirect API routes
  if (!isLoggedIn && !isLoginPage && !isPublicPage && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  // Only admins may delete anything — every delete in the app is an HTTP DELETE to /api/
  if (isLoggedIn && req.method === "DELETE" && pathname.startsWith("/api/") && !canDelete(role)) {
    return NextResponse.json({ error: ADMIN_ONLY_DELETE }, { status: 403 })
  }

  // Accountants may add entries but not edit them
  if (isLoggedIn && isBlockedEdit(role, req.method, pathname)) {
    return NextResponse.json({ error: NO_EDIT_MESSAGE }, { status: 403 })
  }

  if (isLoggedIn && isLoginPage) {
    // Super admin always lands on /shops
    const dest = isSuperAdmin ? "/shops" : "/dashboard"
    return NextResponse.redirect(new URL(dest, req.nextUrl))
  }

  // Super admin can ONLY access /shops and /profile â€” but never redirect API routes
  const superAdminAllowed = pathname.startsWith("/shops") || pathname.startsWith("/profile")
  if (isLoggedIn && isSuperAdmin && !superAdminAllowed && !isPublicPage && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/shops", req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}

