// Record IDs: SRM-1, SRM-2, SRM-3 … — one running number per shop shared by commissions,
// Bill Maker bills, Gala Mandi entries and store products. The prefix is set per shop in Settings
// (Shop.recordPrefix); the counter is Shop.recordSeq. Each record stores its code, so changing
// the prefix later only affects new records.

export const DEFAULT_RECORD_PREFIX = "REC"

// Clean a prefix typed in Settings: letters / digits only, upper case, up to 8 characters
export function cleanRecordPrefix(v: unknown) {
  return String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
}

// Take the shop's next number. Call inside the transaction that creates the record:
// the counter update locks the shop row, so two saves never get the same number.
export async function nextRecordCode(tx: any, shopId: string | null | undefined): Promise<string | null> {
  if (!shopId) return null
  const shop = await tx.shop.update({
    where: { id: shopId },
    data: { recordSeq: { increment: 1 } },
    select: { recordSeq: true, recordPrefix: true },
  })
  return `${shop.recordPrefix || DEFAULT_RECORD_PREFIX}-${shop.recordSeq}`
}

// Give a code to every record of the shop that has none, oldest first across all four types
// (used once for existing records, and after a shop import).
export async function assignMissingCodes(db: any, shopId: string) {
  const where = { shopId, code: null }
  const pick = { select: { id: true, createdAt: true } }
  const [commissions, bills, gala, products] = await Promise.all([
    db.commission.findMany({ where, ...pick }),
    db.bill.findMany({ where, ...pick }),
    db.galaEntry.findMany({ where, ...pick }),
    db.product.findMany({ where, ...pick }),
  ])
  const rows = [
    ...commissions.map((r: any) => ({ ...r, model: "commission" })),
    ...bills.map((r: any) => ({ ...r, model: "bill" })),
    ...gala.map((r: any) => ({ ...r, model: "galaEntry" })),
    ...products.map((r: any) => ({ ...r, model: "product" })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id))

  for (const r of rows) {
    await db.$transaction(async (tx: any) => {
      const code = await nextRecordCode(tx, shopId)
      await tx[r.model].update({ where: { id: r.id }, data: { code } })
    })
  }
  return rows.length
}
