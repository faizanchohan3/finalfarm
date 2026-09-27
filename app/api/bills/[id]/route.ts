import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { applyToTrader, billFields, findTrader } from "../fields"

async function findOwnBill(id: string, shopId: string | null | undefined) {
  const existing = await db.bill.findUnique({ where: { id } })
  if (!existing) return { status: 404, error: "Not found" } as const
  if (shopId && existing.shopId !== shopId) return { status: 403, error: "Forbidden" } as const
  return { bill: existing } as const
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const found = await findOwnBill(id, session.user.shopId)
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status })

  try {
    const fields = billFields(await req.json())
    if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 })

    const bill = await db.$transaction(async (tx) => {
      const trader = await findTrader(tx, fields.customerId, session.user.shopId)
      if (!trader) throw new Error("TRADER_NOT_FOUND")
      // Take the old amount off the old trader, then charge the new amount to the (possibly new) trader.
      await applyToTrader(tx, found.bill.customerId, -found.bill.amount)
      const updated = await tx.bill.update({ where: { id }, data: { ...fields, name: trader.name } })
      await applyToTrader(tx, trader.id, updated.amount)
      return updated
    })
    return NextResponse.json({ bill })
  } catch (err: any) {
    if (err?.message === "TRADER_NOT_FOUND") return NextResponse.json({ error: "Trader not found" }, { status: 400 })
    console.error("Bill update error:", err)
    return NextResponse.json({ error: err?.message || "Failed to update bill" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const found = await findOwnBill(id, session.user.shopId)
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: found.status })

  await db.$transaction(async (tx) => {
    await applyToTrader(tx, found.bill.customerId, -found.bill.amount)
    await tx.bill.delete({ where: { id } })
  })
  return NextResponse.json({ success: true })
}
