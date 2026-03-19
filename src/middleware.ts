import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // API routes: skip redirect (API handles auth separately)
  if (isApiRoute) return supabaseResponse

  // 로그인 안된 상태에서 login 페이지 외 접근 → /login으로
  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 이미 로그인된 상태에서 /login 접근 → /dashboard로
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
