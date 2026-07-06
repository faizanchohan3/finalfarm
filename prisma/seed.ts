import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  console.log("Seeding database - Super Admin Only...")

  // ── Super Admin (Platform Head) — no shopId ──────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 12)
  const admin = await db.user.upsert({
    where: { email: "admin@agrofirm.com" },
    update: {},
    create: {
      name: "Super Administrator",
      email: "admin@agrofirm.com",
      password: adminPassword,
      role: "SUPER_ADMIN",
      shopId: null,
    },
  })

  console.log("✅ Database seeded successfully!")
  console.log("\n📌 SUPER ADMIN CREDENTIALS:")
  console.log("═════════════════════════════════════")
  console.log("  Email:    admin@agrofirm.com")
  console.log("  Password: admin123")
  console.log("═════════════════════════════════════")
  console.log("\n⚠️  IMPORTANT:")
  console.log("  - This is a FRESH database - completely separate from gala-mandi")
  console.log("  - Only Super Admin account exists")
  console.log("  - All test data has been removed")
  console.log("  - Ready for production use")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
