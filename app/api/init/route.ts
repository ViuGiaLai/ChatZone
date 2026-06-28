export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { ensureAdminExists } from "@/lib/auth"

export async function GET() {
  try {
    // Ensure admin user exists (no-op if already configured)
    await ensureAdminExists()

    return NextResponse.json({
      success: true,
      message: "Initialization complete",
      status: "initialized",
    })
  } catch (error) {
    console.error(
      "Initialization error:",
      error instanceof Error ? error.message : "Unknown error",
      error instanceof Error && error.stack ? error.stack : "",
    )
    return NextResponse.json(
      {
        success: false,
        message: "Initialization failed",
        error: error instanceof Error ? error.message : "Unknown error",
        status: "error",
      },
      { status: 200 }, // Return 200 even for errors to avoid HTML error pages
    )
  }
}
