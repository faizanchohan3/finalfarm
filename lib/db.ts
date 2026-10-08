import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    // Saves like a Potato Store sale run many queries in one transaction; from Vercel to the
    // Supabase database each query is a network round trip, so the default 5 s limit
    // ("Transaction not found…") is too short. Wait up to 10 s to start, 30 s to finish.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  })

// Always persist singleton — reuses connection on Vercel warm invocations
globalForPrisma.prisma = db

