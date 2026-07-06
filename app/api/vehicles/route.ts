import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
    const vehicles = await db.vehicle.findMany({
      where: { isActive: true, ...shopFilter },
      orderBy: { vehicleNo: "asc" },
      include: { _count: { select: { freightSlips: true } } },
    })
    return NextResponse.json({ vehicles })
  } catch (err: any) {
    console.error("Vehicles GET error:", err)
    return NextResponse.json({ error: err?.message || "Failed to load vehicles" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.vehicleNo?.trim()) return NextResponse.json({ error: "Vehicle number is required" }, { status: 400 })
    const vehicle = await db.vehicle.create({
      data: {
        shopId: session.user.shopId || null,
        vehicleNo: body.vehicleNo.trim().toUpperCase(),
        vehicleType: body.vehicleType || "Truck",
        driverName: body.driverName || null,
        driverPhone: body.driverPhone || null,
      },
    })
    return NextResponse.json({ vehicle })
  } catch (err: any) {
    console.error("Vehicles POST error:", err)
    if (err?.code === "P2002") return NextResponse.json({ error: "Vehicle number already exists" }, { status: 409 })
    return NextResponse.json({ error: err?.message || "Failed to add vehicle" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const vehicle = await db.vehicle.update({
    where: { id: body.id },
    data: {
      vehicleType: body.vehicleType,
      driverName: body.driverName || null,
      driverPhone: body.driverPhone || null,
    },
  })
  return NextResponse.json({ vehicle })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  await db.vehicle.update({ where: { id: body.id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}
