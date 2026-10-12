// Who may delete records. Everyone else (Accountant, Manager, Cashier, Auditor) can view, add and edit
// as their role allows (Accountant cannot edit, see NO_EDIT_ROLES), but deletes are refused — by proxy.ts on the server and DeleteGuard in the browser.
export const DELETE_ROLES = ["ADMIN", "SUPER_ADMIN"]

export const canDelete = (role: string | null | undefined) => !!role && DELETE_ROLES.includes(role)

export const ADMIN_ONLY_DELETE = "Only an admin can delete records. Ask your admin to delete this."

// Roles that may add entries but never edit them. Every edit in the app is an HTTP PUT/PATCH to /api/;
// /api/profile stays open so they can still change their own name and password.
export const NO_EDIT_ROLES = ["ACCOUNTANT"]
export const NO_EDIT_MESSAGE = "You cannot edit entries. Ask your admin to make this change."

export const isBlockedEdit = (role: string | null | undefined, method: string, pathname: string) =>
  !!role && NO_EDIT_ROLES.includes(role) &&
  (method === "PUT" || method === "PATCH") &&
  pathname.startsWith("/api/") && !pathname.startsWith("/api/profile")
