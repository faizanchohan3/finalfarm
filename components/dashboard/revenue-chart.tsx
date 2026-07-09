"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

export function RevenueChart() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const generateMockData = () => {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
      return months.map((month, i) => ({
        month,
        revenue: Math.floor(Math.random() * 500000) + 200000,
        expenses: Math.floor(Math.random() * 300000) + 100000,
      }))
    }
    setData(generateMockData())
  }, [])

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
        <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
        <Legend />
        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} />
        <Line type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316", r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
