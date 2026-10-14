"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, Loader2, MapPin, Phone, Store } from "lucide-react"

// Public enquiry form — shop owners share this link (WhatsApp, Facebook, posters) to collect leads.
export default function EnquiryPage() {
  const { shopId } = useParams<{ shopId: string }>()
  const [shop, setShop] = useState<{ name: string; city: string | null; phone: string | null; logo: string | null } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", city: "", type: "TRADER", interest: "", quantity: "", message: "", website: "" })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/public/enquiry?shop=${encodeURIComponent(shopId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setShop(d.shop))
      .catch(() => setNotFound(true))
  }, [shopId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.phone.trim()) return setError("Please enter your name and phone number")
    setSending(true)
    try {
      const res = await fetch("/api/public/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, shopId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || "Could not send your enquiry. Please try again.")
      else setSent(true)
    } finally {
      setSending(false)
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value })

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-500">This enquiry link is not valid.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-emerald-600 flex items-center justify-center flex-shrink-0">
            {shop?.logo ? <img src={shop.logo} alt="" className="w-full h-full object-cover" /> : <Store className="w-6 h-6 text-white" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{shop?.name || "…"}</h1>
            <div className="flex flex-wrap gap-x-3 text-sm text-gray-500">
              {shop?.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{shop.city}</span>}
              {shop?.phone && <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-1 hover:text-emerald-700"><Phone className="w-3.5 h-3.5" />{shop.phone}</a>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {sent ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">Thank you!</h2>
              <p className="text-gray-500 mt-1">We have received your enquiry and will contact you soon.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Send us an enquiry</h2>
                <p className="text-sm text-gray-500">Buying or selling? Leave your details and we will call you back with today&apos;s rates.</p>
              </div>
              <div><Label>Your name *</Label><Input value={form.name} onChange={set("name")} maxLength={120} required /></div>
              <div><Label>Phone / WhatsApp *</Label><Input type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="03xx xxxxxxx" maxLength={30} required /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>City / Village</Label><Input value={form.city} onChange={set("city")} maxLength={80} /></div>
                <div>
                  <Label>I am a</Label>
                  <select value={form.type} onChange={set("type")} className="mt-1 h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm">
                    <option value="TRADER">Trader / Buyer</option>
                    <option value="FARMER">Farmer / Grower</option>
                    <option value="SUPPLIER">Supplier</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Crop / Product</Label><Input value={form.interest} onChange={set("interest")} placeholder="e.g. Potato, Wheat" maxLength={200} /></div>
                <div><Label>Quantity</Label><Input value={form.quantity} onChange={set("quantity")} placeholder="e.g. 500 bags" maxLength={100} /></div>
              </div>
              <div><Label>Message</Label><Textarea value={form.message} onChange={set("message")} rows={3} maxLength={1000} /></div>
              {/* Honeypot for bots — hidden from people */}
              <input type="text" name="website" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={sending || !shop}>
                {sending && <Loader2 className="w-4 h-4 animate-spin" />} Send enquiry
              </Button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Your details are only shared with {shop?.name || "this shop"}.</p>
      </div>
    </div>
  )
}
