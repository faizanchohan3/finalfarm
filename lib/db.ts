import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  })

// Always persist singleton — reuses connection on Vercel warm invocations
globalForPrisma.prisma = db
