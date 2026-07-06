import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"

export function RecentSales({ sales }: { sales: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Sales</CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No sales yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Customer</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Amount</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">
                      {sale.customer?.name || "Walk-in"}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{formatCurrency(sale.totalAmount)}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(sale.status)}`}>
                        {sale.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{formatDate(sale.createdAt)}</td>
                    <td className="py-2 px-3 text-gray-500">{sale.createdBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
