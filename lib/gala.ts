// Gala Mandi: a buyer (trader) buys goods from a seller (farmer / supplier) through the mandi.
// The buyer owes the total amount and the seller is owed it — same as a commission entry with no commission.

// Like Bill Maker: weight is in KG and the rate is per KG or per Mound (40 kg).
export const RATE_PER = ["KG", "Mound"] as const
export type RatePer = (typeof RATE_PER)[number]
export const MOUND_KG = 40

// Row amount: per KG = kg × rate; per Mound = kg ÷ 40 × rate
export function galaRowAmount(kg: number, ratePer: string, rate: number) {
  return ratePer === "Mound" ? (kg / MOUND_KG) * rate : kg * rate
}

// qty is in `unit` (always KG for new rows; older entries may have Bag / Tora / Mound)
export type GalaItem = { product: string; qty: number; unit: string; ratePer?: RatePer; rate: number; amount: number }

// What an item's rate is per — older rows had no ratePer: their rate was per their unit (per kg for Mound)
export function itemRatePer(i: { unit?: string; ratePer?: string }) {
  return i.ratePer || (i.unit === "Mound" ? "KG" : i.unit || "KG")
}

// An item as a form row in KG. Old Mound rows (mounds × 40 × rate per kg) convert exactly to KG;
// old Bag / Tora rows keep their numbers so the amount doesn't change.
export function itemToKgRow(i: GalaItem) {
  if (i.ratePer) return { qty: i.qty, ratePer: i.ratePer, rate: i.rate }
  if (i.unit === "Mound") return { qty: i.qty * MOUND_KG, ratePer: "KG" as RatePer, rate: i.rate }
  return { qty: i.qty, ratePer: "KG" as RatePer, rate: i.rate }
}

// Post (sign = 1) or take back (sign = -1) an entry's effect on the buyer's and seller's balances.
export async function applyGala(
  tx: any,
  e: { customerId: string | null; farmerId: string | null; supplierId: string | null; totalAmount: number },
  sign: 1 | -1,
) {
  const amt = sign * (e.totalAmount || 0)
  if (!amt) return
  if (e.customerId) await tx.customer.update({ where: { id: e.customerId }, data: { balance: { increment: amt } } })
  if (e.farmerId) await tx.farmer.update({ where: { id: e.farmerId }, data: { balance: { increment: amt } } })
  if (e.supplierId) await tx.supplier.update({ where: { id: e.supplierId }, data: { balance: { increment: amt } } })
}

// Short product list for ledgers, e.g. "Wheat 120 KG, Rice 40 Bag"
export function galaItemsText(items: unknown) {
  const list = Array.isArray(items) ? (items as GalaItem[]) : []
  return list.map((i) => `${i.product} ${(i.qty || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })} ${i.unit}`).join(", ")
}
