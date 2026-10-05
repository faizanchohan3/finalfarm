"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { ADMIN_ONLY_DELETE, canDelete } from "@/lib/permissions"

// For users who may not delete: stop delete requests before they are sent and show one clear message.
// The server refuses them anyway (proxy.ts); this just keeps pages from showing "Failed to delete".
export function DeleteGuard() {
  const { data: session, status } = useSession()
  const role = session?.user?.role

  useEffect(() => {
    if (status !== "authenticated" || canDelete(role)) return
    const original = window.fetch
    window.fetch = (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (method === "DELETE" && new URL(url, window.location.href).pathname.startsWith("/api/")) {
        alert(ADMIN_ONLY_DELETE)
        return Promise.resolve(new Response(JSON.stringify({ error: ADMIN_ONLY_DELETE, adminOnly: true }), {
          status: 403, headers: { "Content-Type": "application/json" },
        }))
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [status, role])

  return null
}
