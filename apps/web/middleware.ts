import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Legacy deep links `/c/:date` and `/m/:date` predate the theater URL segment.
 * Redirect to Ukraine (the only enabled theater until M8 selector ships).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  for (const prefix of ['/c/', '/m/'] as const) {
    if (!pathname.startsWith(prefix)) continue;
    const rest = pathname.slice(prefix.length);
    const segment = rest.split('/')[0];
    if (segment && DATE_RE.test(segment)) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix}ukraine/${rest}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/c/:path*', '/m/:path*'],
};