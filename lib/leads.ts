// Shared constants and helpers for the Leads (lead generation) module — used by both API routes and pages.

export const LEAD_STATUSES = ["NEW", "CONTACTED", "INTERESTED", "NEGOTIATION", "WON", "LOST"] as const
export const LEAD_SOURCES = ["WALK_IN", "PHONE", "WHATSAPP", "FACEBOOK", "REFERRAL", "ENQUIRY_FORM", "MANDI", "RE_ENGAGE", "OTHER"] as const
export const LEAD_TYPES = ["TRADER", "FARMER", "SUPPLIER"] as const
export const ACTIVITY_KINDS = ["NOTE", "CALL", "WHATSAPP", "SMS", "VISIT"] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const STATUS_LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", INTERESTED: "Interested",
  NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
}

export const SOURCE_LABEL: Record<string, string> = {
  WALK_IN: "Walk-in", PHONE: "Phone call", WHATSAPP: "WhatsApp", FACEBOOK: "Facebook",
  REFERRAL: "Referral", ENQUIRY_FORM: "Enquiry form", MANDI: "Mandi", RE_ENGAGE: "Re-engagement", OTHER: "Other",
}

export const TYPE_LABEL: Record<string, string> = { TRADER: "Trader", FARMER: "Farmer", SUPPLIER: "Supplier" }

export const STATUS_COLOR: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-indigo-100 text-indigo-800",
  INTERESTED: "bg-amber-100 text-amber-800",
  NEGOTIATION: "bg-purple-100 text-purple-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-gray-200 text-gray-700",
}

export const OPEN_STATUSES: string[] = ["NEW", "CONTACTED", "INTERESTED", "NEGOTIATION"]

export const pick = <T extends readonly string[]>(list: T, value: unknown, fallback: T[number]): T[number] =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? value : fallback

// Digits only; Pakistani numbers written 03xx… become 923xx… so WhatsApp links work.
export function normalizePhone(phone?: string | null): string {
  let d = (phone || "").replace(/\D/g, "")
  if (d.startsWith("00")) d = d.slice(2)
  if (d.startsWith("0") && d.length === 11) d = "92" + d.slice(1)
  if (d.length === 10 && d.startsWith("3")) d = "92" + d
  return d
}

export function whatsappLink(phone: string | null | undefined, message: string) {
  const p = normalizePhone(phone)
  return `https://wa.me/${p}${message ? `?text=${encodeURIComponent(message)}` : ""}`
}

// 0–100 hotness score: how complete the lead is, how far along the pipeline, and how recently we spoke.
export function scoreLead(lead: {
  phone?: string | null; email?: string | null; city?: string | null; interest?: string | null
  quantity?: string | null; estimatedValue?: number | null; status?: string | null; source?: string | null
  lastContactedAt?: Date | string | null; nextFollowUp?: Date | string | null
}): number {
  if (lead.status === "WON") return 100
  if (lead.status === "LOST") return 0
  let s = 0
  if (lead.phone) s += 15
  if (lead.email) s += 5
  if (lead.city) s += 5
  if (lead.interest) s += 10
  if (lead.quantity) s += 10
  const v = lead.estimatedValue || 0
  if (v >= 1_000_000) s += 15
  else if (v >= 250_000) s += 10
  else if (v > 0) s += 5
  s += ({ NEW: 0, CONTACTED: 10, INTERESTED: 20, NEGOTIATION: 30 } as Record<string, number>)[lead.status || "NEW"] ?? 0
  if (lead.source === "REFERRAL" || lead.source === "ENQUIRY_FORM") s += 5
  if (lead.lastContactedAt) {
    const days = (Date.now() - new Date(lead.lastContactedAt).getTime()) / 86_400_000
    if (days <= 7) s += 5
    else if (days > 30) s -= 10
  }
  if (lead.nextFollowUp) s += 5
  return Math.max(0, Math.min(99, s))
}

export function scoreBand(score: number) {
  if (score >= 70) return { label: "Hot", color: "bg-red-100 text-red-700" }
  if (score >= 40) return { label: "Warm", color: "bg-orange-100 text-orange-700" }
  return { label: "Cold", color: "bg-sky-100 text-sky-700" }
}

// Minimal CSV parser (quoted fields, commas and newlines inside quotes).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(field); field = ""
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)
  return rows
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) => r.map((v) => {
      const s = v == null ? "" : String(v)
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(","))
    .join("\r\n")
}

// Ready-made outreach messages; {name}, {shop} and {interest} are filled in per lead.
export const MESSAGE_TEMPLATES = [
  { key: "intro", label: "Introduction", text: "Assalam-o-Alaikum {name}, this is {shop}. Thank you for your interest. We deal in {interest} at the best mandi rates. When is a good time to talk?" },
  { key: "followup", label: "Follow-up", text: "Assalam-o-Alaikum {name}, {shop} here. Just following up on your enquiry about {interest}. Are you still interested? We can share today's rates." },
  { key: "rates", label: "Today's rates", text: "Assalam-o-Alaikum {name}, today's rates for {interest} at {shop} are now available. Reply to this message or call us for details." },
  { key: "visit", label: "Invite to visit", text: "Assalam-o-Alaikum {name}, you are welcome to visit {shop} at the mandi to see the stock of {interest} in person. Let us know when you are coming." },
  { key: "thanks", label: "Thank you", text: "Thank you {name} for doing business with {shop}. We look forward to working with you again." },
]

export function fillTemplate(text: string, vars: { name?: string | null; shop?: string | null; interest?: string | null }) {
  return text
    .replace(/\{name\}/g, vars.name || "")
    .replace(/\{shop\}/g, vars.shop || "our shop")
    .replace(/\{interest\}/g, vars.interest || "grain and produce")
}
