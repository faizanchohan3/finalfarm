import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const date = searchParams.get("date")

  let dateWhere: any = {}
  if (date) {
    const d = new Date(date)
    dateWhere = {
      entryTime: {
        gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
      },
    }
  }

  const entries = await db.gateEntry.findMany({
    where: { ...(status ? { status } : {}), ...dateWhere },
    orderBy: { entryTime: "desc" },
    include: {
      vehicle: { select: { vehicleNo: true, vehicleType: true } },
      farmer: { select: { name: true, village: true } },
      agent: { select: { name: true } },
      createdBy: { select: { name: true } },
      weighbridgeEntries: true,
      gatePass: true,
    },
  })

  return NextResponse.json({ entries })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const entryNo = `GT-${Date.now()}`

  const entry = await db.gateEntry.create({
    data: {
      entryNo,
      type: body.type || "IN",
      vehicleId: body.vehicleId || null,
      vehicleNo: body.vehicleNo || null,
      driverName: body.driverName || null,
      farmerId: body.farmerId || null,
      agentId: body.agentId || null,
      commodity: body.commodity || null,
      bags: body.bags || null,
      purpose: body.purpose || null,
      notes: body.notes || null,
      createdById: session.user!.id!,
    },
  })

  return NextResponse.json({ entry })
}
