import type { MetadataRoute } from 'next'
import { getAppName } from '@/lib/appinfo'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const appName = await getAppName()
  return {
    name: appName,
    short_name: appName,
    description: 'Warenwirtschafts- und CRM-System für den Agrarhandel – Kunden, Artikel, Lager & CRM',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#16a34a',
    orientation: 'any',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/icons/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: `${appName} Dashboard`,
      },
      {
        src: '/icons/screenshot-mobile.png',
        sizes: '390x844',
        type: 'image/png',
        form_factor: 'narrow',
        label: `${appName} Mobile`,
      },
    ],
  }
}
