import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { billFields } from "./fields"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const bills = await db.bill.findMany({
    where: shopFilter,
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return NextResponse.json({ bills })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const fields = billFields(await req.json())
    if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 })

    const bill = await db.bill.create({
      data: { ...fields, shopId: session.user.shopId ?? null, createdById: session.user.id },
    })
    return NextResponse.json({ bill }, { status: 201 })
  } catch (err: any) {
    console.error("Bill create error:", err)
    return NextResponse.json({ error: err?.message || "Failed to save bill" }, { status: 500 })
  }
}
