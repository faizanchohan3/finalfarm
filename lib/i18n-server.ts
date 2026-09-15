import { cookies } from "next/headers"
import { tr, type Lang } from "@/lib/i18n-dict"

// For server components: read the language cookie and return a t() helper.
export async function getT() {
  const store = await cookies()
  const raw = store.get("lang")?.value
  const lang: Lang = raw === "ur" ? "ur" : "en"
  return { lang, t: (s: string) => tr(lang, s) }
}
