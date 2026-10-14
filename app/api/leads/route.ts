import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_TYPES, OPEN_STATUSES, normalizePhone, pick, scoreLead } from "@/lib/leads"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopFilter = session.user.shopId ? { shopId: session.user.shopId } : {}
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const q = searchParams.get("q")?.trim()

  const leads = await db.lead.findMany({
    where: {
      ...shopFilter,
      ...(status ? { status: { in: status.split(",") } } : {}),
      ...(q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { city: { contains: q, mode: "insensitive" } },
        { interest: { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { activities: true } },
    },
  })

  // Scores drift as contact dates age, so they are recomputed on read
  const withScore = leads.map((l) => ({ ...l, score: scoreLead(l) }))

  const now = new Date()
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999)
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000)
  const open = withScore.filter((l) => OPEN_STATUSES.includes(l.status))
  const won = withScore.filter((l) => l.status === "WON")
  const closed = withScore.filter((l) => l.status === "WON" || l.status === "LOST")
  const stats = {
    total: withScore.length,
    open: open.length,
    newThisMonth: withScore.filter((l) => l.createdAt >= monthAgo).length,
    followUpsDue: open.filter((l) => l.nextFollowUp && l.nextFollowUp <= endOfToday).length,
    won: won.length,
    conversionRate: closed.length ? Math.round((won.length / closed.length) * 100) : 0,
    pipelineValue: open.reduce((s, l) => s + (l.estimatedValue || 0), 0),
    wonValue: won.reduce((s, l) => s + (l.estimatedValue || 0), 0),
    hot: open.filter((l) => l.score >= 70).length,
    bySource: Object.fromEntries(LEAD_SOURCES.map((s) => [s, withScore.filter((l) => l.source === s).length])),
    byStatus: Object.fromEntries(LEAD_STATUSES.map((s) => [s, withScore.filter((l) => l.status === s).length])),
  }

  return NextResponse.json({ leads: withScore, stats })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId || null
  const body = await req.json()
  const name = String(body.name || "").trim()
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  // Warn about an existing lead with the same phone unless the user insists
  const phoneDigits = normalizePhone(body.phone)
  if (phoneDigits && !body.force) {
    const candidates = await db.lead.findMany({
      where: { shopId, phone: { not: null } },
      select: { id: true, name: true, phone: true, status: true },
    })
    const dup = candidates.find((c) => normalizePhone(c.phone) === phoneDigits)
    if (dup) return NextResponse.json({ error: "duplicate", duplicate: dup }, { status: 409 })
  }

  const data = {
    shopId,
    name,
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
    city: body.city?.trim() || null,
    address: body.address?.trim() || null,
    type: pick(LEAD_TYPES, body.type, "TRADER"),
    source: pick(LEAD_SOURCES, body.source, "WALK_IN"),
    status: pick(LEAD_STATUSES, body.status, "NEW"),
    interest: body.interest?.trim() || null,
    quantity: body.quantity?.trim() || null,
    estimatedValue: Number(body.estimatedValue) || 0,
    notes: body.notes?.trim() || null,
    referredBy: body.referredBy?.trim() || null,
    nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
    assignedToId: body.assignedToId || null,
  }
  const lead = await db.lead.create({ data: { ...data, score: scoreLead(data) } })

  await createAuditLog({ userId: session.user.id, shopId, action: "CREATE", module: "LEADS", details: `Added lead: ${name}` })
  return NextResponse.json({ lead }, { status: 201 })
}
