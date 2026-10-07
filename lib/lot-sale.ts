// Potato Store "sell from total": a LotSale takes bags from chosen lots of one product.
// At save, each farmer in the sale gets a commission (like Settle does for a whole lot):
// buyer receivable += share − paid, farmer payable += share − commission, commission income posted.

export const LOT_SALE_UNITS = ["bag", "kg", "mound"] as const
export type LotSaleUnit = (typeof LOT_SALE_UNITS)[number]

// Money received into a bank at sale time: a bank transaction with this category, reference = sale id
export const LOT_SALE_BANK_CATEGORY = "Potato Store Sale"

const round = (v: number) => Math.round(v * 100) / 100

// Sale amount: per bag = bags × rate; per kg = kg × rate; per mound = kg ÷ 40 × rate
export function lotSaleAmount(unit: string, rate: number, bags: number, weight: number) {
  if (unit === "kg") return round(weight * rate)
  if (unit === "mound") return round((weight / 40) * rate)
  return round(bags * rate)
}

// Split a total over parts in proportion to their bags; the last part takes the rounding remainder
export function splitByBags<T extends { bags: number }>(total: number, parts: T[]) {
  const all = parts.reduce((s, p) => s + p.bags, 0)
  let given = 0
  return parts.map((p, i) => {
    const share = i === parts.length - 1 ? round(total - given) : round((total * p.bags) / (all || 1))
    given = round(given + share)
    return share
  })
}

// Undo one commission created by a sale: balances, finance entries, the commission account, payments.
export async function reverseSaleCommission(tx: any, c: any, shopFilter: Record<string, unknown>) {
  if (c.customerId) await tx.customer.update({ where: { id: c.customerId }, data: { balance: { decrement: c.balance } } })
  if (c.farmerId) await tx.farmer.update({ where: { id: c.farmerId }, data: { balance: { decrement: c.sellerPayable } } })
  await tx.transaction.deleteMany({ where: { reference: c.id } })
  if (c.commissionAmount > 0) {
    const acc = await tx.account.findFirst({
      where: { ...shopFilter, type: "INCOME", name: { contains: "Commission" }, isActive: true },
      orderBy: { code: "asc" },
    })
    if (acc) await tx.account.update({ where: { id: acc.id }, data: { balance: Math.max(0, (acc.balance || 0) - c.commissionAmount) } })
  }
  await tx.commissionPayment.deleteMany({ where: { commissionId: c.id } })
  await tx.commission.delete({ where: { id: c.id } })
}
