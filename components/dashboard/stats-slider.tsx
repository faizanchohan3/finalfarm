"use client"

import { useEffect, useRef, useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, TrendingUp, Package, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react"

type SliderData = {
  todaySales: number
  monthSales: number
  totalProducts: number
  pendingTasks: number
  totalCustomers: number
  expiredPesticides: number
}

// Inline styles — avoids Tailwind purging dynamic class strings
const SLIDE_STYLES = [
  { background: "linear-gradient(135deg, #15803d 0%, #166534 60%, #14532d 100%)" },
  { background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #1e40af 100%)" },
  { background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 60%, #5b21b6 100%)" },
  { background: "linear-gradient(135deg, #ea580c 0%, #dc2626 60%, #b91c1c 100%)" },
]

const ACCENT_COLORS = ["#bbf7d0", "#bfdbfe", "#ddd6fe", "#fed7aa"]

export function StatsSlider(props: SliderData) {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)
  const currentRef = useRef(0)
  const animatingRef = useRef(false)
  const COUNT = 4

  const slides = [
    {
      icon: ShoppingCart,
      label: "Today's Sales",
      value: formatCurrency(props.todaySales),
      sub: "Revenue collected today",
      badge: null as number | null,
    },
    {
      icon: TrendingUp,
      label: "This Month",
      value: formatCurrency(props.monthSales),
      sub: `${props.totalCustomers} active customers`,
      badge: null as number | null,
    },
    {
      icon: Package,
      label: "Inventory",
      value: `${props.totalProducts} Products`,
      sub: props.expiredPesticides > 0
        ? `⚠ ${props.expiredPesticides} pesticide(s) expiring soon`
        : "All stock within expiry",
      badge: props.expiredPesticides > 0 ? props.expiredPesticides : null,
    },
    {
      icon: CheckSquare,
      label: "Pending Tasks",
      value: `${props.pendingTasks} Tasks`,
      sub: "Require your attention",
      badge: props.pendingTasks > 0 ? props.pendingTasks : null,
    },
  ]

  function goTo(index: number) {
    if (animatingRef.current) return
    animatingRef.current = true
    setVisible(false)
    setTimeout(() => {
      currentRef.current = index
      setCurrent(index)
      setVisible(true)
      animatingRef.current = false
    }, 250)
  }

  // Stable autoplay using refs — no stale closures
  useEffect(() => {
    const timer = setInterval(() => {
      goTo((currentRef.current + 1) % COUNT)
    }, 4000)
    return () => clearInterval(timer)
  }, []) // intentionally empty — uses refs only

  const slide = slides[current]
  const Icon = slide.icon
  const accent = ACCENT_COLORS[current]

  return (
    <div
      className="relative rounded-2xl overflow-hidden select-none"
      style={{ minHeight: 148, ...SLIDE_STYLES[current], transition: "background 0.5s ease" }}
    >
      {/* Content */}
      <div
        className="relative z-10 flex items-center gap-5 px-7 py-6"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        {/* Icon */}
        <div
          className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <Icon className="w-7 h-7 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-0.5" style={{ color: accent }}>
            {slide.label}
          </p>
          <p className="text-3xl font-bold text-white leading-tight truncate">{slide.value}</p>
          <p className="text-sm mt-1" style={{ color: accent }}>
            {slide.sub}
          </p>
        </div>

        {/* Alert badge */}
        {slide.badge !== null && (
          <div
            className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-lg"
            style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)" }}
          >
            {slide.badge}
          </div>
        )}
      </div>

      {/* Prev button */}
      <button
        onClick={() => goTo((current - 1 + COUNT) % COUNT)}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{ background: "rgba(0,0,0,0.2)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.4)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.2)")}
        aria-label="Previous"
      >
        <ChevronLeft className="w-4 h-4 text-white" />
      </button>

      {/* Next button */}
      <button
        onClick={() => goTo((current + 1) % COUNT)}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{ background: "rgba(0,0,0,0.2)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.4)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.2)")}
        aria-label="Next"
      >
        <ChevronRight className="w-4 h-4 text-white" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 items-center">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
            style={{
              width: i === current ? 20 : 8,
              height: 8,
              borderRadius: 999,
              background: i === current ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
              transition: "width 0.3s ease, background 0.3s ease",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="absolute top-3 right-10 z-20 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        {current + 1} / {COUNT}
      </div>
    </div>
  )
}
