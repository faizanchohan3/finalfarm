// Gala Mandi: a buyer (trader) buys goods from a seller (farmer / supplier) through the mandi.
// The buyer owes the total amount and the seller is owed it — same as a commission entry with no commission.

export const GALA_UNITS = ["KG", "Bag", "Tora"] as const

export type GalaItem = { product: string; qty: number; unit: string; rate: number; amount: number }

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
