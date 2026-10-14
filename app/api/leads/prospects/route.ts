import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { normalizePhone } from "@/lib/leads"

type Max = { _max: { createdAt: Date | null } }

// Lead finder: existing traders, farmers and suppliers who have gone quiet — no Gala Mandi entry,
// commission or bill for `days` days (or never) — so they can be added to the pipeline and won back.
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId || null
  const shopFilter = shopId ? { shopId } : {}
  const days = Math.max(7, Math.min(730, parseInt(new URL(req.url).searchParams.get("days") || "60") || 60))
  const cutoff = new Date(Date.now() - days * 86_400_000)

  const [customers, farmers, suppliers, leads] = await Promise.all([
    db.customer.findMany({ where: { ...shopFilter, isActive: true }, select: { id: true, name: true, phone: true, address: true, createdAt: true } }),
    db.farmer.findMany({ where: { ...shopFilter, isActive: true }, select: { id: true, name: true, phone: true, address: true, village: true, createdAt: true } }),
    db.supplier.findMany({ where: { ...shopFilter, isActive: true }, select: { id: true, name: true, phone: true, address: true, createdAt: true } }),
    db.lead.findMany({ where: shopFilter, select: { phone: true, name: true } }),
  ])

  const [gC, gSC, gF, gS, gBS, cC, cF, cS, bC] = await Promise.all([
    db.galaEntry.groupBy({ by: ["customerId"], _max: { createdAt: true }, where: { ...shopFilter, customerId: { not: null } } }),
    db.galaEntry.groupBy({ by: ["sellerCustomerId"], _max: { createdAt: true }, where: { ...shopFilter, sellerCustomerId: { not: null } } }),
    db.galaEntry.groupBy({ by: ["farmerId"], _max: { createdAt: true }, where: { ...shopFilter, farmerId: { not: null } } }),
    db.galaEntry.groupBy({ by: ["supplierId"], _max: { createdAt: true }, where: { ...shopFilter, supplierId: { not: null } } }),
    db.galaEntry.groupBy({ by: ["buyerSupplierId"], _max: { createdAt: true }, where: { ...shopFilter, buyerSupplierId: { not: null } } }),
    db.commission.groupBy({ by: ["customerId"], _max: { createdAt: true }, where: { ...shopFilter, customerId: { not: null } } }),
    db.commission.groupBy({ by: ["farmerId"], _max: { createdAt: true }, where: { ...shopFilter, farmerId: { not: null } } }),
    db.commission.groupBy({ by: ["supplierId"], _max: { createdAt: true }, where: { ...shopFilter, supplierId: { not: null } } }),
    db.bill.groupBy({ by: ["customerId"], _max: { createdAt: true }, where: { ...shopFilter, customerId: { not: null } } }),
  ])

  const last = new Map<string, Date>()
  const fold = (rows: (Max & Record<string, unknown>)[], key: string) => {
    for (const r of rows) {
      const id = r[key] as string | null
      const d = r._max.createdAt
      if (!id || !d) continue
      const prev = last.get(id)
      if (!prev || d > prev) last.set(id, d)
    }
  }
  fold(gC, "customerId"); fold(gSC, "sellerCustomerId"); fold(cC, "customerId"); fold(bC, "customerId")
  fold(gF, "farmerId"); fold(cF, "farmerId")
  fold(gS, "supplierId"); fold(gBS, "buyerSupplierId"); fold(cS, "supplierId")

  const leadPhones = new Set(leads.map((l) => normalizePhone(l.phone)).filter(Boolean))
  const leadNames = new Set(leads.map((l) => l.name.trim().toLowerCase()))

  const build = (type: "TRADER" | "FARMER" | "SUPPLIER", rows: { id: string; name: string; phone: string | null; address: string | null; village?: string | null; createdAt: Date }[]) =>
    rows
      .map((r) => {
        const lastActivity = last.get(r.id) || null
        return {
          id: r.id, type, name: r.name, phone: r.phone, address: r.village || r.address,
          lastActivity,
          daysQuiet: lastActivity ? Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000) : null,
          alreadyLead: (!!r.phone && leadPhones.has(normalizePhone(r.phone))) || leadNames.has(r.name.trim().toLowerCase()),
        }
      })
      // Never-active contacts only count once they've been on the books past the cutoff too
      .filter((p) => (p.lastActivity ? p.lastActivity < cutoff : rows.find((r) => r.id === p.id)!.createdAt < cutoff))

  const prospects = [...build("TRADER", customers), ...build("FARMER", farmers), ...build("SUPPLIER", suppliers)]
    .sort((a, b) => (a.daysQuiet ?? 1e9) - (b.daysQuiet ?? 1e9))

  return NextResponse.json({ prospects, days })
}
