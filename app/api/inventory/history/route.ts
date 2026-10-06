import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { recordCode } from "@/lib/record-code"
import { createAuditLog } from "@/lib/audit"
import { archiveDeleted, day, pkr } from "@/lib/recycle-bin"

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
  const productSelect = { select: { id: true, code: true, name: true, unit: true, purchasePrice: true, currentStock: true } }

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
  const base = (p: any) => ({ productId: p.id, productName: p.name, productCode: recordCode("product", p), unit: p.unit })
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
    // Price entered when adding / removing; older entries fall back to the product's purchase price
    const rate = a.rate ?? a.product.purchasePrice ?? 0
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

// Delete one manual stock entry and reverse its effect on stock. A copy goes to Deleted Records.
// DELETE /api/inventory/history?type=ADD|REMOVE|OPENING&id=
// Purchases and sales are deleted from their own pages (they carry bills, payments and ledgers).
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")
  const id = searchParams.get("id") || ""
  const inShop = (p: { shopId: string | null } | null) => !!p && (!session.user.shopId || p.shopId === session.user.shopId)

  if (type === "ADD" || type === "REMOVE") {
    const a = await db.stockAdjustment.findUnique({ where: { id }, include: { product: true } })
    if (!a || !inShop(a.product)) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    const delta = a.type === "DECREASE" ? -a.quantity : a.quantity
    const rate = a.rate ?? a.product.purchasePrice ?? 0
    const { product, ...row } = a
    await db.$transaction(async (tx) => {
      await archiveDeleted(tx, session, {
        type: "STOCK_ADJUSTMENT", recordId: id, code: a.adjustNo,
        title: `${a.type === "DECREASE" ? "Removed" : "Added"} ${a.quantity} ${product.unit} — ${product.name}`,
        amount: a.quantity * rate,
        summary: [
          ["Product", product.name], ["Type", a.type === "DECREASE" ? "Removed" : "Added"], ["Quantity", `${a.quantity} ${product.unit}`],
          ["Price", pkr(rate)], ["Amount", pkr(a.quantity * rate)], ["Note", a.reason || "—"], ["Date", day(a.createdAt)],
        ],
        snapshot: { adjustment: row },
      })
      await tx.stockAdjustment.delete({ where: { id } })
      await tx.product.update({ where: { id: a.productId }, data: { currentStock: { increment: -delta } } })
      if (a.warehouseId) {
        const ws = await tx.warehouseStock.findFirst({ where: { warehouseId: a.warehouseId, productId: a.productId } })
        if (ws) await tx.warehouseStock.update({ where: { id: ws.id }, data: { quantity: { increment: -delta } } })
      }
    })
    await createAuditLog({ userId: session.user.id, action: "DELETE", module: "INVENTORY", details: `Deleted stock entry ${a.adjustNo} — ${product.name} (${delta > 0 ? "+" : ""}${delta} ${product.unit}, stock reversed)` })
    return NextResponse.json({ success: true })
  }

  if (type === "OPENING") {
    const m = await db.stockMovement.findUnique({ where: { id }, include: { product: true } })
    if (!m || m.reference !== "Opening Stock" || !inShop(m.product)) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    const { product, ...row } = m
    await db.$transaction(async (tx) => {
      await archiveDeleted(tx, session, {
        type: "STOCK_OPENING", recordId: id, code: recordCode("product", product),
        title: `Opening stock ${m.quantity} ${product.unit} — ${product.name}`,
        amount: m.quantity * (product.purchasePrice || 0),
        summary: [["Product", product.name], ["Quantity", `${m.quantity} ${product.unit}`], ["Date", day(m.createdAt)]],
        snapshot: { movement: row },
      })
      await tx.stockMovement.delete({ where: { id } })
      await tx.product.update({ where: { id: m.productId }, data: { currentStock: { decrement: m.quantity } } })
    })
    await createAuditLog({ userId: session.user.id, action: "DELETE", module: "INVENTORY", details: `Deleted opening stock — ${product.name} (−${m.quantity} ${product.unit})` })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Purchases and sales are deleted from the Purchases / Sales pages" }, { status: 400 })
}
