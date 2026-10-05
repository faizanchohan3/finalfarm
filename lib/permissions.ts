// Who may delete records. Everyone else (Accountant, Manager, Cashier, Auditor) can view, add and edit
// as their role allows, but deletes are refused — by proxy.ts on the server and DeleteGuard in the browser.
export const DELETE_ROLES = ["ADMIN", "SUPER_ADMIN"]

export const canDelete = (role: string | null | undefined) => !!role && DELETE_ROLES.includes(role)

export const ADMIN_ONLY_DELETE = "Only an admin can delete records. Ask your admin to delete this."
