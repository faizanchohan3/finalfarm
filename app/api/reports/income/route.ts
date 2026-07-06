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

  const [sales, purchases, pesticideSales, transactions] = await Promise.all([
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
      include: { createdBy: { select: { name: true } } },
    }),
  ])

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

  return NextResponse.json({
    salesTotal,
    salesCount: sales._count,
    salesPaid: sales._sum.paidAmount || 0,
    salesBalance: sales._sum.balance || 0,
    pesticideSalesTotal,
    pesticideSalesCount: pesticideSales._count,
    pesticideSalesPaid: pesticideSales._sum.paidAmount || 0,
    pesticideSalesBalance: pesticideSales._sum.balance || 0,
    pesticideDiscountFromSupplier,
    totalRevenue,
    purchasesTotal,
    purchasesCount: purchases._count,
    purchasesPaid: purchases._sum.paidAmount || 0,
    purchasesBalance: purchases._sum.balance || 0,
    grossProfit,
    otherIncome,
    pesticideIncomeTotal: otherIncome + pesticideDiscountFromSupplier,
    otherExpense,
    netIncome,
    transactions,
  })
}

