import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const agent = await db.commissionAgent.findUnique({
    where: { id },
    include: {
      _count: { select: { commissions: true } },
      commissions: { select: { amount: true, type: true } },
    },
  })

  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (agent.shopId !== session.user.shopId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({ agent })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const agent = await db.commissionAgent.update({
    where: { id },
    data: body,
  })

  return NextResponse.json({ agent })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.commissionAgent.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

