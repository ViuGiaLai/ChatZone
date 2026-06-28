"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { register } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)

    try {
      const result = await register(formData)

      if (result.success && result.redirect) {
        router.push(result.redirect)
      } else if (!result.success) {
        setError(result.message || "Registration failed")
      }
    } catch (err) {
      console.error("Registration error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="w-full max-w-md">
        <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Đăng ký tài khoản</CardTitle>
            <CardDescription className="text-gray-400">
              Nhập thông tin để tạo tài khoản mới
            </CardDescription>
          </CardHeader>

          {error && (
            <div className="px-6">
              <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-300">
                <AlertDescription>{error}</AlertDescription>
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
              <Label htmlFor="username" className="text-gray-300">
                Tên đăng nhập
              </Label>
              <Input
                id="username"
                name="username"
                placeholder="Chọn tên đăng nhập"
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
                placeholder="Tạo mật khẩu"
                required
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
              />
            </div>
          </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                {isLoading ? "Đang tạo tài khoản..." : "Đăng ký"}
              </Button>
              <div className="text-center text-sm text-gray-400">
                Đã có tài khoản?{" "}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 underline underline-offset-4">
                  Đăng nhập
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
