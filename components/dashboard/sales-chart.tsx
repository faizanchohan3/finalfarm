"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export function SalesChart() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/reports/monthly-sales")
      .then((r) => r.json())
      .then((d) => setData(d.data || []))
      .catch(() => {})
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Sales (Last 6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
            <Bar dataKey="sales" fill="#15803d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
