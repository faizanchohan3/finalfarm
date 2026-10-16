import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { ownsRecord, refsOutsideShop } from "@/lib/shop-scope"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    if (!(await ownsRecord("driver", id, session))) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const { amount, method, notes, bankId } = await req.json()
    { const bad = await refsOutsideShop(session, { bankId }); if (bad) return NextResponse.json({ error: bad }, { status: 400 }) }
    if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 })

    await db.$transaction(async (tx) => {
      await tx.driverPayment.create({
        data: {
          driverId: id,
          amount: parseFloat(amount),
          method: method || "CASH",
          notes: notes || null,
          bankId: bankId || null,
        },
      })
      await tx.driver.update({
        where: { id },
        data: { balance: { decrement: parseFloat(amount) } },
      })
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to record payment" }, { status: 500 })
  }
}
