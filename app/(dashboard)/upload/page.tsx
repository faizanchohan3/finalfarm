"use client"

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  UPLOAD_MODULES, parseOcrText, rowErrors,
  type Lookups, type UploadModule,
} from "@/lib/upload-modules"
import {
  ImageUp, Printer, Download, Wand2, Plus, Trash2, Save,
  CheckCircle2, XCircle, Loader2, RefreshCw,
} from "lucide-react"

type RowStatus = { state: "idle" | "saving" | "saved" | "error"; message?: string }

// ── Printable blank form ───────────────────────────────────────────
function printBlankForm(mod: UploadModule) {
  const perPage = mod.fields.length > 5 ? 3 : 4
  const card = (n: number) => `
    <div class="rec">
      <div class="head">Record #${n}</div>
      ${mod.fields.map((f) => `<div class="line"><b>${f.label}:</b><span></span>${f.hint ? `<i>${f.hint}</i>` : ""}</div>`).join("")}
    </div>`
  const html = `<!doctype html><html><head><title>${mod.label} Upload Form</title><style>
    body{font-family:Arial,sans-serif;margin:24px;color:#000}
    h1{font-size:22px;margin:0 0 4px} p{font-size:12px;margin:0 0 14px;color:#333}
    .rec{border:2px solid #000;border-radius:6px;padding:10px 14px;margin-bottom:14px;page-break-inside:avoid}
    .head{font-weight:bold;font-size:16px;margin-bottom:6px}
    .line{display:flex;align-items:flex-end;gap:8px;font-size:18px;height:38px}
    .line b{white-space:nowrap} .line span{flex:1;border-bottom:1.5px solid #000;height:26px}
    .line i{font-size:10px;color:#666;white-space:nowrap}
  </style></head><body>
    <h1>${mod.label} — Upload Form</h1>
    <p>Write in CLEAR CAPITAL English letters, on the line after each label. Leave unused records empty. Take a straight, well-lit photo of the full page and upload it on the Upload page.</p>
    ${Array.from({ length: perPage }, (_, i) => card(i + 1)).join("")}
    <script>window.onload=()=>window.print()</script>
  </body></html>`
  const w = window.open("", "_blank")
  if (!w) return alert("Allow pop-ups to print the form")
  w.document.write(html)
  w.document.close()
}

// ── Dummy printed receipt (filled with sample data) ───────────────
function renderSampleReceipt(mod: UploadModule): HTMLCanvasElement {
  const lineH = 44, pad = 40
  const lines: { text: string; bold?: boolean; gap?: number }[] = [
    { text: `${mod.label.toUpperCase()} UPLOAD FORM`, bold: true, gap: 20 },
  ]
  mod.sample.forEach((r, i) => {
    lines.push({ text: `Record #${i + 1}`, bold: true, gap: 16 })
    mod.fields.forEach((f) => lines.push({ text: `${f.label}: ${r[f.key] ?? ""}` }))
  })
  const canvas = document.createElement("canvas")
  canvas.width = 1100
  canvas.height = pad * 2 + lines.reduce((h, l) => h + lineH + (l.gap || 0), 0)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#000"
  ctx.textBaseline = "top"
  let y = pad
  for (const l of lines) {
    y += l.gap || 0
    ctx.font = `${l.bold ? "bold " : ""}30px Arial`
    ctx.fillText(l.text, pad, y)
    y += lineH
  }
  return canvas
}

// Grayscale + upscale small photos — Tesseract reads better at ~1500px+
async function prepareImage(src: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  if (src instanceof HTMLCanvasElement) return src
  const bmp = await createImageBitmap(src)
  const scale = bmp.width < 1500 ? 1500 / bmp.width : 1
  const c = document.createElement("canvas")
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const ctx = c.getContext("2d")!
  ctx.filter = "grayscale(1) contrast(1.4)"
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  return c
}

export default function UploadPage() {
  const [modKey, setModKey] = useState(UPLOAD_MODULES[0].key)
  const mod = useMemo(() => UPLOAD_MODULES.find((m) => m.key === modKey)!, [modKey])

  const [preview, setPreview] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState("")
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [status, setStatus] = useState<RowStatus[]>([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function selectModule(key: string) {
    setModKey(key)
    setPreview(null)
    setOcrText("")
    setRows([])
    setStatus([])
  }

  function applyText(text: string, m: UploadModule = mod) {
    const parsed = parseOcrText(text, m)
    setRows(parsed)
    setStatus(parsed.map(() => ({ state: "idle" })))
  }

  async function runOcr(sources: (Blob | HTMLCanvasElement)[]) {
    setProgress({ label: "Loading OCR engine (first time can take a minute)...", pct: 0 })
    try {
      const { createWorker } = await import("tesseract.js")
      let current = 0
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text")
            setProgress({ label: `Reading image ${current + 1} of ${sources.length}...`, pct: Math.round(m.progress * 100) })
        },
      })
      const texts: string[] = []
      for (; current < sources.length; current++) {
        const img = await prepareImage(sources[current])
        const { data } = await worker.recognize(img)
        texts.push(data.text)
      }
      await worker.terminate()
      const text = texts.join("\n")
      setOcrText(text)
      applyText(text)
    } catch (e: any) {
      alert(`Could not read image: ${e?.message || e}`)
    } finally {
      setProgress(null)
    }
  }

  function onFiles(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    setPreview(URL.createObjectURL(list[0]))
    runOcr(list)
  }

  function trySample() {
    const canvas = renderSampleReceipt(mod)
    setPreview(canvas.toDataURL("image/png"))
    runOcr([canvas])
  }

  function downloadSample() {
    const a = document.createElement("a")
    a.href = renderSampleReceipt(mod).toDataURL("image/png")
    a.download = `${mod.key}-sample-receipt.png`
    a.click()
  }

  function updateCell(i: number, key: string, value: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
    setStatus((ss) => ss.map((s, j) => (j === i && s.state === "error" ? { state: "idle" } : s)))
  }

  function addRow() {
    setRows((rs) => [...rs, Object.fromEntries(mod.fields.map((f) => [f.key, ""]))])
    setStatus((ss) => [...ss, { state: "idle" }])
  }

  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i))
    setStatus((ss) => ss.filter((_, j) => j !== i))
  }

  async function loadLookups(): Promise<Lookups> {
    const need = new Set(mod.needs || [])
    const get = async (url: string, key: string) =>
      fetch(url).then((r) => r.json()).then((d) => d[key] || []).catch(() => [])
    const [suppliers, customers, farmers, products] = await Promise.all([
      need.has("suppliers") ? get("/api/suppliers", "suppliers") : [],
      need.has("customers") ? get("/api/customers", "customers") : [],
      need.has("farmers") ? get("/api/farmers", "farmers") : [],
      need.has("products") ? get("/api/inventory", "products") : [],
    ])
    return { suppliers, customers, farmers, products }
  }

  async function saveAll() {
    setSaving(true)
    try {
      const lookups = await loadLookups()
      for (let i = 0; i < rows.length; i++) {
        if (status[i]?.state === "saved") continue
        const setRow = (s: RowStatus) => setStatus((ss) => ss.map((x, j) => (j === i ? s : x)))
        const errs = rowErrors(rows[i], mod)
        if (errs.length) { setRow({ state: "error", message: errs.join(", ") }); continue }
        setRow({ state: "saving" })
        try {
          const payload = mod.toPayload(rows[i], lookups)
          const res = await fetch(mod.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            throw new Error(d.error || `Server error ${res.status}`)
          }
          setRow({ state: "saved" })
        } catch (e: any) {
          setRow({ state: "error", message: e?.message || "Failed" })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const savedCount = status.filter((s) => s.state === "saved").length
  const pending = rows.length - savedCount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ImageUp className="w-6 h-6 text-purple-600" /> Upload Data from Image
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Print the form, write your records on it, take a photo and upload. The text is read automatically — check it, then save.
        </p>
      </div>

      {/* Step 1 — module */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Choose module</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {UPLOAD_MODULES.map((m) => (
              <button
                key={m.key}
                onClick={() => selectModule(m.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  m.key === modKey
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md"
                    : "bg-white text-gray-700 border-gray-200 hover:border-purple-400"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
            <span className="font-semibold">Form labels for {mod.label}: </span>
            {mod.fields.map((f) => `${f.label}${f.required ? "*" : ""}`).join(" · ")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => printBlankForm(mod)}>
              <Printer className="w-4 h-4" /> Print blank form
            </Button>
            <Button variant="outline" onClick={downloadSample}>
              <Download className="w-4 h-4" /> Download sample receipt
            </Button>
            <Button variant="outline" onClick={trySample} disabled={!!progress}>
              <Wand2 className="w-4 h-4" /> Try with sample
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 — image */}
      <Card>
        <CardHeader><CardTitle className="text-base">2. Upload image</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => !progress && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (!progress) onFiles(e.dataTransfer.files) }}
            className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center cursor-pointer hover:bg-purple-50 transition-colors"
          >
            <ImageUp className="w-10 h-10 text-purple-500 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">Click or drop photos here</p>
            <p className="text-xs text-gray-500">JPG / PNG — you can select several pages at once</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => { onFiles(e.target.files); e.target.value = "" }}
            />
          </div>

          {progress && (
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                <Loader2 className="w-4 h-4 animate-spin" /> {progress.label} {progress.pct > 0 && `${progress.pct}%`}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          )}

          {(preview || ocrText) && (
            <div className="grid md:grid-cols-2 gap-4">
              {preview && (
                <img src={preview} alt="Uploaded" className="max-h-80 w-full object-contain border rounded-lg bg-gray-50" />
              )}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Text read from image (you can fix it here)</p>
                <Textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={10} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => applyText(ocrText)}>
                  <RefreshCw className="w-3.5 h-3.5" /> Re-read text into table
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3 — review & save */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">3. Check records & save ({rows.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-4 h-4" /> Add row</Button>
            <Button size="sm" onClick={saveAll} disabled={saving || pending === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save {pending > 0 ? pending : ""} to {mod.label}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No records yet — upload an image or click “Try with sample”.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="py-2 px-2">#</th>
                    {mod.fields.map((f) => (
                      <th key={f.key} className="py-2 px-2 whitespace-nowrap">{f.label}{f.required && <span className="text-red-500">*</span>}</th>
                    ))}
                    <th className="py-2 px-2">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const s = status[i] || { state: "idle" }
                    const locked = s.state === "saved" || s.state === "saving"
                    return (
                      <tr key={i} className={`border-b ${s.state === "saved" ? "bg-green-50" : s.state === "error" ? "bg-red-50" : ""}`}>
                        <td className="py-2 px-2 text-gray-500">{i + 1}</td>
                        {mod.fields.map((f) => (
                          <td key={f.key} className="py-1 px-1 min-w-[120px]">
                            <Input
                              value={r[f.key] ?? ""}
                              disabled={locked}
                              inputMode={f.number ? "decimal" : undefined}
                              placeholder={f.hint}
                              onChange={(e) => updateCell(i, f.key, e.target.value)}
                              className={`h-8 text-sm ${f.required && !r[f.key]?.trim() ? "border-red-300" : ""}`}
                            />
                          </td>
                        ))}
                        <td className="py-2 px-2 min-w-[140px]">
                          {s.state === "saved" && <span className="flex items-center gap-1 text-green-700 text-xs font-semibold"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
                          {s.state === "saving" && <span className="flex items-center gap-1 text-gray-600 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Saving</span>}
                          {s.state === "error" && <span className="flex items-start gap-1 text-red-600 text-xs"><XCircle className="w-4 h-4 flex-shrink-0" /> {s.message}</span>}
                        </td>
                        <td className="py-2 px-2">
                          {!locked && (
                            <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
