import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

// Turn a won lead into a real Trader, Farmer or Supplier so it shows up in the ledgers
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const shopId = session.user.shopId || null
  const lead = await db.lead.findFirst({ where: { id, ...(shopId ? { shopId } : {}) } })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  if (lead.convertedId) return NextResponse.json({ error: "This lead has already been converted" }, { status: 400 })

  const { as } = await req.json()
  const address = [lead.address, lead.city].filter(Boolean).join(", ") || null

  const result = await db.$transaction(async (tx) => {
    let convertedType: string
    let convertedId: string
    if (as === "FARMER") {
      const f = await tx.farmer.create({ data: { shopId, name: lead.name, phone: lead.phone, address: lead.address, village: lead.city } })
      convertedType = "FARMER"; convertedId = f.id
    } else if (as === "SUPPLIER") {
      const s = await tx.supplier.create({ data: { shopId, name: lead.name, phone: lead.phone, address } })
      convertedType = "SUPPLIER"; convertedId = s.id
    } else {
      const c = await tx.customer.create({ data: { shopId, name: lead.name, phone: lead.phone, address, referenceName: lead.referredBy } })
      convertedType = "CUSTOMER"; convertedId = c.id
    }
    const updated = await tx.lead.update({
      where: { id },
      data: { status: "WON", score: 100, convertedType, convertedId, convertedAt: new Date(), nextFollowUp: null },
    })
    await tx.leadActivity.create({
      data: { leadId: id, userId: session.user.id, kind: "STATUS", notes: `Converted to ${convertedType === "CUSTOMER" ? "Trader" : convertedType === "FARMER" ? "Farmer" : "Supplier"}` },
    })
    return updated
  })

  await createAuditLog({ userId: session.user.id, shopId, action: "CREATE", module: "LEADS", details: `Converted lead ${lead.name} to ${result.convertedType}` })
  return NextResponse.json({ lead: result })
}
