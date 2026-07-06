import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { title, description, assignedToId, priority, dueDate, status } = body

  const data: any = { title, description, assignedToId: assignedToId || null, priority, status }
  if (dueDate) data.dueDate = new Date(dueDate)
  if (status === "COMPLETED") data.completedAt = new Date()

  const task = await db.task.update({ where: { id }, data, include: { assignedTo: { select: { name: true } } } })
  await createAuditLog({ userId: session.user.id, action: "UPDATE", module: "TASKS", details: `Updated task: ${title}` })

  return NextResponse.json({ task })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.task.delete({ where: { id } })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "TASKS", details: `Deleted task ID: ${id}` })

  return NextResponse.json({ success: true })
}
