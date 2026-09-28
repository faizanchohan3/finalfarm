// Recycle bin: every delete of a main record keeps a full copy in DeletedRecord,
// so it can be viewed / printed on the Deleted Records page and restored later.
// Restore is the exact reverse of what the delete did (re-create rows with the same ids
// and re-apply the balance / stock / account changes the delete reversed).

export type DeletedType =
  | "BILL" | "COMMISSION" | "PURCHASE" | "LOT" | "PRODUCT"
  | "CUSTOMER" | "CUSTOMER_PERMANENT" | "FARMER" | "SUPPLIER"
  | "CUSTOMER_PAYMENT" | "FARMER_PAYMENT" | "SUPPLIER_PAYMENT"

export const DELETED_TYPE_LABEL: Record<DeletedType, string> = {
  BILL: "Bill", COMMISSION: "Commission", PURCHASE: "Purchase", LOT: "Potato Store lot", PRODUCT: "Store product",
  CUSTOMER: "Trader", CUSTOMER_PERMANENT: "Trader (permanent)", FARMER: "Farmer", SUPPLIER: "Supplier",
  CUSTOMER_PAYMENT: "Trader payment", FARMER_PAYMENT: "Farmer payment", SUPPLIER_PAYMENT: "Supplier payment",
}

type Session = { user: { id?: string | null; name?: string | null; shopId?: string | null } }

export const pkr = (v: number | null | undefined) => `PKR ${Number(v || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
export const day = (v: Date | string | null | undefined) => (v ? new Date(v).toLocaleDateString("en-PK") : "—")

// Save the copy. Call inside the same transaction as the delete, so a delete never happens without its copy.
export async function archiveDeleted(
  tx: any,
  session: Session,
  rec: { type: DeletedType; recordId: string; code: string; title: string; amount?: number; summary: [string, string][]; snapshot: unknown },
) {
  await tx.deletedRecord.create({
    data: {
      shopId: session.user.shopId ?? null,
      type: rec.type,
      recordId: rec.recordId,
      code: rec.code,
      title: rec.title,
      amount: rec.amount || 0,
      summary: rec.summary,
      snapshot: JSON.parse(JSON.stringify(rec.snapshot)), // dates → ISO strings
      deletedById: session.user.id ?? null,
      deletedByName: session.user.name ?? null,
    },
  })
}

// Undo a delete. Throws a readable Error when the record can't be restored.
export async function restoreDeleted(tx: any, rec: { type: string; recordId: string; snapshot: any }) {
  const s = rec.snapshot || {}

  switch (rec.type as DeletedType) {
    case "BILL": {
      const bill = { ...s.bill }
      if (bill.customerId && !(await tx.customer.findUnique({ where: { id: bill.customerId } }))) bill.customerId = null
      await ensureMissing(tx.bill, bill.id)
      await tx.bill.create({ data: bill })
      if (bill.customerId && bill.amount) {
        await tx.customer.update({ where: { id: bill.customerId }, data: { balance: { increment: bill.amount } } })
      }
      return
    }

    case "COMMISSION": {
      const c = { ...s.commission }
      await ensureMissing(tx.commission, c.id)
      await tx.commission.create({ data: c })
      if (s.payments?.length) await tx.commissionPayment.createMany({ data: s.payments })
      if (s.transactions?.length) await tx.transaction.createMany({ data: s.transactions })
      if (c.customerId) await tx.customer.update({ where: { id: c.customerId }, data: { balance: { increment: c.balance } } })
      if (c.farmerId) await tx.farmer.update({ where: { id: c.farmerId }, data: { balance: { increment: c.sellerPayable } } })
      if (c.supplierId) await tx.supplier.update({ where: { id: c.supplierId }, data: { balance: { increment: c.sellerPayable } } })
      for (const a of s.accounts || []) {
        if (a.id && a.delta) await tx.account.update({ where: { id: a.id }, data: { balance: { increment: a.delta } } })
      }
      return
    }

    case "PURCHASE": {
      const p = { ...s.purchase }
      await ensureMissing(tx.purchase, p.id)
      await tx.purchase.create({ data: p })
      if (s.items?.length) await tx.purchaseItem.createMany({ data: s.items })
      if (s.payments?.length) await tx.payment.createMany({ data: s.payments })
      if (s.stockMovements?.length) await tx.stockMovement.createMany({ data: s.stockMovements })
      for (const item of s.items || []) {
        await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } })
      }
      return
    }

    case "LOT":
      await tx.lot.update({ where: { id: rec.recordId }, data: { status: s.lot?.status || "STORED" } })
      return

    case "PRODUCT":
      await tx.product.update({ where: { id: rec.recordId }, data: { isActive: true } })
      return

    case "CUSTOMER":
      await tx.customer.update({ where: { id: rec.recordId }, data: { isActive: true } })
      return

    case "FARMER":
      await tx.farmer.update({ where: { id: rec.recordId }, data: { isActive: true } })
      return

    case "SUPPLIER":
      await tx.supplier.update({ where: { id: rec.recordId }, data: { isActive: true } })
      return

    case "CUSTOMER_PERMANENT": {
      const c = { ...s.customer }
      await ensureMissing(tx.customer, c.id)
      await tx.customer.create({ data: c })
      if (s.payments?.length) await tx.customerPayment.createMany({ data: s.payments })
      const l = s.linked || {}
      if (l.sales?.length) await tx.sale.updateMany({ where: { id: { in: l.sales }, customerId: null }, data: { customerId: c.id } })
      if (l.commissions?.length) await tx.commission.updateMany({ where: { id: { in: l.commissions }, customerId: null }, data: { customerId: c.id } })
      if (l.pesticideSales?.length) await tx.pesticideSale.updateMany({ where: { id: { in: l.pesticideSales }, customerId: null }, data: { customerId: c.id } })
      if (l.purchases?.length) await tx.purchase.updateMany({ where: { id: { in: l.purchases }, sellerCustomerId: null }, data: { sellerCustomerId: c.id } })
      if (l.bills?.length) await tx.bill.updateMany({ where: { id: { in: l.bills }, customerId: null }, data: { customerId: c.id } })
      return
    }

    case "CUSTOMER_PAYMENT": {
      const p = { ...s.payment }
      await ensureExists(tx.customer, p.customerId, "trader")
      await ensureMissing(tx.customerPayment, p.id)
      await tx.customerPayment.create({ data: p })
      // Same effect as recording it: PAY → they owe more, RECEIVE → they owe less
      await tx.customer.update({ where: { id: p.customerId }, data: { balance: p.direction === "PAY" ? { increment: p.amount } : { decrement: p.amount } } })
      return
    }

    case "FARMER_PAYMENT": {
      const p = { ...s.payment }
      await ensureExists(tx.farmer, p.farmerId, "farmer")
      await ensureMissing(tx.farmerPayment, p.id)
      await tx.farmerPayment.create({ data: p })
      // amount < 0 = RECEIVE (balance went up), amount > 0 = PAY (balance went down)
      const amt = Math.abs(p.amount)
      await tx.farmer.update({ where: { id: p.farmerId }, data: { balance: p.amount < 0 ? { increment: amt } : { decrement: amt } } })
      if (s.purchaseBefore) {
        const b = s.purchaseBefore
        await tx.farmerPurchase.update({ where: { id: b.id }, data: { paidAmount: b.paidAmount, balance: b.balance, status: b.status } })
      }
      return
    }

    case "SUPPLIER_PAYMENT": {
      const p = { ...s.payment }
      await ensureExists(tx.supplier, p.supplierId, "supplier")
      await ensureMissing(tx.supplierPayment, p.id)
      await tx.supplierPayment.create({ data: p })
      // PAY → balance down, RECEIVE → balance up
      await tx.supplier.update({ where: { id: p.supplierId }, data: { balance: p.direction === "PAY" ? { decrement: p.amount } : { increment: p.amount } } })
      return
    }

    default:
      throw new Error(`Records of type ${rec.type} can't be restored`)
  }
}

async function ensureMissing(model: any, id: string) {
  if (id && (await model.findUnique({ where: { id } }))) throw new Error("This record already exists — it may have been restored already")
}

async function ensureExists(model: any, id: string, what: string) {
  if (!id || !(await model.findUnique({ where: { id } }))) throw new Error(`The ${what} for this payment no longer exists, so it can't be restored`)
}
