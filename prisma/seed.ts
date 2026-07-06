import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // ── Super Admin (Platform Head) — no shopId ──────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 12)
  const admin = await db.user.upsert({
    where: { email: "admin@galamandi.com" },
    update: {},
    create: {
      name: "Platform Admin",
      email: "admin@galamandi.com",
      password: adminPassword,
      role: "SUPER_ADMIN",
      shopId: null,
    },
  })

  // ── Demo Shop (APPROVED) ──────────────────────────────────────────────────
  let demoShop = await db.shop.findUnique({ where: { email: "demo@galamandi.com" } })
  if (!demoShop) {
    demoShop = await db.shop.create({
      data: {
        name: "Gala Mandi — Demo Shop",
        ownerName: "Ahmed Khan",
        email: "demo@galamandi.com",
        phone: "0300-1234567",
        city: "Lahore",
        status: "APPROVED",
        isActive: true,
      },
    })
  }

  // Demo shop manager
  const managerPassword = await bcrypt.hash("manager123", 12)
  await db.user.upsert({
    where: { email: "manager@galamandi.com" },
    update: { shopId: demoShop.id },
    create: {
      shopId: demoShop.id,
      name: "Ahmed Khan",
      email: "manager@galamandi.com",
      password: managerPassword,
      role: "MANAGER",
      isActive: true,
    },
  })

  // Demo shop cashier
  const cashierPassword = await bcrypt.hash("cashier123", 12)
  await db.user.upsert({
    where: { email: "cashier@galamandi.com" },
    update: { shopId: demoShop.id },
    create: {
      shopId: demoShop.id,
      name: "Ali Raza",
      email: "cashier@galamandi.com",
      password: cashierPassword,
      role: "CASHIER",
      isActive: true,
    },
  })

  // Demo shop admin
  const shopAdminPassword = await bcrypt.hash("shopadmin123", 12)
  await db.user.upsert({
    where: { email: "shopadmin@galamandi.com" },
    update: { shopId: demoShop.id },
    create: {
      shopId: demoShop.id,
      name: "Shop Owner",
      email: "shopadmin@galamandi.com",
      password: shopAdminPassword,
      role: "ADMIN",
      isActive: true,
    },
  })

  // ── Product categories for demo shop ─────────────────────────────────────
  const grains = await db.category.findFirst({ where: { shopId: demoShop.id, name: "Grains" } })
    ?? await db.category.create({ data: { shopId: demoShop.id, name: "Grains", description: "Wheat, Rice, Corn etc." } })

  const seeds = await db.category.findFirst({ where: { shopId: demoShop.id, name: "Seeds" } })
    ?? await db.category.create({ data: { shopId: demoShop.id, name: "Seeds", description: "Agricultural seeds" } })

  const fertilizers = await db.category.findFirst({ where: { shopId: demoShop.id, name: "Fertilizers" } })
    ?? await db.category.create({ data: { shopId: demoShop.id, name: "Fertilizers", description: "Chemical and organic fertilizers" } })

  // Products for demo shop
  const productData = [
    { name: "Wheat (Gehun)", categoryId: grains.id, unit: "Maund", currentStock: 500, minStock: 50, purchasePrice: 3800, salePrice: 4000 },
    { name: "Rice Basmati", categoryId: grains.id, unit: "KG", currentStock: 300, minStock: 30, purchasePrice: 320, salePrice: 380 },
    { name: "Corn (Makki)", categoryId: grains.id, unit: "Maund", currentStock: 200, minStock: 20, purchasePrice: 2200, salePrice: 2400 },
    { name: "Sunflower Seeds", categoryId: seeds.id, unit: "KG", currentStock: 100, minStock: 10, purchasePrice: 150, salePrice: 200 },
    { name: "Cotton Seeds", categoryId: seeds.id, unit: "KG", currentStock: 80, minStock: 10, purchasePrice: 250, salePrice: 300 },
    { name: "DAP Fertilizer", categoryId: fertilizers.id, unit: "Bag", currentStock: 50, minStock: 10, purchasePrice: 9500, salePrice: 10000 },
    { name: "Urea Fertilizer", categoryId: fertilizers.id, unit: "Bag", currentStock: 60, minStock: 10, purchasePrice: 4200, salePrice: 4500 },
  ]

  for (const p of productData) {
    const existing = await db.product.findFirst({ where: { shopId: demoShop.id, name: p.name } })
    if (!existing) {
      await db.product.create({ data: { shopId: demoShop.id, ...p } })
    }
  }

  // ── Pesticide categories for demo shop ───────────────────────────────────
  const herbicide = await db.pesticideCategory.findFirst({ where: { shopId: demoShop.id, name: "Herbicide" } })
    ?? await db.pesticideCategory.create({ data: { shopId: demoShop.id, name: "Herbicide" } })

  const insecticide = await db.pesticideCategory.findFirst({ where: { shopId: demoShop.id, name: "Insecticide" } })
    ?? await db.pesticideCategory.create({ data: { shopId: demoShop.id, name: "Insecticide" } })

  const fungicide = await db.pesticideCategory.findFirst({ where: { shopId: demoShop.id, name: "Fungicide" } })
    ?? await db.pesticideCategory.create({ data: { shopId: demoShop.id, name: "Fungicide" } })

  const pesticideData = [
    { name: "Glyphosate 41%", categoryId: herbicide.id, manufacturer: "Syngenta", batchNumber: "SYN2024A", expiryDate: new Date("2026-06-30"), quantity: 200, unit: "Litre", purchasePrice: 1200, salePrice: 1500, minStock: 20 },
    { name: "Chlorpyrifos 40%", categoryId: insecticide.id, manufacturer: "FMC", batchNumber: "FMC2024B", expiryDate: new Date("2025-12-31"), quantity: 150, unit: "Litre", purchasePrice: 900, salePrice: 1100, minStock: 15 },
    { name: "Mancozeb 80%", categoryId: fungicide.id, manufacturer: "Bayer", batchNumber: "BAY2024C", expiryDate: new Date("2026-03-31"), quantity: 100, unit: "KG", purchasePrice: 500, salePrice: 650, minStock: 10 },
  ]

  for (const p of pesticideData) {
    const existing = await db.pesticide.findFirst({ where: { shopId: demoShop.id, name: p.name } })
    if (!existing) {
      await db.pesticide.create({ data: { shopId: demoShop.id, ...p } })
    }
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  const customerData = [
    { name: "Muhammad Tariq", phone: "0300-1234567", address: "Village Chak 45, District Faisalabad" },
    { name: "Haji Bashir Ahmad", phone: "0333-7654321", address: "Main Bazaar, Sahiwal" },
    { name: "Ghulam Mustafa", phone: "0321-9876543", address: "Near Water Works, Okara" },
  ]
  for (const c of customerData) {
    const existing = await db.customer.findFirst({ where: { shopId: demoShop.id, name: c.name } })
    if (!existing) {
      await db.customer.create({ data: { shopId: demoShop.id, ...c } })
    }
  }

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const supplierData = [
    { name: "Punjab Agri Traders", phone: "042-35781234", address: "Hall Road, Lahore" },
    { name: "Syngenta Pakistan Ltd", phone: "021-35683000", address: "Karachi" },
    { name: "Ali Agro Supplies", phone: "041-2628456", address: "Grain Market, Faisalabad" },
  ]
  for (const s of supplierData) {
    const existing = await db.supplier.findFirst({ where: { shopId: demoShop.id, name: s.name } })
    if (!existing) {
      await db.supplier.create({ data: { shopId: demoShop.id, ...s } })
    }
  }

  // ── Sample task ───────────────────────────────────────────────────────────
  const manager = await db.user.findFirst({ where: { email: "manager@galamandi.com" } })
  if (manager) {
    const existingTask = await db.task.findFirst({ where: { shopId: demoShop.id, title: "Check wheat stock" } })
    if (!existingTask) {
      await db.task.create({
        data: {
          shopId: demoShop.id,
          title: "Check wheat stock and reorder if needed",
          description: "Monthly stock verification for wheat inventory.",
          assignedToId: manager.id,
          createdById: admin.id,
          priority: "HIGH",
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }

  console.log("Database seeded successfully!")
  console.log("\nLogin credentials:")
  console.log("  Platform Admin:  admin@galamandi.com     / admin123")
  console.log("  Shop Admin:      shopadmin@galamandi.com / shopadmin123")
  console.log("  Shop Manager:    manager@galamandi.com   / manager123")
  console.log("  Shop Cashier:    cashier@galamandi.com   / cashier123")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
