const DEFAULT_TIME = '20:00'

function settingsKey(userId) {
  return `fazahub-reminder:${userId}`
}

function todayKey(userId) {
  return `fazahub-reminder-sent:${userId}`
}

export function readReminderSettings(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey(userId)) || '{}')
    return {
      enabled: saved.enabled === true,
      time: typeof saved.time === 'string' && /^\d{2}:\d{2}$/.test(saved.time) ? saved.time : DEFAULT_TIME
    }
  } catch {
    return { enabled: false, time: DEFAULT_TIME }
  }
}

export function saveReminderSettings(userId, settings) {
  try {
    localStorage.setItem(settingsKey(userId), JSON.stringify(settings))
  } catch {
    throw new Error('Pengaturan pengingat tidak bisa disimpan di perangkat ini.')
  }
}

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

export async function checkLocalReminder(userId, todayUserSnaps) {
  const settings = readReminderSettings(userId)
  if (!settings.enabled || todayUserSnaps > 0) return false

  const now = new Date()
  const [hour, minute] = settings.time.split(':').map(Number)
  if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) return false

  const date = localDate(now)
  try {
    if (localStorage.getItem(todayKey(userId)) === date) return false
    if (Notification.permission !== 'granted') return false

    const options = {
      body: 'Simpan satu momen kecil sebelum hari ini berlalu.',
      icon: '/pwa-192.svg',
      tag: `fazahub-reminder-${date}`
    }
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration?.active) await registration.showNotification('FazaHub · Hari ini', options)
    else new Notification('FazaHub · Hari ini', options)

    localStorage.setItem(todayKey(userId), date)
    return true
  } catch {
    return false
  }
}

export async function showTestReminder() {
  if (!('Notification' in window)) {
    throw new Error('Browser ini belum mendukung notifikasi. Gunakan kalender HP untuk alarm.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan.')

  const options = {
    body: 'Pengingat FazaHub sudah aktif di perangkat ini.',
    icon: '/pwa-192.svg',
    tag: 'fazahub-reminder-test'
  }
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration?.active) await registration.showNotification('FazaHub · Tes notifikasi', options)
  else new Notification('FazaHub · Tes notifikasi', options)
}

export function downloadCalendarAlarm(time) {
  const [hour, minute] = time.split(':').map(Number)
  const now = new Date()
  const firstReminder = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute)
  if (firstReminder <= now) firstReminder.setDate(firstReminder.getDate() + 1)

  const formatLocal = date => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('') + `T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const escapeIcs = value => value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
  const contents = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FazaHub//Daily Memory Reminder//ID',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:fazahub-reminder-${stamp}@fazahub`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatLocal(firstReminder)}`,
    `RRULE:FREQ=DAILY`,
    'SUMMARY:FazaHub - Simpan momen hari ini',
    `DESCRIPTION:${escapeIcs('Simpan foto dan kenangan hari ini bersama pasangan.')}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    'DESCRIPTION:FazaHub - Waktunya simpan kenangan',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'fazahub-pengingat-harian.ics'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
