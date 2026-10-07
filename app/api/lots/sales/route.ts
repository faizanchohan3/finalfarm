import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { nextRecordCode } from "@/lib/record-number"
import { LOT_SALE_BANK_CATEGORY, LOT_SALE_UNITS, lotSaleAmount, splitByBags } from "@/lib/lot-sale"

const round = (v: number) => Math.round(v * 100) / 100

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const sales = await db.lotSale.findMany({
    where: shopFilter,
    orderBy: [{ saleDate: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: { items: { include: { lot: { select: { lotNo: true, markha1: true, markha2: true, bagType: true, farmer: { select: { name: true } } } } } } },
  })
  // Buyer / product names (no relation on LotSale to keep the model small)
  const [buyers, cats] = await Promise.all([
    db.customer.findMany({ where: { id: { in: [...new Set(sales.map((s) => s.buyerId))] } }, select: { id: true, name: true, phone: true } }),
    db.category.findMany({ where: { id: { in: [...new Set(sales.map((s) => s.categoryId).filter(Boolean) as string[])] } }, select: { id: true, name: true } }),
  ])
  const buyer = new Map(buyers.map((b) => [b.id, b]))
  const cat = new Map(cats.map((c) => [c.id, c.name]))
  return NextResponse.json({
    sales: sales.map((s) => ({ ...s, buyer: buyer.get(s.buyerId) || null, product: s.categoryId ? cat.get(s.categoryId) || null : null })),
  })
}

// Sell bags from the chosen lots of one product to a buyer.
// Body: { buyerId, saleDate, items: [{ lotId, bags }], rateUnit: bag|kg|mound, rate, weight?, commissionRate?, paidAmount?, paymentMethod?, notes? }
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId ?? null
  const shopFilter = shopId ? { shopId } : {}

  const body = await req.json().catch(() => ({}))
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i: any) => ({ lotId: String(i.lotId || ""), bags: Math.floor(Number(i.bags) || 0) }))
    .filter((i: { lotId: string; bags: number }) => i.lotId && i.bags > 0)
  const rateUnit = (LOT_SALE_UNITS as readonly string[]).includes(body.rateUnit) ? body.rateUnit : "bag"
  const rate = Number(body.rate) || 0
  const weight = Number(body.weight) || 0
  // No commission on Potato Store sales: the farmer is owed his full share
  const commRate = 0
  const paymentMethod = ["CASH", "BANK_TRANSFER", "CHEQUE"].includes(body.paymentMethod) ? body.paymentMethod : "CASH"
  const saleDate = body.saleDate ? new Date(body.saleDate) : new Date()

  if (!body.buyerId) return NextResponse.json({ error: "Select the buyer" }, { status: 400 })
  if (items.length === 0) return NextResponse.json({ error: "Enter the bags to sell from at least one lot" }, { status: 400 })
  if (!(rate > 0)) return NextResponse.json({ error: "Enter the rate" }, { status: 400 })
  if (rateUnit !== "bag" && !(weight > 0)) return NextResponse.json({ error: "Enter the weight (KG) for a rate per kg / mound" }, { status: 400 })

  const buyer = await db.customer.findFirst({ where: { id: body.buyerId, ...shopFilter }, select: { id: true, name: true } })
  if (!buyer) return NextResponse.json({ error: "Buyer not found" }, { status: 400 })

  const lots = await db.lot.findMany({ where: { id: { in: items.map((i: any) => i.lotId) }, ...shopFilter }, include: { category: { select: { name: true } } } })
  const lotById = new Map(lots.map((l) => [l.id, l]))
  for (const i of items) {
    const l = lotById.get(i.lotId)
    if (!l) return NextResponse.json({ error: "A chosen lot was not found" }, { status: 400 })
    if (!["ARRIVED", "STORED"].includes(l.status)) return NextResponse.json({ error: `${l.lotNo} is not in stock` }, { status: 400 })
    const left = (l.bags || 0) - (l.soldBags || 0)
    if (i.bags > left) return NextResponse.json({ error: `${l.lotNo} has only ${left} bags left` }, { status: 400 })
  }
  const categoryIds = new Set(lots.map((l) => l.categoryId))
  if (categoryIds.size > 1) return NextResponse.json({ error: "All lots in one sale must be the same product" }, { status: 400 })
  const categoryId = lots[0].categoryId
  const product = lots[0].category?.name || "Potato"

  const totalBags = items.reduce((s: number, i: any) => s + i.bags, 0)
  const amount = lotSaleAmount(rateUnit, rate, totalBags, weight)
  const paid = Math.min(Math.max(Number(body.paidAmount) || 0, 0), amount)
  // Bank transfer: the amount received goes into one of the shop's bank accounts
  let bank: { id: string; name: string } | null = null
  if (paymentMethod === "BANK_TRANSFER" && paid > 0) {
    if (!body.bankId) return NextResponse.json({ error: "Select the bank account" }, { status: 400 })
    bank = await db.bank.findFirst({ where: { id: body.bankId, isActive: true, ...shopFilter }, select: { id: true, name: true } })
    if (!bank) return NextResponse.json({ error: "Bank account not found" }, { status: 400 })
  }
  const itemAmounts = splitByBags(amount, items)

  try {
    const sale = await db.$transaction(async (tx) => {
      const code = await nextRecordCode(tx, shopId)
      const s = await tx.lotSale.create({
        data: {
          shopId, code, categoryId, buyerId: buyer.id, saleDate: isNaN(saleDate.getTime()) ? new Date() : saleDate,
          totalBags, weight: weight || null, rateUnit, rate, amount, commissionRate: commRate, paidAmount: paid, paymentMethod,
          notes: String(body.notes || "").trim() || null, createdById: session.user.id!,
          items: { create: items.map((i: any, idx: number) => ({ lotId: i.lotId, bags: i.bags, amount: itemAmounts[idx] })) },
        },
      })

      // One commission per farmer: their share of the sale (by bags), buyer receivable, farmer payable
      const groups = new Map<string, { farmerId: string | null; bags: number; amount: number; lots: string[] }>()
      items.forEach((i: any, idx: number) => {
        const l = lotById.get(i.lotId)!
        const key = l.farmerId || "none"
        const g = groups.get(key) ?? { farmerId: l.farmerId, bags: 0, amount: 0, lots: [] }
        g.bags += i.bags; g.amount = round(g.amount + itemAmounts[idx]); g.lots.push(`${l.lotNo} (${i.bags})`)
        groups.set(key, g)
      })
      const parts = Array.from(groups.values())
      const paidShares = splitByBags(paid, parts)
      const weightShares = weight ? splitByBags(weight, parts) : parts.map(() => null)
      const commissionAccount = commRate > 0
        ? await tx.account.findFirst({ where: { ...shopFilter, type: "INCOME", name: { contains: "Commission" }, isActive: true }, orderBy: { code: "asc" } })
        : null

      for (let k = 0; k < parts.length; k++) {
        const g = parts[k]
        const share = g.amount
        const paidShare = Math.min(paidShares[k], share)
        const commAmount = round((share * commRate) / 100)
        const sellerPayable = round(share - commAmount)
        const c = await tx.commission.create({
          data: {
            shopId, code: await nextRecordCode(tx, shopId),
            customerId: buyer.id, farmerId: g.farmerId,
            commodity: product, bags: g.bags, weight: weightShares[k],
            rate: rateUnit === "bag" ? 0 : rate, rateUnit: rateUnit === "mound" ? "mound" : "kg",
            totalValue: share, commissionRate: commRate, commissionAmount: commAmount,
            sellerPayable, paidAmount: paidShare, balance: round(share - paidShare),
            status: paidShare >= share ? "PAID" : paidShare > 0 ? "PARTIAL" : "PENDING",
            notes: `Potato Store sale ${code || ""} — ${g.lots.join(", ")}${rateUnit === "bag" ? ` · ${g.bags} bags × Rs ${rate}/bag` : ""}`,
            lotSaleId: s.id, createdById: session.user.id!,
          },
        })
        if (paidShare > 0) {
          await tx.commissionPayment.create({ data: { commissionId: c.id, amount: paidShare, method: paymentMethod, notes: `Paid at sale — ${code || "Potato Store"}${bank ? ` — ${bank.name}` : ""}` } })
        }
        await tx.customer.update({ where: { id: buyer.id }, data: { balance: { increment: round(share - paidShare) } } })
        if (g.farmerId) await tx.farmer.update({ where: { id: g.farmerId }, data: { balance: { increment: sellerPayable } } })
        if (commAmount > 0) {
          await tx.transaction.create({
            data: {
              shopId, type: "CREDIT", amount: commAmount, reference: c.id, category: "Commission Income",
              description: `Commission — ${product} (${code || "Potato Store sale"})`,
              accountId: commissionAccount?.id || null, createdById: session.user.id!,
            },
          })
          if (commissionAccount) await tx.account.update({ where: { id: commissionAccount.id }, data: { balance: { increment: commAmount } } })
        }
      }

      // Take the bags off each lot; an emptied lot is done (sold and settled)
      const now = new Date()
      for (const i of items) {
        const l = lotById.get(i.lotId)!
        const sold = (l.soldBags || 0) + i.bags
        await tx.lot.update({
          where: { id: l.id },
          data: { soldBags: sold, ...(sold >= (l.bags || 0) ? { status: "SETTLED", soldAt: l.soldAt || now, settledAt: now } : {}) },
        })
      }
      // Money received into the bank (reference = the sale, so deleting the sale removes it)
      if (bank) {
        await tx.transaction.create({
          data: {
            shopId, bankId: bank.id, type: "CREDIT", amount: paid, reference: s.id, category: LOT_SALE_BANK_CATEGORY,
            description: `Potato Store sale ${code || ""} — received from ${buyer.name} (${totalBags} bags ${product})`,
            createdById: session.user.id!,
          },
        })
      }
      return s
    })

    await createAuditLog({
      userId: session.user.id, shopId, action: "CREATE", module: "LOTS",
      details: `Potato Store sale ${sale.code || ""} — ${totalBags} bags ${product} to ${buyer.name}, PKR ${amount.toLocaleString()}`,
    })
    return NextResponse.json({ sale }, { status: 201 })
  } catch (err: any) {
    console.error("Lot sale error:", err)
    return NextResponse.json({ error: err?.message || "Failed to save the sale" }, { status: 500 })
  }
}
