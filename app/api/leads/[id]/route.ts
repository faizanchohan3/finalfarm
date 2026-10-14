import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_TYPES, STATUS_LABEL, pick, scoreLead } from "@/lib/leads"

async function findLead(id: string, shopId: string | null) {
  return db.lead.findFirst({ where: { id, ...(shopId ? { shopId } : {}) } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const lead = await db.lead.findFirst({
    where: { id, ...(session.user.shopId ? { shopId: session.user.shopId } : {}) },
    include: {
      assignedTo: { select: { id: true, name: true } },
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
    },
  })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  return NextResponse.json({ lead: { ...lead, score: scoreLead(lead) } })
}

// Partial update: only the fields sent are changed (the board sends just { status } when a card moves)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const existing = await findLead(id, session.user.shopId ?? null)
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  const text = (k: string) => { if (k in body) data[k] = typeof body[k] === "string" ? body[k].trim() || null : null }
  ;["phone", "email", "city", "address", "interest", "quantity", "notes", "referredBy", "lostReason"].forEach(text)
  if ("name" in body) {
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    data.name = name
  }
  if ("type" in body) data.type = pick(LEAD_TYPES, body.type, existing.type as never)
  if ("source" in body) data.source = pick(LEAD_SOURCES, body.source, existing.source as never)
  if ("status" in body) data.status = pick(LEAD_STATUSES, body.status, existing.status as never)
  if ("estimatedValue" in body) data.estimatedValue = Number(body.estimatedValue) || 0
  if ("nextFollowUp" in body) data.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp) : null
  if ("assignedToId" in body) data.assignedToId = body.assignedToId || null

  const merged = { ...existing, ...data }
  const lead = await db.lead.update({ where: { id }, data: { ...data, score: scoreLead(merged as never) } })

  if (data.status && data.status !== existing.status) {
    await db.leadActivity.create({
      data: { leadId: id, userId: session.user.id, kind: "STATUS", notes: `${STATUS_LABEL[existing.status]} → ${STATUS_LABEL[data.status as string]}` },
    })
  }
  await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "UPDATE", module: "LEADS", details: `Updated lead: ${lead.name}` })
  return NextResponse.json({ lead })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const existing = await findLead(id, session.user.shopId ?? null)
  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  await db.lead.delete({ where: { id } })
  await createAuditLog({ userId: session.user.id, shopId: session.user.shopId, action: "DELETE", module: "LEADS", details: `Deleted lead: ${existing.name}` })
  return NextResponse.json({ success: true })
}
