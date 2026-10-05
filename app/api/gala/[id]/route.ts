import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { applyGala, applyGalaPayments, galaItemsText } from "@/lib/gala"
import { archiveDeleted, day, pkr } from "@/lib/recycle-bin"
import { recordCode } from "@/lib/record-code"
import { checkParties, galaFields } from "../fields"

async function findOwn(id: string, shopId: string | null | undefined) {
  const entry = await db.galaEntry.findUnique({
    where: { id },
    include: { customer: { select: { name: true } }, farmer: { select: { name: true } }, supplier: { select: { name: true } } },
  })
  if (!entry || (shopId && entry.shopId !== shopId)) return null
  return entry
}

// Edit: take the old amount off the old buyer / seller, then post the new amount to the (possibly new) ones.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const old = await findOwn(id, session.user.shopId)
  if (!old) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const fields = galaFields(await req.json())
  if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 })

  // Money already received / paid sits in that buyer's / seller's ledger, so they can't change,
  // and the total can't go below it
  const buyerChanged = fields.customerId !== old.customerId || (!fields.customerId && fields.walkInBuyer !== old.walkInBuyer)
  const sellerChanged = fields.farmerId !== old.farmerId || fields.supplierId !== old.supplierId || (!fields.farmerId && !fields.supplierId && fields.walkInSeller !== old.walkInSeller)
  if (old.receivedAmount > 0 && buyerChanged) return NextResponse.json({ error: `PKR ${old.receivedAmount.toLocaleString()} is already received from this buyer — the buyer can't be changed` }, { status: 400 })
  if (old.paidAmount > 0 && sellerChanged) return NextResponse.json({ error: `PKR ${old.paidAmount.toLocaleString()} is already paid to this seller — the seller can't be changed` }, { status: 400 })
  const already = Math.max(old.receivedAmount, old.paidAmount)
  if (fields.totalAmount + 0.001 < already) return NextResponse.json({ error: `The total can't be less than PKR ${already.toLocaleString()} already received / paid` }, { status: 400 })

  try {
    const entry = await db.$transaction(async (tx) => {
      const bad = await checkParties(tx, fields, session.user.shopId)
      if (bad) throw new Error(bad)
      await applyGala(tx, old, -1)
      const updated = await tx.galaEntry.update({ where: { id }, data: fields })
      await applyGala(tx, updated, 1)
      return updated
    })
    await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "UPDATE", module: "GALA_MANDI", details: `Edited Gala Mandi #${old.entryNo} — PKR ${old.totalAmount.toLocaleString()} → ${entry.totalAmount.toLocaleString()}` })
    return NextResponse.json({ entry })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update entry" }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const e = await findOwn(id, session.user.shopId)
  if (!e) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const { customer, farmer, supplier, ...row } = e
  const buyer = customer?.name || e.walkInBuyer || "—"
  const seller = farmer?.name || supplier?.name || e.walkInSeller || "—"
  await db.$transaction(async (tx) => {
    // Received / Paid payments made against this entry go with it (and come back on restore)
    const [customerPayments, farmerPayments, supplierPayments] = await Promise.all([
      tx.customerPayment.findMany({ where: { galaEntryId: id } }),
      tx.farmerPayment.findMany({ where: { galaEntryId: id } }),
      tx.supplierPayment.findMany({ where: { galaEntryId: id } }),
    ])
    await archiveDeleted(tx, session, {
      type: "GALA", recordId: id, code: recordCode("gala", id), title: `Gala Mandi #${e.entryNo} — ${buyer}`, amount: e.totalAmount,
      summary: [
        ["Entry No", e.entryNo], ["Date", day(e.entryDate)], ["Buyer", buyer], ["Seller", seller],
        ["Products", galaItemsText(e.items) || "—"], ["Total amount", pkr(e.totalAmount)],
        ["Received from buyer", pkr(e.receivedAmount)], ["Paid to seller", pkr(e.paidAmount)],
      ],
      snapshot: { entry: row, customerPayments, farmerPayments, supplierPayments },
    })
    await applyGalaPayments(tx, { customerPayments, farmerPayments, supplierPayments }, -1)
    await tx.customerPayment.deleteMany({ where: { galaEntryId: id } })
    await tx.farmerPayment.deleteMany({ where: { galaEntryId: id } })
    await tx.supplierPayment.deleteMany({ where: { galaEntryId: id } })
    await applyGala(tx, e, -1)
    await tx.galaEntry.delete({ where: { id } })
  })
  await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "DELETE", module: "GALA_MANDI", details: `Deleted Gala Mandi #${e.entryNo} — PKR ${e.totalAmount.toLocaleString()} (balances reversed)` })
  return NextResponse.json({ success: true })
}
