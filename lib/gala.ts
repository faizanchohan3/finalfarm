// Gala Mandi: a buyer (trader) buys goods from a seller (farmer / supplier) through the mandi.
// The buyer owes the total amount and the seller is owed it — same as a commission entry with no commission.

import { recordCode } from "@/lib/record-code"

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

// Take back (sign = -1) or re-apply (sign = 1) the balance effect of an entry's Received / Paid payments.
// A received payment lowered the buyer's balance; a paid one lowered the seller's.
export async function applyGalaPayments(
  tx: any,
  p: { customerPayments?: any[]; farmerPayments?: any[]; supplierPayments?: any[] },
  sign: 1 | -1,
) {
  for (const cp of p.customerPayments || []) await tx.customer.update({ where: { id: cp.customerId }, data: { balance: { increment: -sign * cp.amount } } })
  for (const fp of p.farmerPayments || []) await tx.farmer.update({ where: { id: fp.farmerId }, data: { balance: { increment: -sign * fp.amount } } })
  for (const sp of p.supplierPayments || []) await tx.supplier.update({ where: { id: sp.supplierId }, data: { balance: { increment: -sign * sp.amount } } })
}

// Bank transfers on Received / Paid are bank transactions with this category; their reference is the
// party payment's id, or galaWalkInRef(entryId) when the buyer / seller is walk-in (no payment row).
export const GALA_BANK_CATEGORY = "Gala Mandi"
export const galaWalkInRef = (entryId: string) => `gala:${entryId}`

// Delete the bank transactions behind these payments (or walk-in refs) and return them for the archive.
export async function takeGalaBankTxns(tx: any, references: string[]) {
  if (!references.length) return []
  const where = { category: GALA_BANK_CATEGORY, reference: { in: references } }
  const txns = await tx.transaction.findMany({ where })
  if (txns.length) await tx.transaction.deleteMany({ where })
  return txns
}

// A Received / Paid payment was deleted (delta < 0) or restored (delta > 0) from a ledger page:
// keep its Gala Mandi entry's received / paid amount in step. No-op for other payments.
export async function syncGalaPayment(tx: any, galaEntryId: string | null | undefined, field: "receivedAmount" | "paidAmount", delta: number) {
  if (!galaEntryId || !delta) return
  await tx.galaEntry.updateMany({ where: { id: galaEntryId }, data: { [field]: { increment: delta } } })
}

// Ledger line for an entry, e.g. "Gala Mandi #12 — Wheat 1,200 KG · Unreceived PKR 50,000"
export function galaLedgerText(
  g: { id: string; entryNo: string; items: unknown; totalAmount: number; receivedAmount: number; paidAmount: number },
  side: "buyer" | "seller",
) {
  const items = galaItemsText(g.items)
  const done = side === "buyer" ? g.receivedAmount : g.paidAmount
  const left = Math.round(((g.totalAmount || 0) - (done || 0)) * 100) / 100
  const status = left <= 0
    ? (side === "buyer" ? "Fully received" : "Fully paid")
    : `${side === "buyer" ? "Unreceived" : "Unpaid"} PKR ${left.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
  return `Gala Mandi #${g.entryNo} (${recordCode("gala", g.id)})${items ? ` — ${items}` : ""} · ${status}`
}

// Short product list for ledgers, e.g. "Wheat 120 KG, Rice 40 Bag"
export function galaItemsText(items: unknown) {
  const list = Array.isArray(items) ? (items as GalaItem[]) : []
  return list.map((i) => `${i.product} ${(i.qty || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })} ${i.unit}`).join(", ")
}
