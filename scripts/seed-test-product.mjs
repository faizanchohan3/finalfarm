import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  // Find or create a category
  let category = await db.category.findFirst()
  if (!category) {
    category = await db.category.create({ data: { name: "General" } })
    console.log("Created category:", category.name)
  }

  // Find the first shop (to associate the product correctly)
  const shop = await db.shop.findFirst({ where: { isActive: true } })
  console.log("Using shop:", shop?.name ?? "(none)")

  // Create a dummy product
  const product = await db.product.create({
    data: {
      shopId: shop?.id ?? null,
      name: "Test Wheat",
      categoryId: category.id,
      unit: "KG",
      currentStock: 500,
      minStock: 50,
      purchasePrice: 80,
      salePrice: 100,
    },
  })

  console.log("Created product:", product.name, "| ID:", product.id)
}

main().catch(console.error).finally(() => db.$disconnect())
