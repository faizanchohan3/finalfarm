"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, CheckCircle, Zap, CheckCircle2, BarChart3, Lock, Zap as ZapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Tab = "login" | "register"

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("login")

  // Login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

  // Register state
  const [reg, setReg] = useState({
    shopName: "", ownerName: "", email: "", password: "", confirmPassword: "", phone: "", city: "",
  })
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState("")
  const [regSuccess, setRegSuccess] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError("")

    const result = await signIn("credentials", { email, password, redirect: false })

    if (result?.error) {
      setLoginError("Invalid credentials or your shop account is pending approval.")
      setLoginLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegError("")

    if (reg.password !== reg.confirmPassword) {
      setRegError("Passwords do not match.")
      return
    }
    if (reg.password.length < 6) {
      setRegError("Password must be at least 6 characters.")
      return
    }

    setRegLoading(true)
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName: reg.shopName,
        ownerName: reg.ownerName,
        email: reg.email,
        password: reg.password,
        phone: reg.phone,
        city: reg.city,
      }),
    })

    const data = await res.json()
    setRegLoading(false)

    if (!res.ok) {
      setRegError(data.error || "Registration failed. Please try again.")
    } else {
      setRegSuccess(true)
    }
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Blue Gradient Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 text-white p-8 flex-col justify-center relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-400 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400 rounded-full opacity-10 blur-3xl"></div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-8 h-8" strokeWidth={3} />
            <div>
              <h1 className="text-3xl font-bold">Agrifarm ERP</h1>
              <p className="text-blue-100 text-xs">Enterprise Resource Planning</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-blue-100 mb-6 leading-relaxed">
            Manage your business operations with ease. Track sales, purchases, inventory, and more in one powerful platform.
          </p>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Complete ERP Solution</span>
            </div>
            <div className="flex items-start gap-2">
              <BarChart3 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Real-time Analytics</span>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Secure & Reliable</span>
            </div>
            <div className="flex items-start gap-2">
              <ZapIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Fast & Efficient</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {tab === "login" && (
            <>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Sign In</h2>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                      {loginError}
                    </div>
                  )}

                  <Button type="submit" className="w-full bg-blue-100 hover:bg-white" disabled={loginLoading}>
                    {loginLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                  Want to register your shop?{" "}
                  <button onClick={() => setTab("register")} className="text-blue-600 font-medium hover:underline">
                    Register here
                  </button>
                </p>
              </>
            )}

            {/* REGISTER FORM */}
            {tab === "register" && (
              <>
                {regSuccess ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                      <CheckCircle className="w-9 h-9 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Registration Submitted!</h2>
                    <p className="text-gray-500 text-sm mb-6">
                      Your shop <strong>"{reg.shopName}"</strong> has been registered and is pending approval.
                      You will be able to login once the platform admin approves your shop.
                    </p>
                    <Button
                      onClick={() => { setTab("login"); setRegSuccess(false) }}
                      className="bg-blue-100 hover:bg-white"
                    >
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-6">
                      <ShoppingBag className="w-5 h-5 text-blue-600" />
                      <h2 className="text-xl font-semibold text-gray-800">Register Your Shop</h2>
                    </div>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1">
                          <Label htmlFor="shopName">Shop Name *</Label>
                          <Input
                            id="shopName"
                            placeholder="e.g. Ahmad Traders"
                            value={reg.shopName}
                            onChange={(e) => setReg({ ...reg, shopName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label htmlFor="ownerName">Your Name (Owner) *</Label>
                          <Input
                            id="ownerName"
                            placeholder="Full name"
                            value={reg.ownerName}
                            onChange={(e) => setReg({ ...reg, ownerName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label htmlFor="regEmail">Email Address *</Label>
                          <Input
                            id="regEmail"
                            type="email"
                            placeholder="your@email.com"
                            value={reg.email}
                            onChange={(e) => setReg({ ...reg, email: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="regPassword">Password *</Label>
                          <Input
                            id="regPassword"
                            type="password"
                            placeholder="Min 6 chars"
                            value={reg.password}
                            onChange={(e) => setReg({ ...reg, password: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="confirmPassword">Confirm Password *</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Repeat password"
                            value={reg.confirmPassword}
                            onChange={(e) => setReg({ ...reg, confirmPassword: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            placeholder="03XX-XXXXXXX"
                            value={reg.phone}
                            onChange={(e) => setReg({ ...reg, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            placeholder="e.g. Lahore"
                            value={reg.city}
                            onChange={(e) => setReg({ ...reg, city: e.target.value })}
                          />
                        </div>
                      </div>

                      {regError && (
                        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                          {regError}
                        </div>
                      )}

                      <Button type="submit" className="w-full bg-blue-100 hover:bg-white mt-2" disabled={regLoading}>
                        {regLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit Registration"}
                      </Button>
                    </form>

                    <p className="mt-4 text-center text-xs text-gray-400">
                      Already have an account?{" "}
                      <button onClick={() => setTab("login")} className="text-blue-600 font-medium hover:underline">
                        Sign In
                      </button>
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
