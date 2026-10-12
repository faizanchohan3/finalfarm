"use client"

import { useSession } from "next-auth/react"
import { isBlockedEdit } from "@/lib/permissions"

// False for roles that may not edit entries (Accountant) — used to hide Edit buttons.
export function useCanEdit() {
  const { data: session } = useSession()
  return !isBlockedEdit(session?.user?.role, "PUT", "/api/")
}
