import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { GALA_BANK_CATEGORY, galaWalkInRef } from "@/lib/gala"

const round = (v: number) => Math.round(v * 100) / 100

// Received / Paid against a Gala Mandi entry.
// RECEIVE: money from the buyer → trader payment (RECEIVE), buyer owes less.
// PAY: money to the seller → farmer / supplier payment (PAY), we owe the seller less.
// Walk-in parties have no ledger, so only the entry's received / paid amount changes.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { kind, amount, method, notes, bankId } = await req.json()
  const amt = round(parseFloat(amount) || 0)
  if (kind !== "RECEIVE" && kind !== "PAY") return NextResponse.json({ error: "Choose Received or Paid" }, { status: 400 })
  if (!(amt > 0)) return NextResponse.json({ error: "Enter an amount greater than 0" }, { status: 400 })

  const e = await db.galaEntry.findUnique({ where: { id } })
  if (!e || (session.user.shopId && e.shopId !== session.user.shopId)) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const done = kind === "RECEIVE" ? e.receivedAmount : e.paidAmount
  const remaining = round(e.totalAmount - done)
  if (amt > remaining + 0.001) {
    return NextResponse.json({ error: `Only PKR ${remaining.toLocaleString()} is still ${kind === "RECEIVE" ? "to receive from the buyer" : "to pay the seller"}` }, { status: 400 })
  }

  const payMethod = ["CASH", "BANK_TRANSFER", "CHEQUE"].includes(method) ? method : "CASH"
  // Bank transfer: the money goes into (Received) or out of (Paid) one of the shop's bank accounts
  let bank: { id: string; name: string } | null = null
  if (payMethod === "BANK_TRANSFER") {
    if (!bankId) return NextResponse.json({ error: "Select the bank account" }, { status: 400 })
    bank = await db.bank.findFirst({ where: { id: bankId, isActive: true, ...(session.user.shopId ? { shopId: session.user.shopId } : {}) }, select: { id: true, name: true } })
    if (!bank) return NextResponse.json({ error: "Bank account not found" }, { status: 400 })
  }

  const note = `Gala Mandi #${e.entryNo}${bank ? ` — ${bank.name}` : ""}${notes?.trim() ? ` — ${notes.trim()}` : ""}`
  const party = await db.galaEntry.findUnique({
    where: { id },
    select: { walkInBuyer: true, walkInSeller: true, customer: { select: { name: true } }, farmer: { select: { name: true } }, supplier: { select: { name: true } } },
  })
  await db.$transaction(async (tx) => {
    let paymentId: string | null = null
    if (kind === "RECEIVE") {
      if (e.customerId) {
        const p = await tx.customerPayment.create({ data: { customerId: e.customerId, amount: amt, direction: "RECEIVE", method: payMethod, notes: note, galaEntryId: id } })
        paymentId = p.id
        await tx.customer.update({ where: { id: e.customerId }, data: { balance: { decrement: amt } } })
      }
      await tx.galaEntry.update({ where: { id }, data: { receivedAmount: { increment: amt } } })
    } else {
      if (e.farmerId) {
        // Farmer payments: positive amount = PAY (mandi pays farmer). No bankId here — the bank side is the transaction below.
        const p = await tx.farmerPayment.create({ data: { farmerId: e.farmerId, amount: amt, method: payMethod, notes: note, galaEntryId: id } })
        paymentId = p.id
        await tx.farmer.update({ where: { id: e.farmerId }, data: { balance: { decrement: amt } } })
      } else if (e.supplierId) {
        const p = await tx.supplierPayment.create({ data: { supplierId: e.supplierId, amount: amt, direction: "PAY", method: payMethod, notes: note, galaEntryId: id } })
        paymentId = p.id
        await tx.supplier.update({ where: { id: e.supplierId }, data: { balance: { decrement: amt } } })
      }
      await tx.galaEntry.update({ where: { id }, data: { paidAmount: { increment: amt } } })
    }

    // Bank account entry: money in for Received, money out for Paid. Linked by reference to the
    // party payment (or to the entry for walk-ins), so deleting either removes it too.
    if (bank) {
      const name = kind === "RECEIVE"
        ? party?.customer?.name || party?.walkInBuyer || "buyer"
        : party?.farmer?.name || party?.supplier?.name || party?.walkInSeller || "seller"
      await tx.transaction.create({
        data: {
          shopId: e.shopId,
          bankId: bank.id,
          type: kind === "RECEIVE" ? "CREDIT" : "DEBIT",
          amount: amt,
          description: `Gala Mandi #${e.entryNo} — ${kind === "RECEIVE" ? "received from" : "paid to"} ${name}${notes?.trim() ? ` (${notes.trim()})` : ""}`,
          reference: paymentId || galaWalkInRef(id),
          category: GALA_BANK_CATEGORY,
          createdById: session.user.id!,
        },
      })
    }
  })

  await createAuditLog({
    userId: session.user.id, shopId: session.user.shopId, action: "CREATE", module: "GALA_MANDI",
    details: `Gala Mandi #${e.entryNo} — ${kind === "RECEIVE" ? "received from buyer" : "paid to seller"} PKR ${amt.toLocaleString()}`,
  })
  return NextResponse.json({ success: true })
}
