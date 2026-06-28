"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { login } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { AppInitializer } from "@/components/app-initializer"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<{ configured: boolean; connected: boolean } | null>(null)

  useEffect(() => {
    // Check database status
    async function checkDbStatus() {
      try {
        const response = await fetch("/api/status")
        if (response.ok) {
          const data = await response.json()
          setDbStatus(data)
        }
      } catch (error) {
        console.error("Error checking database status:", error)
      }
    }

    checkDbStatus()
  }, [])

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    try {
      const result = await login(formData)

      if (result.success && result.redirect) {
        router.push(result.redirect)
      } else if (!result.success) {
        setError(result.message || "Login failed")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <AppInitializer />
      <div className="w-full max-w-md">
        <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Đăng nhập</CardTitle>
            <CardDescription className="text-gray-400">
              Nhập thông tin để đăng nhập vào tài khoản của bạn
            </CardDescription>
          </CardHeader>

          {error && (
            <div className="px-6">
              <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-300">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {dbStatus && !dbStatus.configured && (
            <div className="px-6 mb-4">
              <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-300">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription>
                  Database is not configured. Please set up the environment variables.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {dbStatus && dbStatus.configured && !dbStatus.connected && (
            <div className="px-6 mb-4">
              <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-300">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertDescription>Could not connect to the database. Please check your configuration.</AlertDescription>
              </Alert>
            </div>
          )}

          <form action={handleSubmit}>
          <CardContent className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Nhập email"
                required
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
              />
            </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">
                  Mật khẩu
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Nhập mật khẩu"
                  required
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                disabled={
                  isLoading ||
                  (dbStatus !== null && (!dbStatus.configured || !dbStatus.connected))
                }
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
              <div className="text-center text-sm text-gray-400">
                Chưa có tài khoản?{" "}
                <Link href="/register" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">
                  Đăng ký
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
