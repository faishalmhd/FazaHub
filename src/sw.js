import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ url }) => url.origin === 'https://res.cloudinary.com',
  new CacheFirst({
    cacheName: 'fazahub-images',
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 })]
  })
)

registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkOnly()
)

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data?.json() || {}
  } catch {
    payload = { body: event.data?.text() }
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'FazaHub', {
    body: payload.body || 'Simpan satu momen kecil hari ini.',
    icon: '/pwa-192.svg',
    badge: '/pwa-192.svg',
    tag: payload.tag || 'fazahub-daily-reminder',
    data: { url: payload.url || '/' }
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(targetUrl)
        return
      }
    }
    await self.clients.openWindow(targetUrl)
  })())
})
