import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const shop = await db.shop.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } },
      _count: { select: { sales: true, customers: true, products: true } },
    },
  })

  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ shop })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { action } = await req.json() // "approve" | "reject" | "suspend" | "reactivate"

  let shopData: any = {}
  let userUpdate: any = {}
  let logDetails = ""

  if (action === "approve") {
    shopData = { status: "APPROVED", isActive: true }
    userUpdate = { isActive: true }
    logDetails = `Approved shop ID: ${id}`
  } else if (action === "reject") {
    shopData = { status: "REJECTED", isActive: false }
    userUpdate = { isActive: false }
    logDetails = `Rejected shop ID: ${id}`
  } else if (action === "suspend") {
    shopData = { isActive: false }
    userUpdate = { isActive: false }
    logDetails = `Suspended shop ID: ${id}`
  } else if (action === "reactivate") {
    shopData = { status: "APPROVED", isActive: true }
    userUpdate = { isActive: true }
    logDetails = `Reactivated shop ID: ${id}`
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const shop = await db.$transaction(async (tx) => {
    const updated = await tx.shop.update({ where: { id }, data: shopData })
    // Update all users of this shop
    await tx.user.updateMany({ where: { shopId: id }, data: userUpdate })
    return updated
  })

  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "SHOPS", details: logDetails })

  return NextResponse.json({ shop })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  // Soft delete by suspending
  await db.shop.update({ where: { id }, data: { isActive: false, status: "REJECTED" } })
  await db.user.updateMany({ where: { shopId: id }, data: { isActive: false } })

  return NextResponse.json({ success: true })
}
