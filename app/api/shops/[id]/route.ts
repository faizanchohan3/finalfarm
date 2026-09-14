import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { cachedJson } from "@/lib/api-cache"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.user.shopId) return NextResponse.json({ shop: null })

  try {
    const shop = await db.shop.findUnique({
      where: { id: session.user.shopId },
      select: {
        id: true, name: true, ownerName: true, phone: true, address: true, logo: true,
        moduleGodown: true, moduleGate: true, moduleTransport: true,
        moduleFarmers: true, moduleCommission: true, modulePesticides: true,
      },
    })
    return cachedJson({ shop }, 30, 120)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load settings" }, { status: 500 })
  }
}

// Super Admin lifecycle actions for a shop: approve / reject / suspend / reactivate.
const ACTIONS: Record<
  string,
  { shop: { status?: "APPROVED" | "REJECTED"; isActive: boolean }; usersActive: boolean }
> = {
  approve:    { shop: { status: "APPROVED", isActive: true },  usersActive: true },
  reactivate: { shop: { status: "APPROVED", isActive: true },  usersActive: true },
  reject:     { shop: { status: "REJECTED", isActive: false }, usersActive: false },
  suspend:    { shop: { isActive: false },                     usersActive: false },
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const config = ACTIONS[body.action]
    if (!config) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const exists = await db.shop.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

    // Update the shop and its users together so login access stays in sync.
    const [shop] = await db.$transaction([
      db.shop.update({ where: { id }, data: config.shop }),
      db.user.updateMany({ where: { shopId: id }, data: { isActive: config.usersActive } }),
    ])

    return NextResponse.json({ shop })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update shop" }, { status: 500 })
  }
}

