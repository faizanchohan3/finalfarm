// Record IDs shown on pages and prints and typed into the Dashboard lookup, e.g. SRM-12.
// New and numbered records carry their own `code` (see lib/record-number.ts). A record without one
// falls back to the old short form built from its database id (CM-7K2Q9X, BL-…, ST-…, GM-…).
// Potato Store lots use their own lot number (LOT-2026-00012) instead.
export const RECORD_PREFIX = { commission: "CM", bill: "BL", product: "ST", gala: "GM" } as const
export type CodedRecord = keyof typeof RECORD_PREFIX

export function recordCode(type: CodedRecord, rec: { id: string; code?: string | null } | string | null | undefined) {
  if (!rec) return ""
  if (typeof rec === "object" && rec.code) return rec.code
  const id = typeof rec === "string" ? rec : rec.id
  return id ? `${RECORD_PREFIX[type]}-${id.slice(-6).toUpperCase()}` : ""
}
