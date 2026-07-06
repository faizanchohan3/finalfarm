"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardNotFound() {
  const router = useRouter()
  const { data: session } = useSession()

  // CASHIER users redirected to dashboard immediately
  useEffect(() => {
    if (session && session.user?.role === "CASHIER") {
      router.replace("/dashboard")
    }
  }, [session, router])

  if (session?.user?.role === "CASHIER") {
    return null // Redirecting, show nothing
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-blue-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
          <p className="text-gray-600 mb-6">Page not found</p>
          <p className="text-sm text-gray-500 mb-8">
            The page you're looking for doesn't exist or you don't have permission to access it.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-purple-700 hover:bg-purple-800 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
