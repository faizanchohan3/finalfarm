import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const { amount, method, notes, bankId } = await req.json()
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
