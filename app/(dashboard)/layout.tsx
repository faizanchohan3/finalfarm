import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inventory": "Inventory",
  "/sales": "Sales",
  "/purchases": "Purchases",
  "/pesticides": "Pesticides",
  "/finance": "Finance",
  "/tasks": "Tasks",
  "/reports": "Reports",
  "/audit": "Audit Log",
  "/users": "User Management",
  "/settings": "Settings",
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="print:hidden">
          <Header title="Gala Mandi" />
        </div>
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 print:overflow-visible print:p-4 print:bg-white">{children}</main>
      </div>
    </div>
  )
}
