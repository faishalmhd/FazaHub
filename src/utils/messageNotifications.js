function settingsKey(userId) {
  return `fazahub-message-notifications:${userId}`
}

export function readMessageNotificationSettings(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey(userId)) || '{}')
    return { enabled: saved.enabled === true }
  } catch {
    return { enabled: false }
  }
}

export function saveMessageNotificationSettings(userId, settings) {
  try {
    localStorage.setItem(settingsKey(userId), JSON.stringify({ enabled: settings.enabled === true }))
  } catch {
    throw new Error('Pengaturan notifikasi pesan tidak bisa disimpan di perangkat ini.')
  }
}

export async function requestMessageNotificationPermission() {
  if (!('Notification' in window)) {
    throw new Error('Browser ini belum mendukung notifikasi. Coba gunakan FazaHub sebagai aplikasi PWA.')
  }
  if (Notification.permission === 'denied') {
    throw new Error('Izin notifikasi diblokir. Aktifkan FazaHub di pengaturan notifikasi browser atau perangkat.')
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan.')
  return permission
}

export async function showIncomingMessageNotification(userId, coupleId, senderName) {
  if (!readMessageNotificationSettings(userId).enabled || !('Notification' in window) || Notification.permission !== 'granted') return

  const options = {
    body: `${senderName} mengirim pesan baru.`,
    icon: '/pwa-192.svg',
    badge: '/pwa-192.svg',
    tag: `fazahub-chat-${coupleId}`,
    renotify: true,
    data: { destination: 'chat' }
  }
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) {
    await registration.showNotification('FazaHub · Pesan baru', options)
    return
  }
  new Notification('FazaHub · Pesan baru', options)
}
