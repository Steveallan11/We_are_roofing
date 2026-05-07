import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Pass through all requests for now
  // Auth middleware will be added later
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
