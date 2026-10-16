import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { ownsRecord, refsOutsideShop } from "@/lib/shop-scope"
import { createAuditLog } from "@/lib/audit"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!(await ownsRecord("task", id, session))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = await req.json()
  { const bad = await refsOutsideShop(session, body); if (bad) return NextResponse.json({ error: bad }, { status: 400 }) }
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
  if (!(await ownsRecord("task", id, session))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await db.task.delete({ where: { id } })
  await createAuditLog({ userId: session.user.id, action: "DELETE", module: "TASKS", details: `Deleted task ID: ${id}` })

  return NextResponse.json({ success: true })
}
