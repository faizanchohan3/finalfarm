import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

    const slips = await db.freightSlip.findMany({
      where: { ...shopFilter, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { vehicleNo: true, vehicleType: true, driverName: true } },
        customer: { select: { name: true, phone: true } },
        createdBy: { select: { name: true } },
        deliveryChallan: true,
      },
    })

    return NextResponse.json({ slips })
  } catch (err: any) {
    console.error("Freight GET error:", err)
    return NextResponse.json({ error: err?.message || "Failed to load freight slips" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    if (!body.fromLocation || !body.toLocation) {
      return NextResponse.json({ error: "From and To locations are required" }, { status: 400 })
    }
    const slipNo = `FRT-${Date.now()}`

    const rate = parseFloat(body.rate) || 0
    const bags = body.bags ? parseInt(body.bags) : null
    const netWeight = body.netWeight ? parseFloat(body.netWeight) : null
    const netAmount = body.netAmount ? parseFloat(body.netAmount) : (rate * (bags || netWeight || 0))
    const rent = parseFloat(body.rent) || 0
    const deduction = parseFloat(body.deduction) || 0
    const labour = parseFloat(body.labour) || 0

    const slip = await db.$transaction(async (tx) => {
      const s = await tx.freightSlip.create({
        data: {
          slipNo,
          shopId: session.user.shopId || null,
          driverId: body.driverId || null,
          walkInDriver: body.walkInDriver || null,
          vehicleId: body.vehicleId || null,
          walkInVehicle: body.walkInVehicle || null,
          customerId: body.customerId || null,
          fromLocation: body.fromLocation || null,
          toLocation: body.toLocation || null,
          commodity: body.commodity || null,
          builtyNo: body.builtyNo || null,
          rate,
          weighbridge: body.weighbridge ? parseFloat(body.weighbridge) : null,
          loadingDate: body.loadingDate ? new Date(body.loadingDate) : null,
          bags,
          mill: body.mill || null,
          netWeight,
          weight: body.weight ? parseFloat(body.weight) : null,
          freight: parseFloat(body.freight) || 0,
          netAmount,
          rent,
          deduction,
          labour,
          referenceNo: body.referenceNo || null,
          unloadDate: body.unloadDate ? new Date(body.unloadDate) : null,
          notes: body.notes || null,
          createdById: session.user!.id!,
        },
      })

      // Update driver balance if rent > 0
      if (body.driverId && rent > 0) {
        await tx.driver.update({
          where: { id: body.driverId },
          data: { balance: { increment: rent } },
        })
      }

      return s
    })

    return NextResponse.json({ slip })
  } catch (err: any) {
    console.error("Freight POST error:", err)
    return NextResponse.json({ error: err?.message || "Failed to create freight slip" }, { status: 500 })
  }
}

