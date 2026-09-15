import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

const lotInclude = {
  farmer: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  buyer: { select: { id: true, name: true } },
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}

  const lots = await db.lot.findMany({
    where: { ...shopFilter, ...(status && status !== "ALL" ? { status: status as any } : {}) },
    orderBy: { createdAt: "desc" },
    include: lotInclude,
  })

  return NextResponse.json({ lots })
}

// Generate LOT-YYYY-##### unique per shop per year, retrying on collision.
async function nextLotNo(shopId: string | null): Promise<string> {
  const year = new Date().getFullYear()
  const start = new Date(year, 0, 1)
  const base = await db.lot.count({
    where: { createdAt: { gte: start }, ...(shopId ? { shopId } : {}) },
  })
  for (let i = 1; i <= 20; i++) {
    const candidate = `LOT-${year}-${String(base + i).padStart(5, "0")}`
    const clash = await db.lot.findUnique({ where: { lotNo: candidate } })
    if (!clash) return candidate
  }
  return `LOT-${year}-${Date.now().toString().slice(-6)}`
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  if (!body.categoryId) {
    return NextResponse.json({ error: "Category is required." }, { status: 400 })
  }

  const gross = body.grossWeight !== "" && body.grossWeight != null ? parseFloat(body.grossWeight) : null
  const tare = body.tareWeight !== "" && body.tareWeight != null ? parseFloat(body.tareWeight) : null
  let net = body.netWeight !== "" && body.netWeight != null ? parseFloat(body.netWeight) : null
  if (net == null && gross != null) net = gross - (tare || 0)

  const toInt = (v: any) => (v !== "" && v != null ? parseInt(v) : null)
  const bori = toInt(body.bori)
  const jali = toInt(body.jali)
  const tora = toInt(body.tora)
  // Keep the total `bags` in sync so existing displays/reports still work.
  const bagsTotal = bori != null || jali != null || tora != null
    ? (bori || 0) + (jali || 0) + (tora || 0)
    : toInt(body.bags)

  const lotNo = await nextLotNo(session.user.shopId || null)

  const lot = await db.lot.create({
    data: {
      shopId: session.user.shopId || null,
      lotNo,
      farmerId: body.farmerId || null,
      categoryId: body.categoryId,
      warehouseId: body.warehouseId || null,
      bags: bagsTotal,
      bori,
      jali,
      tora,
      markha1: body.markha1?.trim() || null,
      markha2: body.markha2?.trim() || null,
      billNo: body.billNo?.trim() || null,
      vehicleNo: body.vehicleNo?.trim() || null,
      grossWeight: gross,
      tareWeight: tare,
      netWeight: net,
      grade: body.grade?.trim() || null,
      status: body.status || "ARRIVED",
      notes: body.notes?.trim() || null,
      createdById: session.user!.id!,
    },
    include: lotInclude,
  })

  return NextResponse.json({ lot })
}
