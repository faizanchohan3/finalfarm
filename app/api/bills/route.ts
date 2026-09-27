import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { applyToTrader, billFields, findTrader } from "./fields"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const bills = await db.bill.findMany({
    where: shopFilter,
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return NextResponse.json({ bills })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const fields = billFields(await req.json())
    if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 })

    const bill = await db.$transaction(async (tx) => {
      const trader = await findTrader(tx, fields.customerId, session.user.shopId)
      if (!trader) throw new Error("TRADER_NOT_FOUND")
      const created = await tx.bill.create({
        data: { ...fields, name: trader.name, shopId: session.user.shopId ?? null, createdById: session.user.id },
      })
      await applyToTrader(tx, trader.id, created.amount)
      return created
    })
    return NextResponse.json({ bill }, { status: 201 })
  } catch (err: any) {
    if (err?.message === "TRADER_NOT_FOUND") return NextResponse.json({ error: "Trader not found" }, { status: 400 })
    console.error("Bill create error:", err)
    return NextResponse.json({ error: err?.message || "Failed to save bill" }, { status: 500 })
  }
}
