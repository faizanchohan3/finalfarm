import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { ownsRecord } from "@/lib/shop-scope"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!(await ownsRecord("bank", id, session))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { name, accountNumber } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Bank name is required" }, { status: 400 })

  const bank = await db.bank.update({
    where: { id },
    data: { name: name.trim(), accountNumber: accountNumber?.trim() || null },
  })
  return NextResponse.json({ bank })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!(await ownsRecord("bank", id, session))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await db.bank.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
