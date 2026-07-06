import { db } from "./db"

export async function createAuditLog({
  userId,
  shopId,
  action,
  module,
  details,
  ipAddress,
}: {
  userId: string
  shopId?: string | null
  action: string
  module: string
  details?: string
  ipAddress?: string
}) {
  try {
    await db.auditLog.create({
      data: { userId, shopId: shopId || null, action, module, details, ipAddress },
    })
  } catch {
    // Audit failures should not break the main operation
  }
}
