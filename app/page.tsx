import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function RootPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "SUPER_ADMIN") redirect("/shops")
  redirect("/dashboard")
}
