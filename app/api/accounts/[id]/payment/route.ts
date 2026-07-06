import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { amount, description, type } = await req.json()

  if (!amount || parseFloat(amount) <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
  }

  if (!type || (type !== "DEBIT" && type !== "CREDIT")) {
    return NextResponse.json({ error: "Invalid entry type" }, { status: 400 })
  }

  const amt = parseFloat(amount)
  const entryType = type as "DEBIT" | "CREDIT"

  try {
    const account = await db.account.findUnique({ where: { id } })
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 })

    // Record the entry (debit increases balance, credit decreases)
    await db.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          accountId: id,
          type: entryType,
          amount: amt,
          description: description || `${entryType} entry`,
          reference: `Entry on ${new Date().toLocaleDateString()}`,
          createdById: session.user.id,
        },
      })

      // Update account balance based on entry type
      await tx.account.update({
        where: { id },
        data: {
          balance: entryType === "DEBIT" ? { increment: amt } : { decrement: amt },
        },
      })
    })

    await createAuditLog({
      userId: session.user.id,
      action: "CREATE",
      module: "ACCOUNTS",
      details: `${entryType} entry of PKR ${amt} recorded in account: ${account.name}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Entry recording error:", error)
    return NextResponse.json({ error: "Failed to record entry" }, { status: 500 })
  }
}
