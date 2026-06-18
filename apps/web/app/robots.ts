import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** Robots (M5·T1.2). Crawlable; admin/cron paths disallowed; OG image allowed for previews. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/og'],
      disallow: ['/audit', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
