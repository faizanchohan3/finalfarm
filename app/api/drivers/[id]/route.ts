import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const [driver, slips, payments] = await Promise.all([
      db.driver.findUnique({ where: { id } }),
      db.freightSlip.findMany({
        where: { driverId: id },
        orderBy: { createdAt: "asc" },
        include: { vehicle: { select: { vehicleNo: true } } },
      }),
      db.driverPayment.findMany({
        where: { driverId: id },
        orderBy: { createdAt: "asc" },
      }),
    ])
    if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 })

    // Build ledger — Cr = driver earns (rent), Dr = we pay driver
    const events: any[] = []
    for (const s of slips) {
      if (s.rent > 0) {
        events.push({
          date: s.unloadDate || s.createdAt,
          type: "SLIP",
          description: `Freight Slip ${s.slipNo}${s.builtyNo ? ` / Builty ${s.builtyNo}` : ""}${s.vehicle ? ` — ${s.vehicle.vehicleNo}` : ""}`,
          debit: 0,
          credit: s.rent,
        })
      }
    }
    for (const p of payments) {
      events.push({
        date: p.createdAt,
        type: "PAYMENT",
        description: `Payment — ${p.method}${p.notes ? ` (${p.notes})` : ""}`,
        debit: p.amount,
        credit: 0,
      })
    }
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // running = Cr - Dr = earnings - payments; positive → we owe driver (Cr balance)
    let running = 0
    const ledger = events.map((e) => {
      running += e.credit - e.debit
      return { ...e, balance: running }
    })

    const totalEarned = events.reduce((s, e) => s + e.credit, 0)
    const totalPaid = events.reduce((s, e) => s + e.debit, 0)

    return NextResponse.json({ driver, ledger, totalEarned, totalPaid, balance: running })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load driver" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id } = await params
    const { name, phone, cnic, address, license, isActive } = await req.json()
    const driver = await db.driver.update({
      where: { id },
      data: {
        name: name?.trim(),
        phone: phone || null,
        cnic: cnic || null,
        address: address || null,
        license: license || null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })
    return NextResponse.json({ driver })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update driver" }, { status: 500 })
  }
}
