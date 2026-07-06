import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const farmerId = searchParams.get("farmerId")
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const purchases = await db.farmerPurchase.findMany({
    where: {
      farmer: { ...shopFilter, isActive: true },
      ...(farmerId ? { farmerId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      farmer: { select: { id: true, name: true, phone: true, village: true } },
      items: { include: { product: { select: { name: true, unit: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true } },
    },
  })

  return NextResponse.json({ purchases })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { farmerId, commodity, bags, weight, totalAmount, paidAmount, paymentMethod, notes } = body

    if (!farmerId) return NextResponse.json({ error: "Farmer is required" }, { status: 400 })

    const total = parseFloat(totalAmount) || 0
    if (total <= 0) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 })

    const paid = Math.min(parseFloat(paidAmount) || 0, total)
    const balance = total - paid
    const status = balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING"

    const purchase = await db.$transaction(async (tx) => {
      const fp = await tx.farmerPurchase.create({
        data: {
          farmerId,
          totalAmount: total,
          paidAmount: paid,
          balance,
          status,
          commodity: commodity || null,
          weight: weight ? parseFloat(weight) : null,
          bags: bags ? parseInt(bags) : null,
          notes: notes || null,
          createdById: session.user.id,
        },
        include: { farmer: true },
      })

      if (paid > 0) {
        await tx.farmerPayment.create({
          data: {
            farmerId,
            purchaseId: fp.id,
            amount: paid,
            method: paymentMethod || "CASH",
            notes: "Payment at purchase",
          },
        })
      }

      await tx.farmer.update({
        where: { id: farmerId },
        data: { balance: { increment: balance } },
      })

      return fp
    })

    return NextResponse.json({ purchase })
  } catch (err: any) {
    console.error("Farmer purchase POST error:", err)
    return NextResponse.json({ error: err?.message || "Failed to create" }, { status: 500 })
  }
}
