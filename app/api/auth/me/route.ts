export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(null)
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error(
      "Error in /api/auth/me:",
      error instanceof Error ? error.message : "Unknown error",
      error instanceof Error && error.stack ? error.stack : "",
    )
    return NextResponse.json(null)
  }
}
