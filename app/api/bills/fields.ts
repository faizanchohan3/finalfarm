// Validates a Bill Maker payload and maps it to Bill columns.
export function billFields(body: any) {
  const { billNo, billDate, name, product, data, totalWeight, safiWeight, amount } = body || {}
  if (!name?.trim()) return { error: "Name is required" } as const
  if (!String(billNo ?? "").trim()) return { error: "Bill number is required" } as const
  const date = billDate ? new Date(billDate) : new Date()
  if (isNaN(date.getTime())) return { error: "Invalid bill date" } as const

  return {
    billNo: String(billNo).trim(),
    billDate: date,
    name: name.trim(),
    product: product?.trim() || null,
    data: data ?? {},
    totalWeight: Number(totalWeight) || 0,
    safiWeight: Number(safiWeight) || 0,
    amount: Number(amount) || 0,
  }
}
