export const runtime = "nodejs";
import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';

export async function POST(request: Request) {
  const { email, username, password } = await request.json();
  const result = await registerUser(email, password, username);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  // Set session_id cookie in response
  const response = new NextResponse(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
  response.cookies.set('session_id', result.user.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
  });

  return response;
}
