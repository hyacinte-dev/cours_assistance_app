import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://fichesplus.com'

    // 1. Les pages statiques publiques
    const staticRoutes = [
        '',
        '/about',
        '/features',
        '/contact',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }))


    return staticRoutes
}