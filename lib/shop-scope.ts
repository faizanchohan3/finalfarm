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
  | "product" | "purchase" | "supplier" | "task" | "transaction" | "user" | "vehicle"

// True when the record exists and belongs to the caller's shop (always true for the super admin).
export async function ownsRecord(model: ShopModel, id: string, session: ScopedSession) {
  if (!session.user.shopId) return true
  const scope = LEGACY_CREATOR_SCOPED.has(model) ? shopOrCreatorWhere(session) : shopWhere(session)
  const row = await (db as any)[model].findFirst({ where: { id, ...scope }, select: { id: true } })
  return !!row
}

// Which table each linked-record field in a request body points at
const REF_MODELS: Record<string, string> = {
  customerId: "customer", sellerCustomerId: "customer", buyerId: "customer",
  farmerId: "farmer", supplierId: "supplier", buyerSupplierId: "supplier",
  productId: "product", categoryId: "category", roomId: "room",
  bankId: "bank", accountId: "account", driverId: "driver", vehicleId: "vehicle",
  agentId: "commissionAgent", pesticideId: "pesticide", lotId: "lot", commissionId: "commission",
  warehouseId: "warehouse", fromWarehouseId: "warehouse", toWarehouseId: "warehouse",
  assignedToId: "user",
}

// Checks every linked record id in a request body (including inside item lists) belongs to the
// caller's shop. Returns an error message for the first one that doesn't, or null when all are fine.
// `overrides` remaps a field to another table, e.g. { categoryId: "pesticideCategory" }.
export async function refsOutsideShop(session: ScopedSession, body: unknown, overrides: Record<string, string> = {}) {
  const shopId = session.user.shopId
  if (!shopId) return null
  const map = { ...REF_MODELS, ...overrides }
  const wanted = new Map<string, Set<string>>()
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 3) return
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1))
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (map[k] && typeof val === "string" && val) {
        if (!wanted.has(map[k])) wanted.set(map[k], new Set())
        wanted.get(map[k])!.add(val)
      } else if (val && typeof val === "object") walk(val, depth + 1)
    }
  }
  walk(body, 0)
  for (const [model, ids] of wanted) {
    const found = await (db as any)[model].count({ where: { id: { in: [...ids] }, shopId } })
    if (found < ids.size) return "Selected record does not belong to this shop"
  }
  return null
}
