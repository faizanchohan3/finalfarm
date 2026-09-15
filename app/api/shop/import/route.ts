import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

// Ordered table configs. `shop` = stamp target shopId, `user` = fields pointing at a
// User (remapped to the importing user), `fks` = cross-entity references remapped via
// the id map built as we go, `required` = fks that must resolve or the row is skipped.
type Cfg = {
  key: string
  shop?: boolean
  user?: string[]
  fks?: Record<string, string>
  required?: string[]
}

const ORDER: Cfg[] = [
  { key: "category", shop: true },
  { key: "product", shop: true, fks: { categoryId: "category" }, required: ["categoryId"] },
  { key: "customer", shop: true },
  { key: "supplier", shop: true },
  { key: "farmer", shop: true },
  { key: "bank", shop: true },
  { key: "account", shop: true },
  { key: "commissionAgent", shop: true },
  { key: "pesticideCategory", shop: true },
  { key: "pesticide", shop: true, fks: { categoryId: "pesticideCategory" }, required: ["categoryId"] },
  { key: "sale", shop: true, user: ["createdById"], fks: { customerId: "customer", farmerId: "farmer" } },
  { key: "saleItem", fks: { saleId: "sale", productId: "product" }, required: ["saleId", "productId"] },
  { key: "purchase", shop: true, user: ["createdById"], fks: { supplierId: "supplier", farmerId: "farmer", sellerCustomerId: "customer" } },
  { key: "purchaseItem", fks: { purchaseId: "purchase", productId: "product" }, required: ["purchaseId", "productId"] },
  { key: "payment", fks: { saleId: "sale", purchaseId: "purchase", bankId: "bank" } },
  { key: "commission", shop: true, user: ["createdById"], fks: { farmerId: "farmer", supplierId: "supplier", customerId: "customer" } },
  { key: "commissionPayment", fks: { commissionId: "commission" }, required: ["commissionId"] },
  { key: "customerPayment", fks: { customerId: "customer" }, required: ["customerId"] },
  { key: "supplierPayment", fks: { supplierId: "supplier" }, required: ["supplierId"] },
  { key: "pesticideSale", shop: true, user: ["soldById"], fks: { pesticideId: "pesticide", customerId: "customer", farmerId: "farmer" }, required: ["pesticideId"] },
  { key: "transaction", shop: true, user: ["createdById"], fks: { bankId: "bank", accountId: "account" } },
  { key: "farmerPurchase", user: ["createdById"], fks: { farmerId: "farmer" }, required: ["farmerId"] },
  { key: "farmerPurchaseItem", fks: { purchaseId: "farmerPurchase", productId: "product" }, required: ["purchaseId", "productId"] },
  { key: "farmerPayment", fks: { farmerId: "farmer", purchaseId: "farmerPurchase", bankId: "bank" }, required: ["farmerId"] },
  { key: "agentCommission", fks: { agentId: "commissionAgent" }, required: ["agentId"] },
  { key: "task", shop: true, user: ["createdById", "assignedToId"] },
  { key: "stockMovement", fks: { productId: "product" }, required: ["productId"] },
]

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const userId = session.user.id
  if (!shopId) return NextResponse.json({ error: "No shop associated with this account" }, { status: 400 })
  if (session.user.role === "CASHIER" || session.user.role === "AUDITOR") {
    return NextResponse.json({ error: "You do not have permission to import data" }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid file — could not parse JSON" }, { status: 400 })
  }

  if (body?.type !== "gala-mandi-shop-backup" || !body?.data) {
    return NextResponse.json({ error: "This is not a valid shop backup file" }, { status: 400 })
  }

  const data = body.data as Record<string, any[]>
  const idMap: Record<string, Record<string, string>> = {}
  const counts: Record<string, number> = {}
  const skipped: Record<string, number> = {}

  try {
    for (const cfg of ORDER) {
      const rows = Array.isArray(data[cfg.key]) ? data[cfg.key] : []
      idMap[cfg.key] = {}
      const delegate = (db as any)[cfg.key]
      if (!delegate) continue

      for (const row of rows) {
        const oldId = row?.id
        if (!oldId) continue
        const rec: any = { ...row }
        delete rec.id

        if (cfg.shop) rec.shopId = shopId
        for (const uf of cfg.user || []) {
          if (rec[uf] != null) rec[uf] = userId
        }

        let skip = false
        for (const [field, ref] of Object.entries(cfg.fks || {})) {
          if (rec[field] != null) {
            const mapped = idMap[ref]?.[rec[field]]
            if (mapped) {
              rec[field] = mapped
            } else if ((cfg.required || []).includes(field)) {
              skip = true
              break
            } else {
              rec[field] = null
            }
          }
        }
        if (skip) {
          skipped[cfg.key] = (skipped[cfg.key] || 0) + 1
          continue
        }

        const created = await delegate.create({ data: rec })
        idMap[cfg.key][oldId] = created.id
        counts[cfg.key] = (counts[cfg.key] || 0) + 1
      }
    }
  } catch (err: any) {
    console.error("Shop import error:", err)
    return NextResponse.json(
      { error: `Import failed partway through: ${err?.message || "unknown error"}`, imported: counts },
      { status: 500 }
    )
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  await createAuditLog({
    userId,
    action: "CREATE",
    module: "SETTINGS",
    details: `Imported shop backup "${body.shopName || "?"}" — ${total} records`,
  })

  return NextResponse.json({ success: true, imported: counts, skipped, total })
}
