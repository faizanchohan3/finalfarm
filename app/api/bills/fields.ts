// Validates a Bill Maker payload and maps it to Bill columns.
export function billFields(body: any) {
  const { billNo, billDate, name, product, customerId, data, totalWeight, safiWeight, amount } = body || {}
  if (!customerId) return { error: "Select a trader" } as const
  if (!String(billNo ?? "").trim()) return { error: "Bill number is required" } as const
  const date = billDate ? new Date(billDate) : new Date()
  if (isNaN(date.getTime())) return { error: "Invalid bill date" } as const

  return {
    billNo: String(billNo).trim(),
    billDate: date,
    name: String(name || "").trim(),
    product: product?.trim() || null,
    customerId: String(customerId),
    data: data ?? {},
    totalWeight: Number(totalWeight) || 0,
    safiWeight: Number(safiWeight) || 0,
    amount: Math.max(Number(amount) || 0, 0),
  }
}

// Bills are charged to the trader: the amount is added to what the trader owes (customer balance).
export async function applyToTrader(tx: any, customerId: string | null | undefined, amount: number) {
  if (!customerId || !amount) return
  await tx.customer.update({ where: { id: customerId }, data: { balance: { increment: amount } } })
}

// The trader must belong to the user's shop; the stored name follows the trader's name.
export async function findTrader(tx: any, customerId: string, shopId: string | null | undefined) {
  const customer = await tx.customer.findUnique({ where: { id: customerId } })
  if (!customer || (shopId && customer.shopId !== shopId)) return null
  return customer
}
