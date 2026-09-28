import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { restoreDeleted } from "@/lib/recycle-bin"

// POST /api/deleted/:id/restore — put a deleted record back (balances, stock and ledgers included)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const rec = await db.deletedRecord.findUnique({ where: { id } })
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (session.user.shopId && rec.shopId !== session.user.shopId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (rec.restoredAt) return NextResponse.json({ error: "Already restored" }, { status: 400 })

  try {
    await db.$transaction(async (tx) => {
      await restoreDeleted(tx, rec)
      await tx.deletedRecord.update({
        where: { id },
        data: { restoredAt: new Date(), restoredByName: session.user.name ?? null },
      })
    })
  } catch (err: any) {
    console.error("Restore error:", err)
    return NextResponse.json({ error: err?.message || "Failed to restore" }, { status: 400 })
  }

  await createAuditLog({
    userId: session.user.id,
    action: "UPDATE",
    module: "DELETED_RECORDS",
    details: `Restored ${rec.type} ${rec.code} — ${rec.title}`,
  })
  return NextResponse.json({ success: true })
}
