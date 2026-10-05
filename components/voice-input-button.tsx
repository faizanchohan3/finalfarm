"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

// Mic button that fills a field by speaking. Uses the browser's speech recognition
// (Chrome / Edge; needs microphone permission and an internet connection). Default language: Urdu.
export function VoiceInputButton({ onResult, lang = "ur-PK", className }: {
  onResult: (text: string) => void
  lang?: string
  className?: string
}) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  // Stop listening if the form closes mid-speech
  useEffect(() => () => recRef.current?.abort(), [])

  function toggle() {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const w = window as any
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Recognition) {
      alert("Voice input isn't supported in this browser. Please use Google Chrome or Microsoft Edge.")
      return
    }
    const rec = new Recognition()
    rec.lang = lang
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const text = String(e.results?.[0]?.[0]?.transcript || "").trim()
      if (text) onResult(text)
    }
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") alert("Microphone access is blocked. Allow the microphone for this site in the browser's address bar, then try again.")
      else if (e.error === "network") alert("Voice input needs an internet connection.")
      else if (e.error !== "no-speech" && e.error !== "aborted") alert(`Voice input failed: ${e.error}`)
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Listening… click to stop" : "Speak the name in Urdu"}
      className={cn(
        "flex-shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md border transition-colors",
        listening ? "bg-red-600 border-red-600 text-white animate-pulse" : "border-gray-300 text-gray-600 hover:bg-purple-50 hover:text-purple-700",
        className,
      )}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  )
}
