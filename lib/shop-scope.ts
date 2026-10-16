import { db } from "./db"

type ScopedSession = { user: { shopId?: string | null } }

// Shop users only ever see their own shop's rows; the super admin (no shopId) sees every shop.
export function shopWhere(session: ScopedSession) {
  return session.user.shopId ? { shopId: session.user.shopId } : {}
}

// Like shopWhere, but also matches older rows saved without a shopId through the shop of the
// user who created them (tasks and gate entries were stored that way)
export function shopOrCreatorWhere(session: ScopedSession) {
  const shopId = session.user.shopId
  return shopId ? { OR: [{ shopId }, { shopId: null, createdBy: { shopId } }] } : {}
}

const LEGACY_CREATOR_SCOPED = new Set(["task", "gateEntry"])

// Models with their own shopId column that [id] routes read or change by id
type ShopModel =
  | "agentCommission" | "bank" | "bill" | "commission" | "commissionAgent" | "customer"
  | "deletedRecord" | "driver" | "farmer" | "farmerPurchase" | "freightSlip" | "galaEntry"
  | "gateEntry" | "lot" | "lotSale" | "markha" | "pesticide" | "pesticideCategory"
  | "product" | "purchase" | "supplier" | "task" | "transaction" | "user"

// True when the record exists and belongs to the caller's shop (always true for the super admin).
export async function ownsRecord(model: ShopModel, id: string, session: ScopedSession) {
  if (!session.user.shopId) return true
  const scope = LEGACY_CREATOR_SCOPED.has(model) ? shopOrCreatorWhere(session) : shopWhere(session)
  const row = await (db as any)[model].findFirst({ where: { id, ...scope }, select: { id: true } })
  return !!row
}
