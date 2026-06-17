import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://peaceclock.org';

/** Sitemap (M5·T1.2). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['', '/map', '/methodology', '/about', '/privacy'].map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'hourly' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
