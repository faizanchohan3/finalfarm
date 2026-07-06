"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDateTime } from "@/lib/utils"
import { Shield, User, Package, ShoppingCart, Sprout, Wallet, CheckSquare, Users } from "lucide-react"

const MODULES = ["ALL", "INVENTORY", "SALES", "PURCHASES", "PESTICIDES", "FINANCE", "TASKS", "USERS"]

const moduleIcon: Record<string, any> = {
  INVENTORY: Package,
  SALES: ShoppingCart,
  PURCHASES: ShoppingCart,
  PESTICIDES: Sprout,
  FINANCE: Wallet,
  TASKS: CheckSquare,
  USERS: Users,
}

const actionColor: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
}

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [module, setModule] = useState("ALL")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  async function loadData(m = module, p = page) {
    setLoading(true)
    const url = `/api/audit?page=${p}&limit=50${m !== "ALL" ? `&module=${m}` : ""}`
    const data = await fetch(url).then((r) => r.json())
    setLogs(data.logs || [])
    setTotal(data.total || 0)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [module, page])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
        <p className="text-gray-500 text-sm">{total} total activity records</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select value={module} onValueChange={(v) => { setModule(v); setPage(1) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => <SelectItem key={m} value={m}>{m === "ALL" ? "All Modules" : m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-gray-500">Showing {logs.length} of {total} entries</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading && !logs.length ? (
            <div className="text-center py-8 text-gray-400">Loading audit logs...</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const Icon = moduleIcon[log.module] || Shield
                return (
                  <div key={log.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColor[log.action] || "bg-gray-100 text-gray-700"}`}>
                          {log.action}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{log.module}</span>
                        <span className="text-sm text-gray-700">{log.details}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <User className="w-3 h-3" />
                        <span>{log.user?.name}</span>
                        <span>•</span>
                        <span>{formatDateTime(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {logs.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No audit logs found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {Math.ceil(total / 50)}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
