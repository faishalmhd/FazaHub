export function decodeVapidPublicKey(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, character => character.charCodeAt(0))
}

export async function getPushRegistration() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Browser ini belum mendukung push notification. Di iPhone, instal FazaHub ke Home Screen dan gunakan iOS 16.4 atau lebih baru.')
  }
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.active) {
    throw new Error('Service worker belum aktif. Buka ulang FazaHub setelah instalasi aplikasi selesai.')
  }
  return registration
}
