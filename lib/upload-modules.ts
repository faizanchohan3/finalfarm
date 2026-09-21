// Image upload (OCR) module definitions.
// Each module has a printable form: every record is a block of "Label: value" lines.
// OCR reads the printed labels reliably, so we find fields by label and take the rest of the line as the value.

export type UploadField = {
  key: string
  label: string
  required?: boolean
  number?: boolean
  hint?: string
}

export type Lookups = {
  suppliers: any[]
  customers: any[]
  farmers: any[]
  products: any[]
}

export type UploadModule = {
  key: string
  label: string
  endpoint: string
  fields: UploadField[]
  sample: Record<string, string>[]
  needs?: (keyof Lookups)[]
  // Build the POST body for one row, or throw an Error with a readable message
  toPayload: (row: Record<string, string>, lk: Lookups) => any
}

const num = (v: string | undefined) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""))
  return isNaN(n) ? 0 : n
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

export function findByName<T extends { name: string }>(list: T[], name: string | undefined): T | undefined {
  if (!name?.trim()) return undefined
  const n = norm(name)
  return list.find((x) => norm(x.name) === n)
}

// Accepts 21-09-2026, 21/9/2026, 2026-09-21. Returns YYYY-MM-DD or undefined.
export function parseDate(v: string | undefined): string | undefined {
  if (!v?.trim()) return undefined
  const s = v.trim()
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  }
  return undefined
}

export const UPLOAD_MODULES: UploadModule[] = [
  {
    key: "farmers",
    label: "Farmers",
    endpoint: "/api/farmers",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "phone", label: "Phone" },
      { key: "village", label: "Village" },
      { key: "address", label: "Address" },
      { key: "cnic", label: "CNIC" },
    ],
    sample: [
      { name: "Muhammad Aslam", phone: "03001234567", village: "Chak 45", address: "Main Bazar", cnic: "35202-1234567-1" },
      { name: "Ghulam Rasool", phone: "03124567890", village: "Kot Adu", address: "Near Masjid", cnic: "" },
    ],
    toPayload: (r) => ({ name: r.name, phone: r.phone, village: r.village, address: r.address, cnic: r.cnic }),
  },
  {
    key: "customers",
    label: "Traders",
    endpoint: "/api/customers",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "creditLimit", label: "Credit Limit", number: true },
    ],
    sample: [
      { name: "Bilal Traders", phone: "03211112233", address: "Grain Market", creditLimit: "500000" },
      { name: "Usman & Sons", phone: "03335556677", address: "Multan Road", creditLimit: "0" },
    ],
    toPayload: (r) => ({ name: r.name, phone: r.phone || null, address: r.address || null, creditLimit: num(r.creditLimit) }),
  },
  {
    key: "suppliers",
    label: "Suppliers",
    endpoint: "/api/suppliers",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
    ],
    sample: [
      { name: "Ali Seeds Company", phone: "03007778899", address: "Lahore" },
      { name: "Kissan Fertilizer", phone: "03451239876", address: "Okara" },
    ],
    toPayload: (r) => ({ name: r.name, phone: r.phone || null, address: r.address || null }),
  },
  {
    key: "agents",
    label: "Agents",
    endpoint: "/api/agents",
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "cnic", label: "CNIC" },
      { key: "commissionRate", label: "Rate", number: true, hint: "commission %" },
    ],
    sample: [
      { name: "Rashid Mehmood", phone: "03019998877", address: "Sahiwal", cnic: "", commissionRate: "2.5" },
    ],
    toPayload: (r) => ({ name: r.name, phone: r.phone, address: r.address, cnic: r.cnic, commissionRate: num(r.commissionRate) || 2.5 }),
  },
  {
    key: "expenses",
    label: "Expenses",
    endpoint: "/api/expenses",
    fields: [
      { key: "amount", label: "Amount", required: true, number: true },
      { key: "description", label: "Detail", required: true },
      { key: "category", label: "Category", hint: "Rent, Salaries, Transport..." },
      { key: "reference", label: "Reference" },
    ],
    sample: [
      { amount: "15000", description: "Shop rent September", category: "Rent", reference: "R-101" },
      { amount: "3500", description: "Electricity bill", category: "Utilities", reference: "" },
      { amount: "2000", description: "Loader labour", category: "Transport", reference: "" },
    ],
    toPayload: (r) => {
      if (num(r.amount) <= 0) throw new Error("Amount must be more than 0")
      return { amount: num(r.amount), description: r.description, category: r.category || "General", reference: r.reference || null }
    },
  },
  {
    key: "finance",
    label: "Roznamcha",
    endpoint: "/api/finance",
    fields: [
      { key: "date", label: "Date", hint: "DD-MM-YYYY" },
      { key: "type", label: "Type", required: true, hint: "IN or OUT" },
      { key: "amount", label: "Amount", required: true, number: true },
      { key: "description", label: "Detail", required: true },
      { key: "category", label: "Category" },
    ],
    sample: [
      { date: "21-09-2026", type: "IN", amount: "25000", description: "Commission received", category: "Commission" },
      { date: "21-09-2026", type: "OUT", amount: "8000", description: "Staff salary", category: "Salaries" },
    ],
    toPayload: (r) => {
      const t = r.type.trim().toUpperCase()
      const type = /^(IN|CR|CREDIT|INCOME|RECEIVE)/.test(t) ? "CREDIT" : /^(OUT|DR|DEBIT|EXPENSE|PAY)/.test(t) ? "DEBIT" : null
      if (!type) throw new Error("Type must be IN or OUT")
      if (num(r.amount) <= 0) throw new Error("Amount must be more than 0")
      return {
        type,
        amount: num(r.amount),
        description: r.description,
        category: r.category || null,
        reference: null,
        transactionDate: parseDate(r.date),
      }
    },
  },
  {
    key: "purchases",
    label: "Purchases",
    endpoint: "/api/purchases",
    needs: ["suppliers", "farmers", "customers", "products"],
    fields: [
      { key: "date", label: "Date", hint: "DD-MM-YYYY" },
      { key: "party", label: "Seller", hint: "supplier / farmer / trader name" },
      { key: "product", label: "Product", required: true },
      { key: "quantity", label: "Qty", required: true, number: true },
      { key: "price", label: "Rate", required: true, number: true },
      { key: "paid", label: "Paid", number: true },
      { key: "notes", label: "Notes" },
    ],
    sample: [
      { date: "21-09-2026", party: "Muhammad Aslam", product: "Wheat", quantity: "40", price: "4200", paid: "100000", notes: "" },
      { date: "21-09-2026", party: "Ali Seeds Company", product: "Potato Seed", quantity: "25", price: "3000", paid: "0", notes: "Credit" },
    ],
    toPayload: (r, lk) => {
      const quantity = num(r.quantity), price = num(r.price)
      if (quantity <= 0 || price <= 0) throw new Error("Qty and Rate must be more than 0")
      const supplier = findByName(lk.suppliers, r.party)
      const farmer = supplier ? undefined : findByName(lk.farmers, r.party)
      const trader = supplier || farmer ? undefined : findByName(lk.customers, r.party)
      const product = findByName(lk.products, r.product)
      return {
        supplierId: supplier?.id || null,
        farmerId: farmer?.id || null,
        sellerCustomerId: trader?.id || null,
        walkinSeller: !supplier && !farmer && !trader && r.party?.trim() ? r.party.trim() : null,
        items: [product ? { productId: product.id, quantity, price } : { customName: r.product.trim(), quantity, price }],
        paidAmount: num(r.paid),
        notes: r.notes || null,
        purchaseDate: parseDate(r.date),
      }
    },
  },
  {
    key: "sales",
    label: "Sales",
    endpoint: "/api/sales",
    needs: ["customers", "farmers", "products"],
    fields: [
      { key: "date", label: "Date", hint: "DD-MM-YYYY" },
      { key: "party", label: "Buyer", hint: "trader / farmer name" },
      { key: "product", label: "Product", required: true, hint: "must exist in Store" },
      { key: "quantity", label: "Qty", required: true, number: true },
      { key: "price", label: "Rate", required: true, number: true },
      { key: "paid", label: "Paid", number: true },
      { key: "notes", label: "Notes" },
    ],
    sample: [
      { date: "21-09-2026", party: "Bilal Traders", product: "Wheat", quantity: "10", price: "4500", paid: "45000", notes: "" },
    ],
    toPayload: (r, lk) => {
      const quantity = num(r.quantity), price = num(r.price)
      if (quantity <= 0 || price <= 0) throw new Error("Qty and Rate must be more than 0")
      const product = findByName(lk.products, r.product)
      if (!product) throw new Error(`Product "${r.product}" not found in Store`)
      const customer = findByName(lk.customers, r.party)
      const farmer = customer ? undefined : findByName(lk.farmers, r.party)
      const unknownParty = !customer && !farmer && r.party?.trim() ? `Buyer: ${r.party.trim()}` : ""
      return {
        customerId: customer?.id || null,
        farmerId: farmer?.id || null,
        items: [{ productId: product.id, quantity, price }],
        paidAmount: num(r.paid),
        notes: [unknownParty, r.notes].filter(Boolean).join(" — ") || null,
        saleDate: parseDate(r.date),
      }
    },
  },
  {
    key: "tasks",
    label: "Notes",
    endpoint: "/api/tasks",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "description", label: "Detail" },
      { key: "priority", label: "Priority", hint: "LOW / MEDIUM / HIGH / URGENT" },
      { key: "dueDate", label: "Due Date", hint: "DD-MM-YYYY" },
    ],
    sample: [
      { title: "Call Bilal Traders", description: "Ask for pending payment", priority: "HIGH", dueDate: "25-09-2026" },
    ],
    toPayload: (r) => {
      const p = r.priority?.trim().toUpperCase()
      return {
        title: r.title,
        description: r.description || null,
        priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p) ? p : "MEDIUM",
        dueDate: parseDate(r.dueDate) || null,
      }
    },
  },
]

// ── OCR text → records ─────────────────────────────────────────────

function levenshtein(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

// Undo common OCR letter confusions (rn→m, 0→o, 1→l, vv→w) before comparing labels
const ocrNorm = (s: string) => norm(s).replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/[1|]/g, "l")

// Match the start of an OCR line to one of the module's labels (tolerates small OCR mistakes)
function matchLabel(line: string, fields: UploadField[]): { field: UploadField; value: string } | null {
  const sep = line.search(/[:;=|]/)
  const head = sep > 0 ? line.slice(0, sep) : ""
  let best: { field: UploadField; value: string; dist: number } | null = null
  for (const f of fields) {
    const label = ocrNorm(f.label)
    if (head) {
      const dist = levenshtein(ocrNorm(head), label)
      if (dist <= Math.max(1, Math.floor(label.length / 3)) && (!best || dist < best.dist))
        best = { field: f, value: line.slice(sep + 1), dist }
    } else if (ocrNorm(line).startsWith(label)) {
      // No separator read — strip the label words from the front
      const words = f.label.split(/\s+/).length
      best = { field: f, value: line.split(/\s+/).slice(words).join(" "), dist: 0 }
    }
  }
  return best ? { field: best.field, value: best.value } : null
}

const cleanValue = (v: string) => v.replace(/[_]{2,}|\.{3,}/g, " ").replace(/\s+/g, " ").trim()

export function parseOcrText(text: string, mod: UploadModule): Record<string, string>[] {
  const rows: Record<string, string>[] = []
  let cur: Record<string, string> = {}
  const flush = () => {
    if (Object.values(cur).some((v) => v)) rows.push(cur)
    cur = {}
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    // "Record #2" / "Entry 3" / "#4" starts a new record
    if (/^(record|entry|sr|no)\b.*\d|^#\s*\d+/i.test(line) && !matchLabel(line, mod.fields)) {
      flush()
      continue
    }
    const m = matchLabel(line, mod.fields)
    if (!m) continue
    // Same label seen twice → a new record started without a header
    if (m.field.key in cur) flush()
    cur[m.field.key] = cleanValue(m.value)
  }
  flush()
  return rows.map((r) => Object.fromEntries(mod.fields.map((f) => [f.key, r[f.key] ?? ""])))
}

export function rowErrors(row: Record<string, string>, mod: UploadModule): string[] {
  return mod.fields.filter((f) => f.required && !row[f.key]?.trim()).map((f) => `${f.label} is required`)
}
