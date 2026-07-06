import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()

    const slip = await db.freightSlip.update({
      where: { id },
      data: {
        status: body.status,
        dispatchedAt: body.status === "IN_TRANSIT" ? new Date() : undefined,
        deliveredAt: body.status === "DELIVERED" ? new Date() : undefined,
        notes: body.notes ?? undefined,
      },
    })

    // Create delivery challan on dispatch
    if (body.status === "IN_TRANSIT" && body.items) {
      const challanNo = `DC-${Date.now()}`
      await db.deliveryChallan.create({
        data: {
          challanNo,
          slipId: id,
          items: typeof body.items === "string" ? body.items : JSON.stringify(body.items),
          totalWeight: body.totalWeight || null,
          totalBags: body.totalBags || null,
          receivedBy: body.receivedBy || null,
          notes: body.notes || null,
        },
      })
    }

    return NextResponse.json({ slip })
  } catch (err: any) {
    console.error("Freight PUT error:", err)
    return NextResponse.json({ error: err?.message || "Failed to update freight slip" }, { status: 500 })
  }
}
