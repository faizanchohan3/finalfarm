import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { auth } from "@/auth"
import { LanguageProvider } from "@/lib/i18n"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

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
    <html lang="en" className={`h-full ${geist.variable}`}>
      <body className="min-h-full bg-white">
        <SessionProvider session={session}>
          <LanguageProvider>{children}</LanguageProvider>
        </SessionProvider>
      </body>
    </html>
  )
}

