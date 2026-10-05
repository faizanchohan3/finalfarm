// Short record IDs typed into the Dashboard lookup, e.g. CM-7K2Q9X.
// Built from the last 6 characters of the database id, so nothing extra is stored.
// Potato Store lots use their own lot number (LOT-2026-00012) instead.
export const RECORD_PREFIX = { commission: "CM", bill: "BL", product: "ST", gala: "GM" } as const
export type CodedRecord = keyof typeof RECORD_PREFIX

export function recordCode(type: CodedRecord, id: string | null | undefined) {
  return id ? `${RECORD_PREFIX[type]}-${id.slice(-6).toUpperCase()}` : ""
}
