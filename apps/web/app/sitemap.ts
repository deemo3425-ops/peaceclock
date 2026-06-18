import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** Sitemap (M5·T1.2). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['', '/methodology', '/about', '/privacy'].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'hourly' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
