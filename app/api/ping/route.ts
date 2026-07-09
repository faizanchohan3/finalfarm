mport { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Lightweight endpoint to warm up the Neon DB connection before the user clicks anything
export async function GET() {
  await db.$queryRaw`SELECT 1`
  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store" },
  })
}

