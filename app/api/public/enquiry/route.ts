import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { LEAD_TYPES, normalizePhone, pick, scoreLead } from "@/lib/leads"

// Public (no login) endpoints behind the shareable enquiry form at /enquiry/<shopId>.

export async function GET(req: Request) {
  const shopId = new URL(req.url).searchParams.get("shop") || ""
  const shop = shopId ? await db.shop.findFirst({ where: { id: shopId, isActive: true }, select: { name: true, city: true, phone: true, logo: true } }) : null
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })
  return NextResponse.json({ shop })
}

// Best-effort throttle per IP; serverless instances each keep their own window
const hits = new Map<string, number[]>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) return NextResponse.json({ error: "Too many enquiries. Please try again later." }, { status: 429 })
  hits.set(ip, [...recent, now])

  const body = await req.json().catch(() => ({}))
  // Honeypot: real visitors never see or fill this field
  if (body.website) return NextResponse.json({ success: true })

  const shopId = String(body.shopId || "")
  const shop = shopId ? await db.shop.findFirst({ where: { id: shopId, isActive: true }, select: { id: true } }) : null
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 })

  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "") || null
  const name = clip(body.name, 120)
  const phone = clip(body.phone, 30)
  if (!name || !phone || normalizePhone(phone).length < 10) {
    return NextResponse.json({ error: "Please enter your name and a valid phone number" }, { status: 400 })
  }

  // Same phone already enquired: add the message to that lead instead of creating a duplicate
  const digits = normalizePhone(phone)
  const candidates = await db.lead.findMany({ where: { shopId, phone: { not: null } }, select: { id: true, phone: true } })
  const existing = candidates.find((c) => normalizePhone(c.phone) === digits)
  const message = [clip(body.interest, 200) && `Interested in: ${clip(body.interest, 200)}`, clip(body.quantity, 100) && `Quantity: ${clip(body.quantity, 100)}`, clip(body.message, 1000)]
    .filter(Boolean).join("\n")

  if (existing) {
    await db.leadActivity.create({ data: { leadId: existing.id, kind: "NOTE", notes: `New enquiry from the web form\n${message}`.trim() } })
    return NextResponse.json({ success: true })
  }

  const data = {
    shopId,
    name,
    phone,
    email: clip(body.email, 120),
    city: clip(body.city, 80),
    type: pick(LEAD_TYPES, body.type, "TRADER"),
    source: "ENQUIRY_FORM",
    status: "NEW",
    interest: clip(body.interest, 200),
    quantity: clip(body.quantity, 100),
    notes: clip(body.message, 1000),
    nextFollowUp: new Date(),
  }
  await db.lead.create({ data: { ...data, score: scoreLead(data) } })
  return NextResponse.json({ success: true }, { status: 201 })
}
