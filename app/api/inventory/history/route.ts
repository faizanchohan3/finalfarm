import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { recordCode } from "@/lib/record-code"

// Complete stock record for the Store: every add / remove with quantity, rate and amount.
// Sources: opening stock (when a product is added), purchases, sales and manual add/remove adjustments.
// GET /api/inventory/history?productId=&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get("productId") || ""
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const createdAt: any = {}
  if (from) createdAt.gte = new Date(from)
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); createdAt.lte = d }
  const dateWhere = from || to ? { createdAt } : {}

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const productWhere = { ...shopFilter, ...(productId ? { id: productId } : {}) }
  const productSelect = { select: { id: true, name: true, unit: true, purchasePrice: true, currentStock: true } }

  const [openings, purchaseItems, saleItems, adjustments] = await Promise.all([
    db.stockMovement.findMany({
      where: { reference: "Opening Stock", product: productWhere, ...dateWhere },
      include: { product: productSelect },
    }),
    db.purchaseItem.findMany({
      where: { product: productWhere, purchase: { status: { not: "CANCELLED" }, ...dateWhere } },
      include: {
        product: productSelect,
        purchase: { select: { id: true, createdAt: true, supplier: { select: { name: true } }, farmer: { select: { name: true } }, sellerCustomer: { select: { name: true } } } },
      },
    }),
    db.saleItem.findMany({
      where: { product: productWhere, sale: { status: { not: "CANCELLED" }, ...dateWhere } },
      include: {
        product: productSelect,
        sale: { select: { id: true, createdAt: true, customer: { select: { name: true } } } },
      },
    }),
    db.stockAdjustment.findMany({
      where: { product: productWhere, ...dateWhere },
      include: { product: productSelect, createdBy: { select: { name: true } } },
    }),
  ])

  type Entry = {
    id: string; date: Date; type: "OPENING" | "PURCHASE" | "SALE" | "ADD" | "REMOVE"
    productId: string; productName: string; productCode: string; unit: string
    qty: number; rate: number; amount: number; ref: string; party: string; note: string; by: string
  }
  const base = (p: any) => ({ productId: p.id, productName: p.name, productCode: recordCode("product", p.id), unit: p.unit })
  const entries: Entry[] = []

  for (const m of openings) {
    const rate = m.product.purchasePrice || 0
    entries.push({ id: m.id, date: m.createdAt, type: "OPENING", ...base(m.product), qty: m.quantity, rate, amount: m.quantity * rate, ref: "Opening stock", party: "", note: "", by: "" })
  }
  for (const it of purchaseItems) {
    const pu = it.purchase
    entries.push({
      id: it.id, date: pu.createdAt, type: "PURCHASE", ...base(it.product),
      qty: it.quantity, rate: it.price, amount: it.total,
      ref: `Purchase #${pu.id.slice(-6).toUpperCase()}`,
      party: pu.supplier?.name || pu.farmer?.name || pu.sellerCustomer?.name || "", note: "", by: "",
    })
  }
  for (const it of saleItems) {
    const sa = it.sale
    entries.push({
      id: it.id, date: sa.createdAt, type: "SALE", ...base(it.product),
      qty: -it.quantity, rate: it.price, amount: it.total,
      ref: `Sale #${sa.id.slice(-6).toUpperCase()}`, party: sa.customer?.name || "Walk-in", note: "", by: "",
    })
  }
  for (const a of adjustments) {
    const remove = a.type === "DECREASE"
    const rate = a.product.purchasePrice || 0
    entries.push({
      id: a.id, date: a.createdAt, type: remove ? "REMOVE" : "ADD", ...base(a.product),
      qty: remove ? -a.quantity : a.quantity, rate, amount: a.quantity * rate,
      ref: a.adjustNo, party: "", note: a.reason || "", by: a.createdBy?.name || "",
    })
  }

  // Newest first. For a single product (no date filter) also show the stock after each entry,
  // counted back from today's stock so it always ends at the current figure.
  entries.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
  let withBalance: (Entry & { balance?: number })[] = entries
  if (productId && !from && !to) {
    const product = await db.product.findFirst({ where: productWhere, select: { currentStock: true } })
    let running = product?.currentStock ?? 0
    withBalance = entries.map((e) => { const row = { ...e, balance: running }; running -= e.qty; return row })
  }

  const sum = (list: Entry[]) => ({ qty: list.reduce((s, e) => s + Math.abs(e.qty), 0), amount: list.reduce((s, e) => s + e.amount, 0), count: list.length })
  const totals = {
    in: sum(entries.filter((e) => e.qty > 0)),
    out: sum(entries.filter((e) => e.qty < 0)),
    purchases: sum(entries.filter((e) => e.type === "PURCHASE")),
    sales: sum(entries.filter((e) => e.type === "SALE")),
  }

  return NextResponse.json({ entries: withBalance, totals })
}
