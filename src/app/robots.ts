import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://fichesplus.com'

    return {
        rules: {
        userAgent: '*',
        allow: '/',
        disallow: [
            '/api/',       
            '/admin/',    
            '/auth/',     
        ],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}