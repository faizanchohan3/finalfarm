import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { description, amount, category, reference } = await req.json()

  try {
    const transaction = await db.transaction.findUnique({ where: { id } })
    if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    // Update the transaction
    await db.transaction.update({
      where: { id },
      data: {
        description: description || transaction.description,
        amount: amount !== undefined ? amount : transaction.amount,
        category: category !== undefined ? category : transaction.category,
        reference: reference !== undefined ? reference : transaction.reference,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      module: "FINANCE",
      details: `Updated transaction: ${description || transaction.description} - PKR ${amount || transaction.amount}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update transaction error:", error)
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    const transaction = await db.transaction.findUnique({ where: { id } })
    if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    // Delete the transaction
    await db.transaction.delete({ where: { id } })

    await createAuditLog({
      userId: session.user.id,
      action: "DELETE",
      module: "FINANCE",
      details: `Deleted transaction: ${transaction.description} - PKR ${transaction.amount}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete transaction error:", error)
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 })
  }
}
