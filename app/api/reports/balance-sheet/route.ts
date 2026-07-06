import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const dateWhere: any = {}
  if (from || to) {
    dateWhere.createdAt = {}
    if (from) dateWhere.createdAt.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      dateWhere.createdAt.lte = toDate
    }
  }

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  // Income statement data
  const [sales, purchases, pesticideSales, transactions, customers, farmers, suppliers, products, stock] = await Promise.all([
    db.sale.aggregate({
      where: { ...dateWhere, ...shopFilter },
      _sum: { totalAmount: true, paidAmount: true, balance: true },
      _count: true,
    }),
    db.purchase.aggregate({
      where: { ...dateWhere, ...shopFilter },
      _sum: { totalAmount: true, paidAmount: true, balance: true },
      _count: true,
    }),
    db.pesticideSale.aggregate({
      where: { ...dateWhere, ...shopFilter },
      _sum: { totalAmount: true, paidAmount: true, balance: true, incentive: true },
      _count: true,
    }),
    db.transaction.findMany({
      where: { ...dateWhere, ...shopFilter },
      orderBy: { createdAt: "desc" },
    }),
    // Assets: Customer Receivables
    db.customer.aggregate({
      where: { ...shopFilter, isActive: true },
      _sum: { balance: true },
    }),
    // Assets: Farmer Receivables
    db.farmer.aggregate({
      where: { ...shopFilter, isActive: true },
      _sum: { balance: true },
    }),
    // Liabilities: Supplier Payables
    db.supplier.aggregate({
      where: { ...shopFilter, isActive: true },
      _sum: { balance: true },
    }),
    // Assets: Product Stock
    db.product.aggregate({
      where: { ...shopFilter, isActive: true },
      _sum: { currentStock: true },
    }),
    // Assets: Stock Value
    db.product.aggregate({
      where: { ...shopFilter, isActive: true },
      _sum: {
        currentStock: true,
      },
    }),
  ])

  // Calculate stock value (currentStock * salePrice)
  const products_with_prices = await db.product.findMany({
    where: { ...shopFilter, isActive: true },
    select: { currentStock: true, salePrice: true },
  })
  const totalStockValue = products_with_prices.reduce((sum, p) => sum + (p.currentStock * p.salePrice), 0)

  // P&L Calculations
  const salesTotal = sales._sum.totalAmount || 0
  const pesticideSalesTotal = pesticideSales._sum.totalAmount || 0
  const pesticideDiscountFromSupplier = pesticideSales._sum.incentive || 0
  const totalRevenue = salesTotal + pesticideSalesTotal

  const purchasesTotal = purchases._sum.totalAmount || 0
  const grossProfit = totalRevenue - purchasesTotal

  const otherIncome = transactions.filter((t) => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0)
  const otherExpense = transactions.filter((t) => t.type === "DEBIT").reduce((s, t) => s + t.amount, 0)
  const totalIncome = otherIncome + pesticideDiscountFromSupplier
  const netIncome = grossProfit + totalIncome - otherExpense

  // Balance Sheet Items
  // For customers: Positive balance (Dr) = they owe us (Receivable), Negative balance (Cr) = we owe them (Liability)
  const customerReceivables = Math.max(0, customers._sum.balance || 0)
  const customerAdvancesReceived = Math.max(0, -(customers._sum.balance || 0)) // Negative balance = advance from customer

  // For farmers: Same logic as customers
  const farmerReceivables = Math.max(0, farmers._sum.balance || 0)
  const farmerAdvancesReceived = Math.max(0, -(farmers._sum.balance || 0))

  const totalReceivables = customerReceivables + farmerReceivables
  const totalAdvancesFromCustomers = customerAdvancesReceived + farmerAdvancesReceived

  // For suppliers: Positive balance = we owe them (Payable)
  const supplierPayables = Math.max(0, suppliers._sum.balance || 0)

  // Assets
  const currentAssets = totalReceivables + totalStockValue
  const totalAssets = currentAssets

  // Liabilities (we owe to others)
  const currentLiabilities = supplierPayables + totalAdvancesFromCustomers
  const totalLiabilities = currentLiabilities

  // Equity
  const equity = totalAssets - totalLiabilities

  return NextResponse.json({
    // P&L
    salesTotal,
    salesCount: sales._count,
    pesticideSalesTotal,
    pesticideSalesCount: pesticideSales._count,
    pesticideDiscountFromSupplier,
    totalRevenue,
    purchasesTotal,
    purchasesCount: purchases._count,
    grossProfit,
    otherIncome,
    otherExpense,
    totalIncome,
    netIncome,

    // Balance Sheet - Assets
    customerReceivables,
    farmerReceivables,
    totalReceivables,
    totalStockValue,
    currentAssets,
    totalAssets,

    // Balance Sheet - Liabilities
    supplierPayables,
    totalAdvancesFromCustomers,
    currentLiabilities,
    totalLiabilities,

    // Balance Sheet - Equity
    equity,

    // Verification
    accountingEquation: totalAssets === (totalLiabilities + equity),
  })
}
