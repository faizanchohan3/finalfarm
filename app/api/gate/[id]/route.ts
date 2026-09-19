import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  if (body.action === "exit") {
    const entry = await db.gateEntry.update({
      where: { id },
      data: { status: "CLOSED", exitTime: new Date() },
    })
    return NextResponse.json({ entry })
  }

  if (body.action === "weigh") {
    const gross = body.grossWeight || 0
    const tare = body.tareWeight || 0
    const net = gross - tare
    const weigh = await db.weighbridgeEntry.create({
      data: {
        entryId: id,
        grossWeight: gross,
        tareWeight: tare,
        netWeight: net,
        unit: body.unit || "KG",
        bags: body.bags || null,
        notes: body.notes || null,
      },
    })
    return NextResponse.json({ weigh })
  }

  if (body.action === "gatepass") {
    const passNo = `GP-${Date.now()}`
    const pass = await db.gatePass.create({
      data: {
        passNo,
        entryId: id,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        purpose: body.purpose || null,
        authorizedBy: session.user?.name || null,
      },
    })
    return NextResponse.json({ pass })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
