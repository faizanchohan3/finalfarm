import { RATE_PER, galaRowAmount, type GalaItem, type RatePer } from "@/lib/gala"

const round = (v: number) => Math.round(v * 100) / 100

// Validate and normalise a Gala Mandi entry from the form. Totals are always recalculated here.
export function galaFields(body: any) {
  const items: GalaItem[] = (Array.isArray(body.items) ? body.items : [])
    .map((r: any) => {
      const qty = parseFloat(r.qty) || 0
      const rate = parseFloat(r.rate) || 0
      // Weight is in KG; the rate is per KG or per Mound (40 kg)
      const ratePer: RatePer = RATE_PER.includes(r.ratePer) ? r.ratePer : "KG"
      return {
        product: String(r.product || "").trim(),
        qty,
        unit: "KG",
        ratePer,
        rate,
        amount: round(galaRowAmount(qty, ratePer, rate)),
      }
    })
    .filter((r: GalaItem) => r.product || r.qty || r.rate)

  if (!body.customerId && !String(body.walkInBuyer || "").trim()) return { error: "Select or enter a buyer" } as const
  if (!body.farmerId && !body.supplierId && !String(body.walkInSeller || "").trim()) return { error: "Select or enter a seller" } as const
  if (items.length === 0) return { error: "Add at least one product row" } as const
  if (items.some((r) => !r.product)) return { error: "Every row needs a product" } as const
  if (items.some((r) => r.qty <= 0)) return { error: "Every row needs a weight greater than 0" } as const

  const date = body.entryDate ? new Date(body.entryDate) : new Date()
  return {
    entryDate: isNaN(date.getTime()) ? new Date() : date,
    customerId: body.customerId || null,
    walkInBuyer: body.customerId ? null : String(body.walkInBuyer || "").trim() || null,
    farmerId: body.farmerId || null,
    supplierId: body.farmerId ? null : body.supplierId || null,
    walkInSeller: body.farmerId || body.supplierId ? null : String(body.walkInSeller || "").trim() || null,
    items,
    totalWeight: round(items.reduce((s, r) => s + r.qty, 0)),
    totalRate: round(items.reduce((s, r) => s + r.rate, 0)),
    totalAmount: round(items.reduce((s, r) => s + r.amount, 0)),
    notes: String(body.notes || "").trim() || null,
  }
}

// Buyer / seller must belong to this shop
export async function checkParties(tx: any, f: { customerId: string | null; farmerId: string | null; supplierId: string | null }, shopId: string | null | undefined) {
  const own = shopId ? { shopId } : {}
  if (f.customerId && !(await tx.customer.findFirst({ where: { id: f.customerId, ...own } }))) return "Buyer not found"
  if (f.farmerId && !(await tx.farmer.findFirst({ where: { id: f.farmerId, ...own } }))) return "Seller (farmer) not found"
  if (f.supplierId && !(await tx.supplier.findFirst({ where: { id: f.supplierId, ...own } }))) return "Seller (supplier) not found"
  return null
}
