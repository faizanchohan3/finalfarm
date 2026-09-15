import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

// Full shop-data export as a portable JSON backup.
// Covers the core commercial data (customers, farmers, suppliers, banks, products,
// sales, purchases, commissions, pesticide sales, payments, transactions, tasks).
// Transport / lot / gate / warehouse modules are intentionally skipped because they
// carry globally-unique numbers that would collide on a merge import.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  if (!shopId) {
    return NextResponse.json({ error: "No shop associated with this account" }, { status: 400 })
  }

  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { name: true } })

  const [
    category, product, customer, supplier, farmer, bank, account,
    commissionAgent, pesticideCategory, pesticide,
    sale, saleItem, purchase, purchaseItem, payment,
    commission, commissionPayment, customerPayment, supplierPayment,
    pesticideSale, transaction, farmerPurchase, farmerPurchaseItem,
    farmerPayment, agentCommission, task, stockMovement,
  ] = await Promise.all([
    db.category.findMany({ where: { shopId } }),
    db.product.findMany({ where: { shopId } }),
    db.customer.findMany({ where: { shopId } }),
    db.supplier.findMany({ where: { shopId } }),
    db.farmer.findMany({ where: { shopId } }),
    db.bank.findMany({ where: { shopId } }),
    db.account.findMany({ where: { shopId } }),
    db.commissionAgent.findMany({ where: { shopId } }),
    db.pesticideCategory.findMany({ where: { shopId } }),
    db.pesticide.findMany({ where: { shopId } }),
    db.sale.findMany({ where: { shopId } }),
    db.saleItem.findMany({ where: { sale: { shopId } } }),
    db.purchase.findMany({ where: { shopId } }),
    db.purchaseItem.findMany({ where: { purchase: { shopId } } }),
    db.payment.findMany({ where: { OR: [{ sale: { shopId } }, { purchase: { shopId } }] } }),
    db.commission.findMany({ where: { shopId } }),
    db.commissionPayment.findMany({ where: { commission: { shopId } } }),
    db.customerPayment.findMany({ where: { customer: { shopId } } }),
    db.supplierPayment.findMany({ where: { supplier: { shopId } } }),
    db.pesticideSale.findMany({ where: { shopId } }),
    db.transaction.findMany({ where: { shopId } }),
    db.farmerPurchase.findMany({ where: { farmer: { shopId } } }),
    db.farmerPurchaseItem.findMany({ where: { purchase: { farmer: { shopId } } } }),
    db.farmerPayment.findMany({ where: { farmer: { shopId } } }),
    db.agentCommission.findMany({ where: { agent: { shopId } } }),
    db.task.findMany({ where: { shopId } }),
    db.stockMovement.findMany({ where: { product: { shopId } } }),
  ])

  const data = {
    category, product, customer, supplier, farmer, bank, account,
    commissionAgent, pesticideCategory, pesticide,
    sale, saleItem, purchase, purchaseItem, payment,
    commission, commissionPayment, customerPayment, supplierPayment,
    pesticideSale, transaction, farmerPurchase, farmerPurchaseItem,
    farmerPayment, agentCommission, task, stockMovement,
  }

  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as any[]).length]))

  const payload = {
    version: 1,
    type: "gala-mandi-shop-backup",
    exportedAt: new Date().toISOString(),
    shopName: shop?.name || "Shop",
    counts,
    data,
  }

  const filename = `shop-backup-${(shop?.name || "shop").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
