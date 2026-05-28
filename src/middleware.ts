export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!login|api/auth|api/emails/inbound|_next/static|_next/image|favicon.ico).*)',
  ],
}
