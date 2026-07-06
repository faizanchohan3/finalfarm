import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { auth } from "@/auth"

export const metadata: Metadata = {
  title: "ArgoFirm - Farm Management",
  description: "ArgoFirm Farm Management System",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  )
}
