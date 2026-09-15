"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Lang = "en" | "ur"

// English text -> Urdu. Any string wrapped with t() that isn't here simply
// falls back to English, so screens can be translated incrementally by adding keys.
const UR: Record<string, string> = {
  // Sidebar / navigation
  "Dashboard": "ڈیش بورڈ",
  "Store": "اسٹور",
  "Lots": "لاٹس",
  "Traders": "تاجر",
  "Suppliers": "سپلائرز",
  "Farmers": "کسان",
  "Commission (Aadat)": "کمیشن (آڑھت)",
  "Agents": "ایجنٹس",
  "Purchases": "خریداری",
  "Sales": "فروخت",
  "Pesticides": "زرعی ادویات",
  "Roznamcha": "روزنامچہ",
  "Banks": "بینک",
  "Expenses": "اخراجات",
  "Godowns": "گودام",
  "Gate / Weighbridge": "گیٹ / وے برج",
  "Transport": "ٹرانسپورٹ",
  "Notes": "نوٹس",
  "Reports": "رپورٹس",
  "Audit Log": "آڈٹ لاگ",
  "Users": "صارفین",
  "Settings": "ترتیبات",
  "All Shops": "تمام دکانیں",
  "My Profile": "میری پروفائل",
  "Shop Management": "دکان کا انتظام",
  "Platform Head": "پلیٹ فارم سربراہ",

  // Reports submenu
  "Overview": "مجموعی جائزہ",
  "Balance Sheet & P&L": "بیلنس شیٹ اور نفع و نقصان",
  "Sales Report": "فروخت رپورٹ",
  "Purchase Report": "خریداری رپورٹ",
  "Trader Report": "تاجر رپورٹ",
  "Product Report": "پروڈکٹ رپورٹ",
  "Trader Ledger": "تاجر کھاتہ",
  "All Suppliers": "تمام سپلائرز",
  "Supplier Ledger": "سپلائر کھاتہ",
  "All Traders": "تمام تاجر",
  "Bank Transactions": "بینک لین دین",

  // Header / account
  "Signed in as": "بطور سائن ان",
  "My Profile & Password": "میری پروفائل اور پاس ورڈ",
  "Sign Out": "سائن آؤٹ",

  // Login / register
  "Sign In": "سائن ان",
  "Signing in...": "سائن ان ہو رہا ہے...",
  "Email Address": "ای میل ایڈریس",
  "Password": "پاس ورڈ",
  "Register here": "یہاں رجسٹر کریں",
  "Want to register your shop?": "اپنی دکان رجسٹر کرنا چاہتے ہیں؟",
  "Register Your Shop": "اپنی دکان رجسٹر کریں",
  "Shop Name *": "دکان کا نام *",
  "Your Name (Owner) *": "آپ کا نام (مالک) *",
  "Email Address *": "ای میل ایڈریس *",
  "Password *": "پاس ورڈ *",
  "Confirm Password *": "پاس ورڈ کی تصدیق *",
  "Phone": "فون",
  "City": "شہر",
  "Submit Registration": "رجسٹریشن جمع کرائیں",
  "Already have an account?": "پہلے سے اکاؤنٹ ہے؟",
  "Back to Sign In": "سائن ان پر واپس",

  // Common actions
  "Save": "محفوظ کریں",
  "Cancel": "منسوخ کریں",
  "Delete": "حذف کریں",
  "Edit": "ترمیم",
  "Add": "شامل کریں",
  "Search": "تلاش",
  "Loading...": "لوڈ ہو رہا ہے...",
  "Export Data": "ڈیٹا ایکسپورٹ",
  "Import Data": "ڈیٹا امپورٹ",
  "Language": "زبان",
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string; dir: "ltr" | "rtl" }

const LangContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (s) => s, dir: "ltr" })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lang")
      if (saved === "ur" || saved === "en") setLangState(saved)
    } catch {}
  }, [])

  useEffect(() => {
    const el = document.documentElement
    el.lang = lang
    el.dir = lang === "ur" ? "rtl" : "ltr"
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem("lang", l)
    } catch {}
  }

  const t = (s: string) => (lang === "ur" ? UR[s] ?? s : s)

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir: lang === "ur" ? "rtl" : "ltr" }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
