import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { LEAD_SOURCES, LEAD_TYPES, normalizePhone, parseCsv, pick, scoreLead } from "@/lib/leads"

// Column headings we understand (lower-cased, spaces/underscores removed) → lead field
const HEADERS: Record<string, string> = {
  name: "name", fullname: "name", contact: "name", contactname: "name",
  phone: "phone", mobile: "phone", phoneno: "phone", phonenumber: "phone", contactno: "phone", whatsapp: "phone",
  email: "email", city: "city", village: "city", town: "city", address: "address",
  type: "type", source: "source", interest: "interest", crop: "interest", product: "interest",
  quantity: "quantity", qty: "quantity", value: "estimatedValue", estimatedvalue: "estimatedValue", amount: "estimatedValue",
  notes: "notes", note: "notes", remarks: "notes", referredby: "referredBy", reference: "referredBy",
}

const MAX_ROWS = 2000

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const shopId = session.user.shopId || null
  const { csv, defaultSource } = await req.json()
  const rows = parseCsv(String(csv || ""))
  if (rows.length < 2) return NextResponse.json({ error: "The file needs a heading row and at least one lead" }, { status: 400 })

  const cols = rows[0].map((h) => HEADERS[h.toLowerCase().replace(/[\s_\-.#]/g, "")] || null)
  if (!cols.includes("name")) return NextResponse.json({ error: "No 'Name' column found in the heading row" }, { status: 400 })
  if (rows.length - 1 > MAX_ROWS) return NextResponse.json({ error: `Import at most ${MAX_ROWS} leads at a time` }, { status: 400 })

  const existing = await db.lead.findMany({ where: { shopId, phone: { not: null } }, select: { phone: true } })
  const seen = new Set(existing.map((l) => normalizePhone(l.phone)).filter(Boolean))

  let skippedNoName = 0
  let skippedDuplicate = 0
  const data = []
  for (const row of rows.slice(1)) {
    const rec: Record<string, string> = {}
    cols.forEach((field, i) => { if (field && row[i]?.trim()) rec[field] = row[i].trim() })
    if (!rec.name) { skippedNoName++; continue }
    const digits = normalizePhone(rec.phone)
    if (digits && seen.has(digits)) { skippedDuplicate++; continue }
    if (digits) seen.add(digits)
    const lead = {
      shopId,
      name: rec.name,
      phone: rec.phone || null,
      email: rec.email || null,
      city: rec.city || null,
      address: rec.address || null,
      type: pick(LEAD_TYPES, rec.type?.toUpperCase(), "TRADER"),
      source: pick(LEAD_SOURCES, rec.source?.toUpperCase().replace(/[\s-]/g, "_"), pick(LEAD_SOURCES, defaultSource, "OTHER")),
      status: "NEW",
      interest: rec.interest || null,
      quantity: rec.quantity || null,
      estimatedValue: Number(String(rec.estimatedValue || "").replace(/[^\d.]/g, "")) || 0,
      notes: rec.notes || null,
      referredBy: rec.referredBy || null,
    }
    data.push({ ...lead, score: scoreLead(lead) })
  }

  if (data.length) await db.lead.createMany({ data })
  await createAuditLog({ userId: session.user.id, shopId, action: "CREATE", module: "LEADS", details: `Imported ${data.length} leads from CSV` })
  return NextResponse.json({ imported: data.length, skippedDuplicate, skippedNoName })
}
