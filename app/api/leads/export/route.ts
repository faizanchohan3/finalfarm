import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { SOURCE_LABEL, STATUS_LABEL, TYPE_LABEL, scoreLead, toCsv } from "@/lib/leads"
import { formatDateDMY } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const leads = await db.lead.findMany({
    where: session.user.shopId ? { shopId: session.user.shopId } : {},
    orderBy: { createdAt: "desc" },
    include: { assignedTo: { select: { name: true } } },
  })
  const csv = toCsv([
    ["Name", "Phone", "Email", "City", "Address", "Type", "Source", "Status", "Score", "Interest", "Quantity", "Estimated Value", "Next Follow-up", "Last Contacted", "Assigned To", "Referred By", "Notes", "Added On"],
    ...leads.map((l) => [
      l.name, l.phone, l.email, l.city, l.address, TYPE_LABEL[l.type] || l.type, SOURCE_LABEL[l.source] || l.source,
      STATUS_LABEL[l.status] || l.status, scoreLead(l), l.interest, l.quantity, l.estimatedValue || "",
      l.nextFollowUp ? formatDateDMY(l.nextFollowUp) : "", l.lastContactedAt ? formatDateDMY(l.lastContactedAt) : "",
      l.assignedTo?.name, l.referredBy, l.notes, formatDateDMY(l.createdAt),
    ]),
  ])
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
