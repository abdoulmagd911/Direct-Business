import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { securityHeaders } from './src/core/http/security-headers';

const withNextIntl = createNextIntlPlugin('./src/core/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: false,
  agentRules: false,
  // W31: every answer carries the security headers (src/core/http/security-headers.ts).
  async headers() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    return [{ source: '/:path*', headers: securityHeaders(url, process.env.NODE_ENV !== 'production') }];
  },
};

export default withNextIntl(nextConfig);
