import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { nextRecordCode } from "@/lib/record-number"
import { createAuditLog } from "@/lib/audit"
import { applyGala } from "@/lib/gala"
import { checkParties, galaFields } from "./fields"

const partySelect = {
  customer: { select: { id: true, name: true, phone: true } },
  farmer: { select: { id: true, name: true, phone: true } },
  supplier: { select: { id: true, name: true, phone: true } },
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const entries = await db.galaEntry.findMany({
    where: shopFilter,
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: partySelect,
  })
  return NextResponse.json({ entries })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const fields = galaFields(await req.json())
  if ("error" in fields) return NextResponse.json({ error: fields.error }, { status: 400 })

  const shopId = session.user.shopId ?? null
  try {
    const entry = await db.$transaction(async (tx) => {
      const bad = await checkParties(tx, fields, shopId)
      if (bad) throw new Error(bad)
      // Next number in this shop: 1, 2, 3 …
      const last = await tx.galaEntry.findFirst({ where: { shopId }, orderBy: { createdAt: "desc" }, select: { entryNo: true } })
      const entryNo = String((parseInt(last?.entryNo || "0") || 0) + 1)
      const created = await tx.galaEntry.create({
        data: { ...fields, entryNo, shopId, code: await nextRecordCode(tx, shopId), createdById: session.user.id },
        include: partySelect,
      })
      await applyGala(tx, created, 1)
      return created
    })
    await createAuditLog({ userId: session.user.id, shopId, action: "CREATE", module: "GALA_MANDI", details: `Gala Mandi #${entry.entryNo} — PKR ${entry.totalAmount.toLocaleString()}` })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save entry" }, { status: 400 })
  }
}
