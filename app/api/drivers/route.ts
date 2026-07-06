import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
    const drivers = await db.driver.findMany({
      where: { isActive: true, ...shopFilter },
      orderBy: { name: "asc" },
      include: { _count: { select: { freightSlips: true } } },
    })
    return NextResponse.json({ drivers })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load drivers" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, phone, cnic, address, license } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    const driver = await db.driver.create({
      data: {
        shopId: session.user.shopId || null,
        name: name.trim(),
        phone: phone || null,
        cnic: cnic || null,
        address: address || null,
        license: license || null,
      },
    })
    return NextResponse.json({ driver }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create driver" }, { status: 500 })
  }
}
