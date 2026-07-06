import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const agent = await db.commissionAgent.findUnique({
    where: { id },
    include: {
      commissions: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let running = 0
  const ledger = agent.commissions
    .slice()
    .reverse()
    .map((c) => {
      running += c.type === "CREDIT" ? c.amount : -c.amount
      return { ...c, balance: running }
    })
    .reverse()

  return NextResponse.json({ agent, ledger })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const agent = await db.commissionAgent.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone || null,
      address: body.address || null,
      cnic: body.cnic || null,
      commissionRate: body.commissionRate || 2.5,
    },
  })
  return NextResponse.json({ agent })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Record commission payment
  const commission = await db.agentCommission.create({
    data: {
      agentId: id,
      type: body.type || "CREDIT",
      amount: body.amount,
      rate: body.rate || null,
      saleValue: body.saleValue || null,
      reference: body.reference || null,
      notes: body.notes || null,
      paidAt: body.type === "DEBIT" ? new Date() : null,
    },
  })
  return NextResponse.json({ commission })
}
