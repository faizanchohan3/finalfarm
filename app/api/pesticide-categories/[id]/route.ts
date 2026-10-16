import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { ownsRecord } from "@/lib/shop-scope"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!(await ownsRecord("pesticideCategory", id, session))) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await db.pesticideCategory.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
