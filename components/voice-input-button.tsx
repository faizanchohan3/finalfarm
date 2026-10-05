"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

// Mic button that fills a field by speaking. Uses the browser's speech recognition
// (Chrome / Edge; needs microphone permission and an internet connection). Default language: Urdu.
// The field fills live while speaking; the last words heard are kept even if the browser
// stops without a "final" result (which happens with Urdu).
export function VoiceInputButton({ onResult, lang = "ur-PK", className }: {
  onResult: (text: string) => void
  lang?: string
  className?: string
}) {
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState("")
  const recRef = useRef<any>(null)
  const heardRef = useRef("")
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  // Stop listening if the form closes mid-speech
  useEffect(() => () => recRef.current?.abort(), [])

  // Clear an info message after a few seconds
  useEffect(() => {
    if (!status || listening) return
    const t = setTimeout(() => setStatus(""), 6000)
    return () => clearTimeout(t)
  }, [status, listening])

  function toggle() {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const w = window as any
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Recognition) {
      setStatus("Voice input isn't supported in this browser — use Google Chrome or Microsoft Edge.")
      return
    }

    const rec = new Recognition()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    heardRef.current = ""

    rec.onresult = (e: any) => {
      let text = ""
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0]?.transcript || ""
      text = text.trim()
      if (text) {
        heardRef.current = text
        onResultRef.current(text)
        setStatus(`Heard: ${text}`)
      }
    }
    rec.onerror = (e: any) => {
      const msg: Record<string, string> = {
        "not-allowed": "Microphone is blocked. Click the lock/mic icon in the address bar, allow the microphone, then try again.",
        "service-not-allowed": "Microphone is blocked. Click the lock/mic icon in the address bar, allow the microphone, then try again.",
        "no-speech": "No speech heard. Check your microphone is selected and speak right after clicking.",
        "audio-capture": "No microphone found. Plug in or select a microphone and try again.",
        "network": "Voice input needs an internet connection (the browser sends the audio to its speech service).",
        "language-not-supported": "Urdu voice input isn't available in this browser — try Google Chrome.",
      }
      if (e.error !== "aborted") setStatus(msg[e.error] || `Voice input failed: ${e.error}`)
    }
    rec.onend = () => {
      setListening(false)
      setStatus((s) => (s.startsWith("Listening") ? (heardRef.current ? "" : "No speech heard — click the mic and try again.") : s))
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      setStatus("Listening… speak the name in Urdu")
    } catch (err: any) {
      setStatus(`Couldn't start voice input: ${err?.message || err}`)
    }
  }

  return (
    <span className="relative flex-shrink-0">
      <button
        type="button"
        onClick={toggle}
        title={listening ? "Listening… click to stop" : "Speak the name in Urdu"}
        className={cn(
          "inline-flex items-center justify-center h-9 w-9 rounded-md border transition-colors",
          listening ? "bg-red-600 border-red-600 text-white animate-pulse" : "border-gray-300 text-gray-600 hover:bg-purple-50 hover:text-purple-700",
          className,
        )}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      {status && (
        <span
          dir="auto"
          className={cn(
            "absolute right-0 top-full mt-1 z-20 w-64 rounded-md border px-2.5 py-1.5 text-xs shadow-sm",
            listening ? "bg-red-50 border-red-200 text-red-700" : status.startsWith("Heard") ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800",
          )}
        >
          {status}
        </span>
      )}
    </span>
  )
}
