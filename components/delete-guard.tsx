"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { ADMIN_ONLY_DELETE, NO_EDIT_MESSAGE, canDelete, isBlockedEdit } from "@/lib/permissions"

// For users who may not delete (or edit): stop those requests before they are sent and show one clear message.
// The server refuses them anyway (proxy.ts); this just keeps pages from showing "Failed to delete" / "Failed to save".
export function DeleteGuard() {
  const { data: session, status } = useSession()
  const role = session?.user?.role

  useEffect(() => {
    if (status !== "authenticated" || (canDelete(role) && !isBlockedEdit(role, "PUT", "/api/"))) return
    const original = window.fetch
    window.fetch = (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const pathname = new URL(url, window.location.href).pathname
      const message =
        method === "DELETE" && pathname.startsWith("/api/") && !canDelete(role) ? ADMIN_ONLY_DELETE :
        isBlockedEdit(role, method, pathname) ? NO_EDIT_MESSAGE : null
      if (message) {
        alert(message)
        return Promise.resolve(new Response(JSON.stringify({ error: message, adminOnly: true }), {
          status: 403, headers: { "Content-Type": "application/json" },
        }))
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [status, role])

  return null
}
