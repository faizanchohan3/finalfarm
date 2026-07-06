import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get("limit") || "50")
  const statusFilter = searchParams.get("status")?.split(",")
  const myTasks = searchParams.get("mine") === "true"

  const tasks = await db.task.findMany({
    take: limit,
    where: {
      ...(statusFilter ? { status: { in: statusFilter as any[] } } : {}),
      ...(myTasks ? { assignedToId: session.user.id } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ tasks })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { title, description, assignedToId, priority, dueDate } = body

  const task = await db.task.create({
    data: {
      title,
      description,
      assignedToId: assignedToId || null,
      priority: priority || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
      createdById: session.user.id,
    },
    include: {
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  })

  await createAuditLog({ userId: session.user.id, action: "CREATE", module: "TASKS", details: `Created task: ${title}` })

  return NextResponse.json({ task }, { status: 201 })
}
