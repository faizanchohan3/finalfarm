import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { ACTIVITY_KINDS, LEAD_STATUSES, STATUS_LABEL, pick, scoreLead } from "@/lib/leads"

// Log a call / WhatsApp / visit / note against a lead, optionally moving it on and setting the next follow-up
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const lead = await db.lead.findFirst({ where: { id, ...(session.user.shopId ? { shopId: session.user.shopId } : {}) } })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const body = await req.json()
  const kind = pick(ACTIVITY_KINDS, body.kind, "NOTE")
  const notes = typeof body.notes === "string" ? body.notes.trim() : ""
  const status = body.status ? pick(LEAD_STATUSES, body.status, lead.status as never) : lead.status

  const data: Record<string, unknown> = {}
  if (kind !== "NOTE") data.lastContactedAt = new Date()
  if ("nextFollowUp" in body) data.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp) : null
  // First real contact moves a NEW lead to CONTACTED automatically
  data.status = kind !== "NOTE" && status === "NEW" ? "CONTACTED" : status

  const merged = { ...lead, ...data }
  const [activity] = await db.$transaction([
    db.leadActivity.create({ data: { leadId: id, userId: session.user.id, kind, notes: notes || null } }),
    db.lead.update({ where: { id }, data: { ...data, score: scoreLead(merged as never) } }),
    ...(data.status !== lead.status
      ? [db.leadActivity.create({ data: { leadId: id, userId: session.user.id, kind: "STATUS", notes: `${STATUS_LABEL[lead.status]} → ${STATUS_LABEL[data.status as string]}` } })]
      : []),
  ])
  return NextResponse.json({ activity }, { status: 201 })
}
